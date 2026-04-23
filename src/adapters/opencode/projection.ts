import type { AgentPermissionRule } from "../../core";
import type { ProjectedAgent, TeamLibraryProjection } from "../../runtime";
import {
  createAvailableToolContext,
  isAvailableTool,
  type AvailableToolDefinition,
} from "../../runtime/registries";

import {
  createOpenCodePermissionConfig,
  createOpenCodePermissionRules,
  mapOpenCodeToolNames,
  type OpenCodePermissionConfig,
  type OpenCodePermissionRule,
} from "./permission-mapper";
import { createOpenCodeAgentPrompt } from "./prompt-builder";

export type OpenCodeAgentMode = "primary" | "subagent";

export interface OpenCodeAgentRuntimeConfig {
  requestedTools: string[];
  permission: AgentPermissionRule[];
  skills: string[];
  instructions: string[];
  mcpServers: string[];
  memory?: string;
  hooks?: string;
}

export interface OpenCodeResolvedModelConfig {
  providerID: string;
  modelID: string;
  temperature?: number;
  topP?: number;
  variant?: string;
  options?: Record<string, unknown>;
  source: "team-manifest";
}

export interface OpenCodeResolvedToolConfig {
  requestedTools: string[];
  availableTools: string[];
  missingTools: string[];
  availabilitySource: "host-provided" | "crewbee-plugin" | "merged" | "default-placeholder";
  availabilityIsExplicit: boolean;
}

export interface OpenCodeAgentMetadata {
  teamId: string;
  teamName: string;
  canonicalAgentId: string;
  sourceAgentId?: string;
  roleKind: ProjectedAgent["roleKind"];
  exposure: ProjectedAgent["exposure"];
}

export interface OpenCodeAgentConfig {
  configKey: string;
  teamId: string;
  canonicalAgentId: string;
  mode: OpenCodeAgentMode;
  hidden: boolean;
  description: string;
  prompt: string;
  permission: OpenCodePermissionRule[];
  runtimeConfig: OpenCodeAgentRuntimeConfig;
  resolvedModel?: OpenCodeResolvedModelConfig;
  resolvedTooling: OpenCodeResolvedToolConfig;
  metadata: OpenCodeAgentMetadata;
}

export interface OpenCodeAgentDefinition {
  name: string;
  description: string;
  mode: OpenCodeAgentMode;
  hidden?: boolean;
  model?: string;
  temperature?: number;
  top_p?: number;
  variant?: string;
  prompt: string;
  permission: OpenCodePermissionConfig;
  options?: Record<string, unknown>;
}

export interface OpenCodeAgentConfigPatch {
  agent: Record<string, OpenCodeAgentDefinition>;
  defaultAgent?: string;
}

export interface OpenCodeAgentSelectionInput {
  configKey?: string;
}

export interface OpenCodeProjectionOptions {
  availableTools?: readonly (string | AvailableToolDefinition)[];
}

export interface OpenCodeAgentAliasEntry {
  alias: string;
  agent: OpenCodeAgentConfig;
  kind: "config-key";
}

