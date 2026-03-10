import type { AgentPermissionRule } from "../../core";
import type { CatalogAgentProjection, CatalogProjection } from "../../runtime";
import {
  createAvailableToolContext,
  isAvailableTool,
  type AvailableToolDefinition,
} from "../../runtime/registries";

import { createOpenCodePermissionRules, type OpenCodePermissionRule } from "./permission-mapper";
import { createOpenCodeAgentPrompt } from "./prompt-builder";

export type OpenCodeAgentMode = "primary" | "subagent";

export interface OpenCodeAgentCapabilities {
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
  availabilitySource: "host-provided" | "agentscroll-plugin" | "merged" | "default-placeholder";
  availabilityIsExplicit: boolean;
}

export interface OpenCodeAgentMetadata {
  teamId: string;
  teamName: string;
  sourceAgentId: string;
  surfaceLabel: string;
  roleKind: CatalogAgentProjection["roleKind"];
  exposure: CatalogAgentProjection["exposure"];
}

export interface OpenCodeAgentConfig {
  configKey: string;
  publicName: string;
  teamId: string;
  sourceAgentId: string;
  mode: OpenCodeAgentMode;
  hidden: boolean;
  description: string;
  prompt: string;
  permission: OpenCodePermissionRule[];
  capabilities: OpenCodeAgentCapabilities;
  resolvedModel?: OpenCodeResolvedModelConfig;
  resolvedTooling: OpenCodeResolvedToolConfig;
  metadata: OpenCodeAgentMetadata;
}

export interface OpenCodeAgentDefinition {
  name: string;
  description: string;
  mode: OpenCodeAgentMode;
  hidden?: boolean;
  model?: {
    providerID: string;
    modelID: string;
  };
  temperature?: number;
  topP?: number;
  variant?: string;
  prompt: string;
  permission: OpenCodePermissionRule[];
  options: {
    capabilities: OpenCodeAgentCapabilities;
    resolvedModel?: OpenCodeResolvedModelConfig;
    resolvedTooling: OpenCodeResolvedToolConfig;
    metadata: OpenCodeAgentMetadata;
    providerOptions?: Record<string, unknown>;
  };
}

export interface OpenCodeAgentConfigPatch {
  agent: Record<string, OpenCodeAgentDefinition>;
  defaultAgent?: string;
}

export interface OpenCodeAgentSelectionInput {
  configKey?: string;
  publicName?: string;
}

export interface OpenCodeProjectionOptions {
  availableTools?: readonly (string | AvailableToolDefinition)[];
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createOpenCodePublicAgentName(agent: CatalogAgentProjection): string {
  return `[${agent.teamName}]${agent.surfaceLabel}`;
}

export function createOpenCodeConfigKey(agent: CatalogAgentProjection): string {
  return `agentscroll.${sanitizeSegment(agent.teamId)}.${sanitizeSegment(agent.surfaceLabel)}`;
}

export function projectCatalogAgentToOpenCode(
  agent: CatalogAgentProjection,
  options: OpenCodeProjectionOptions = {},
): OpenCodeAgentConfig {
  const capabilities = agent.sourceAgent.capabilities;
  const runtimeOverride = agent.sourceTeam.manifest.agentRuntime?.[agent.sourceAgentId];
  const availableToolContext = createAvailableToolContext(options.availableTools);
  const availableTools = availableToolContext.hasExplicitTools
    ? capabilities.requestedTools.filter((toolId: string) => isAvailableTool(toolId, availableToolContext))
    : [...capabilities.requestedTools];
  const missingTools = availableToolContext.hasExplicitTools
    ? capabilities.requestedTools.filter((toolId: string) => !isAvailableTool(toolId, availableToolContext))
    : [];

  return {
    configKey: createOpenCodeConfigKey(agent),
    publicName: createOpenCodePublicAgentName(agent),
    teamId: agent.teamId,
    sourceAgentId: agent.sourceAgentId,
    mode: agent.exposure === "user-selectable" ? "primary" : "subagent",
    hidden: agent.exposure !== "user-selectable",
    description: agent.description,
    prompt: createOpenCodeAgentPrompt(agent),
    permission: createOpenCodePermissionRules(agent, availableToolContext),
    capabilities: {
      requestedTools: capabilities.requestedTools,
      permission: capabilities.permission,
      skills: capabilities.skills ?? [],
      instructions: capabilities.instructions ?? [],
      mcpServers: capabilities.mcpServers ?? [],
      memory: capabilities.memory,
      hooks: capabilities.hooks,
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
      requestedTools: capabilities.requestedTools,
      availableTools,
      missingTools,
      availabilitySource: availableToolContext.source,
      availabilityIsExplicit: availableToolContext.hasExplicitTools,
    },
    metadata: {
      teamId: agent.teamId,
      teamName: agent.teamName,
      sourceAgentId: agent.sourceAgentId,
      surfaceLabel: agent.surfaceLabel,
      roleKind: agent.roleKind,
      exposure: agent.exposure,
    },
  };
}

export function projectCatalogToOpenCodeAgents(
  catalog: CatalogProjection,
  options: OpenCodeProjectionOptions = {},
): OpenCodeAgentConfig[] {
  return catalog.agents.map((agent) => projectCatalogAgentToOpenCode(agent, options));
}

export function createOpenCodeAgentDefinition(agent: OpenCodeAgentConfig): OpenCodeAgentDefinition {
  return {
    name: agent.publicName,
    description: agent.description,
    mode: agent.mode,
    hidden: agent.hidden || undefined,
    model: agent.resolvedModel
      ? {
          providerID: agent.resolvedModel.providerID,
          modelID: agent.resolvedModel.modelID,
        }
      : undefined,
    temperature: agent.resolvedModel?.temperature,
    topP: agent.resolvedModel?.topP,
    variant: agent.resolvedModel?.variant,
    prompt: agent.prompt,
    permission: agent.permission,
    options: {
      capabilities: agent.capabilities,
      resolvedModel: agent.resolvedModel,
      resolvedTooling: agent.resolvedTooling,
      metadata: agent.metadata,
      providerOptions: agent.resolvedModel?.options,
    },
  };
}

export function createOpenCodeAgentConfigPatch(input: {
  agents: OpenCodeAgentConfig[];
  defaultAgentConfigKey?: string;
}): OpenCodeAgentConfigPatch {
  return {
    agent: Object.fromEntries(input.agents.map((agent) => [agent.configKey, createOpenCodeAgentDefinition(agent)])),
    defaultAgent: input.defaultAgentConfigKey,
  };
}

export function findProjectedAgentByConfigKey(
  agents: OpenCodeAgentConfig[],
  configKey: string,
): OpenCodeAgentConfig | undefined {
  return agents.find((agent) => agent.configKey === configKey);
}

export function findProjectedAgentByPublicName(
  agents: OpenCodeAgentConfig[],
  publicName: string,
): OpenCodeAgentConfig | undefined {
  return agents.find((agent) => agent.publicName === publicName);
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

  if (selection.publicName) {
    return findProjectedAgentByPublicName(agents, selection.publicName);
  }

  return undefined;
}
