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
import { createManagedCrewBeeAgentOptions } from "./ownership";
import { createOpenCodeAgentPrompt } from "./prompt-builder";
import { resolveAgentModel, type ModelResolutionTrace } from "./model-resolution";

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
  source: "crewbee-json" | "team-manifest" | "team-manifest-default" | "builtin-role-chain";
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

export interface OpenCodeDelegationTarget {
  configKey: string;
  canonicalAgentId: string;
  sourceAgentId?: string;
  description: string;
  via: "consult" | "handoff";
}

export interface OpenCodeDelegationPolicy {
  allowedTargets: OpenCodeDelegationTarget[];
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
  modelResolution: ModelResolutionTrace;
  resolvedTooling: OpenCodeResolvedToolConfig;
  delegation: OpenCodeDelegationPolicy;
  metadata: OpenCodeAgentMetadata;
}

export interface OpenCodeAgentDefinition {
  name: string;
  description: string;
  mode: OpenCodeAgentMode;
  hidden?: boolean;
  disable?: boolean;
  tools?: Record<string, boolean>;
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
  forceUpdateAgentKeys?: string[];
}

export interface OpenCodeAgentSelectionInput {
  configKey?: string;
}

export interface OpenCodeProjectionOptions {
  availableTools?: readonly (string | AvailableToolDefinition)[];
  availableModels?: readonly string[];
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

function resolveTeamAgentByRef(agent: ProjectedAgent, agentRef: string): ProjectedAgent["sourceAgent"] | undefined {
  return agent.sourceTeam.agents.find((candidate) => {
    return candidate.metadata.id === agentRef || candidate.canonicalAgentId === agentRef;
  });
}

function createDelegationPolicy(agent: ProjectedAgent): OpenCodeDelegationPolicy {
  const createTarget = (
    binding: ProjectedAgent["sourceAgent"]["collaboration"]["defaultConsults"][number],
    via: OpenCodeDelegationTarget["via"],
  ): OpenCodeDelegationTarget | undefined => {
    const agentRef = typeof binding === "string" ? binding : binding.agentRef;
    const targetAgent = resolveTeamAgentByRef(agent, agentRef);
    if (!targetAgent) {
      return undefined;
    }

    const canonicalAgentId = targetAgent.canonicalAgentId ?? targetAgent.metadata.id;
    const member = agent.sourceTeam.manifest.members[targetAgent.metadata.id] ?? agent.sourceTeam.manifest.members[agentRef];

    return {
      configKey: canonicalAgentId,
      canonicalAgentId,
      sourceAgentId: targetAgent.metadata.id,
      description: member?.responsibility ?? targetAgent.responsibilityCore.description,
      via,
    };
  };

  const targets = [
    ...agent.sourceAgent.collaboration.defaultConsults.map((binding) => createTarget(binding, "consult")),
    ...agent.sourceAgent.collaboration.defaultHandoffs.map((binding) => createTarget(binding, "handoff")),
  ].filter((target): target is OpenCodeDelegationTarget => Boolean(target));
  const deduped = new Map<string, OpenCodeDelegationTarget>();

  for (const target of targets) {
    if (!deduped.has(target.configKey)) {
      deduped.set(target.configKey, target);
    }
  }

  return { allowedTargets: [...deduped.values()] };
}

export function createOpenCodeAgentConfig(
  agent: ProjectedAgent,
  options: OpenCodeProjectionOptions = {},
): OpenCodeAgentConfig {
  const runtimeConfig = agent.sourceAgent.runtimeConfig;
  const modelResolution = resolveAgentModel({
    agent,
    availableModels: options.availableModels,
  });
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
    resolvedModel: modelResolution.model,
    modelResolution: modelResolution.trace,
    resolvedTooling: {
      requestedTools,
      availableTools,
      missingTools,
      availabilitySource: availableToolContext.source,
      availabilityIsExplicit: availableToolContext.hasExplicitTools,
    },
    delegation: createDelegationPolicy(agent),
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
    tools: { task: false },
    model: agent.resolvedModel
      ? `${agent.resolvedModel.providerID}/${agent.resolvedModel.modelID}`
      : undefined,
    temperature: agent.resolvedModel?.temperature,
    top_p: agent.resolvedModel?.topP,
    variant: agent.resolvedModel?.variant,
    prompt: agent.prompt,
    permission: createOpenCodePermissionConfig(agent.permission),
    options: createManagedCrewBeeAgentOptions({
      teamId: agent.teamId,
      canonicalAgentId: agent.canonicalAgentId,
      existingOptions: agent.resolvedModel?.options,
    }),
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
  const disabledHostAgents: Record<string, OpenCodeAgentDefinition> = {
    build: {
      name: "build",
      description: "Disabled by CrewBee while a CrewBee Agent Team owns the session.",
      mode: "subagent",
      disable: true,
      tools: {},
      prompt: "",
      permission: {},
    },
    plan: {
      name: "plan",
      description: "Disabled by CrewBee while a CrewBee Agent Team owns the session.",
      mode: "subagent",
      disable: true,
      tools: {},
      prompt: "",
      permission: {},
    },
    general: {
      name: "general",
      description: "Disabled by CrewBee while a CrewBee Agent Team owns the session.",
      mode: "subagent",
      disable: true,
      tools: {},
      prompt: "",
      permission: {},
    },
  };

  return {
    agent: {
      ...Object.fromEntries(
        input.agents.map((agent) => [agent.configKey, createOpenCodeAgentDefinition(agent)]),
      ),
      ...disabledHostAgents,
    },
    defaultAgent: input.defaultAgentConfigKey,
    forceUpdateAgentKeys: Object.keys(disabledHostAgents),
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