export interface OpenCodeProjectionIdentityEntry {
  configKey: string;
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createOpenCodeConfigKey(agent: ProjectedAgent): string {
  return agent.canonicalAgentId;
}

export function createOpenCodeAgentConfig(
  agent: ProjectedAgent,
  options: OpenCodeProjectionOptions = {},
): OpenCodeAgentConfig {
  const runtimeConfig = agent.sourceAgent.runtimeConfig;
  const runtimeOverride = agent.sourceTeam.manifest.agentRuntime?.[agent.canonicalAgentId];
  const availableToolContext = createAvailableToolContext(options.availableTools);
  const requestedTools = mapOpenCodeToolNames(runtimeConfig.requestedTools);
  const availableTools = availableToolContext.hasExplicitTools
    ? requestedTools.filter((toolId) => isAvailableTool(toolId, availableToolContext))
    : [...requestedTools];
  const missingTools = availableToolContext.hasExplicitTools
    ? requestedTools.filter((toolId) => !isAvailableTool(toolId, availableToolContext))
    : [];

  return {
    configKey: createOpenCodeConfigKey(agent),
    teamId: agent.teamId,
    canonicalAgentId: agent.canonicalAgentId,
    mode: agent.exposure === "user-selectable" ? "primary" : "subagent",
    hidden: agent.exposure !== "user-selectable",
    description: agent.description,
    prompt: createOpenCodeAgentPrompt(agent, requestedTools),
    permission: createOpenCodePermissionRules(agent, availableToolContext),
    runtimeConfig: {
      requestedTools,
      permission: runtimeConfig.permission,
      skills: runtimeConfig.skills ?? [],
      instructions: runtimeConfig.instructions ?? [],
      mcpServers: runtimeConfig.mcpServers ?? [],
      memory: runtimeConfig.memory,
      hooks: runtimeConfig.hooks,
    },
    resolvedModel: runtimeOverride
      ? {
          providerID: runtimeOverride.provider,
          modelID: runtimeOverride.model,
          temperature: runtimeOverride.temperature,
          topP: runtimeOverride.topP,
          variant: runtimeOverride.variant,
          options: runtimeOverride.options,
          source: "team-manifest",
        }
      : undefined,
    resolvedTooling: {
      requestedTools,
      availableTools,
      missingTools,
      availabilitySource: availableToolContext.source,
      availabilityIsExplicit: availableToolContext.hasExplicitTools,
    },
    metadata: {
      teamId: agent.teamId,
      teamName: agent.teamName,
      canonicalAgentId: agent.canonicalAgentId,
      sourceAgentId: agent.sourceAgent.metadata.sourceId,
      roleKind: agent.roleKind,
      exposure: agent.exposure,
    },
  };
}

export function createOpenCodeAgentConfigs(
  projection: TeamLibraryProjection,
  options: OpenCodeProjectionOptions = {},
): OpenCodeAgentConfig[] {
  return projection.agents.map((agent) => createOpenCodeAgentConfig(agent, options));
}

export function createOpenCodeAgentDefinition(agent: OpenCodeAgentConfig): OpenCodeAgentDefinition {
  return {
    name: agent.configKey,
    description: agent.description,
    mode: agent.mode,
    hidden: agent.hidden || undefined,
    model: agent.resolvedModel
      ? `${agent.resolvedModel.providerID}/${agent.resolvedModel.modelID}`
      : undefined,
    temperature: agent.resolvedModel?.temperature,
    top_p: agent.resolvedModel?.topP,
    variant: agent.resolvedModel?.variant,
    prompt: agent.prompt,
    permission: createOpenCodePermissionConfig(agent.permission),
    options: agent.resolvedModel?.options,
  };
}

export function createOpenCodeProjectedIdentities(agent: OpenCodeAgentConfig): OpenCodeProjectionIdentityEntry[] {
  return [{
    configKey: agent.configKey,
  }];
}

export function createOpenCodeAgentConfigPatch(input: {
  agents: OpenCodeAgentConfig[];
  defaultAgentConfigKey?: string;
}): OpenCodeAgentConfigPatch {
  return {
    agent: Object.fromEntries(
      input.agents.map((agent) => [agent.configKey, createOpenCodeAgentDefinition(agent)]),
    ),
    defaultAgent: input.defaultAgentConfigKey,
  };
}

export function findProjectedAgentByConfigKey(
  agents: OpenCodeAgentConfig[],
  configKey: string,
): OpenCodeAgentConfig | undefined {
  return agents.find((agent) => agent.configKey === configKey);
}

export function resolveProjectedAgentSelection(
  agents: OpenCodeAgentConfig[],
  selection: OpenCodeAgentSelectionInput,
): OpenCodeAgentConfig | undefined {
  if (selection.configKey) {
    const byConfigKey = findProjectedAgentByConfigKey(agents, selection.configKey);
    if (byConfigKey) {
      return byConfigKey;
    }
  }

  return undefined;
}

function normalizeAlias(value: string): string {
  return value.trim().toLowerCase();
}

export function createProjectedAgentAliasEntries(agent: OpenCodeAgentConfig): OpenCodeAgentAliasEntry[] {
  return [{ alias: agent.configKey, agent, kind: "config-key" }];
}

export function createProjectedAgentAliasIndex(
  agents: OpenCodeAgentConfig[],
): Map<string, OpenCodeAgentAliasEntry> {
  const index = new Map<string, OpenCodeAgentAliasEntry>();

  for (const agent of agents) {
    for (const entry of createProjectedAgentAliasEntries(agent)) {
      const key = normalizeAlias(entry.alias);
      if (!key || index.has(key)) {
        continue;
      }

      index.set(key, entry);
    }
  }

  return index;
}

export function resolveProjectedAgentAlias(
  index: Map<string, OpenCodeAgentAliasEntry>,
  alias: string | undefined,
): OpenCodeAgentAliasEntry | undefined {
  if (!alias) {
    return undefined;
  }

  return index.get(normalizeAlias(alias));
}

export function createProjectedAgentTaskAliasHelpLines(agents: OpenCodeAgentConfig[]): string[] {
  return agents.map((agent) => {
    return `- ${agent.configKey}`;
  });
}
