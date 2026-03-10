import type { CatalogAgentProjection, CatalogProjection } from "../../runtime";
import {
  getToolset,
  isAvailableTool,
  type ToolsetDefinition,
} from "../../runtime/registries";

import { createOpenCodePermissionRules, type OpenCodePermissionRule } from "./permission-mapper";
import { createOpenCodeAgentPrompt } from "./prompt-builder";

export type OpenCodeProjectedAgentMode = "primary" | "subagent";

export interface OpenCodeProjectedAgentCapabilities {
  toolset: string;
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
  toolset: ToolsetDefinition;
  availableTools: string[];
  missingTools: string[];
}

export interface OpenCodeProjectedAgentMetadata {
  teamId: string;
  teamName: string;
  sourceAgentId: string;
  surfaceLabel: string;
  roleKind: CatalogAgentProjection["roleKind"];
  exposure: CatalogAgentProjection["exposure"];
}

export interface OpenCodeProjectedAgentConfig {
  configKey: string;
  publicName: string;
  teamId: string;
  sourceAgentId: string;
  mode: OpenCodeProjectedAgentMode;
  hidden: boolean;
  description: string;
  prompt: string;
  permission: OpenCodePermissionRule[];
  capabilities: OpenCodeProjectedAgentCapabilities;
  resolvedModel?: OpenCodeResolvedModelConfig;
  resolvedTooling: OpenCodeResolvedToolConfig;
  metadata: OpenCodeProjectedAgentMetadata;
}

export interface OpenCodeProjectedAgentDefinition {
  name: string;
  description: string;
  mode: OpenCodeProjectedAgentMode;
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
    capabilities: OpenCodeProjectedAgentCapabilities;
    resolvedModel?: OpenCodeResolvedModelConfig;
    resolvedTooling: OpenCodeResolvedToolConfig;
    metadata: OpenCodeProjectedAgentMetadata;
    providerOptions?: Record<string, unknown>;
  };
}

export interface OpenCodeAgentConfigPatch {
  agent: Record<string, OpenCodeProjectedAgentDefinition>;
  defaultAgent?: string;
}

export interface OpenCodeAgentSelectionInput {
  configKey?: string;
  publicName?: string;
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

export function projectCatalogAgentToOpenCode(agent: CatalogAgentProjection): OpenCodeProjectedAgentConfig {
  const capabilities = agent.sourceAgent.capabilities;
  const toolset = getToolset(capabilities.toolset);
  const runtimeOverride = agent.sourceTeam.manifest.agentRuntime?.[agent.sourceAgentId];
  const availableTools = toolset.requestedTools.filter((toolId) => isAvailableTool(toolId));
  const missingTools = toolset.requestedTools.filter((toolId) => !isAvailableTool(toolId));

  return {
    configKey: createOpenCodeConfigKey(agent),
    publicName: createOpenCodePublicAgentName(agent),
    teamId: agent.teamId,
    sourceAgentId: agent.sourceAgentId,
    mode: agent.exposure === "user-selectable" ? "primary" : "subagent",
    hidden: agent.exposure !== "user-selectable",
    description: agent.description,
    prompt: createOpenCodeAgentPrompt(agent),
    permission: createOpenCodePermissionRules(agent),
    capabilities: {
      toolset: capabilities.toolset,
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
      toolset,
      availableTools,
      missingTools,
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

export function projectCatalogToOpenCodeAgents(catalog: CatalogProjection): OpenCodeProjectedAgentConfig[] {
  return catalog.agents.map((agent) => projectCatalogAgentToOpenCode(agent));
}

export function createOpenCodeAgentDefinition(agent: OpenCodeProjectedAgentConfig): OpenCodeProjectedAgentDefinition {
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
  agents: OpenCodeProjectedAgentConfig[];
  defaultAgentConfigKey?: string;
}): OpenCodeAgentConfigPatch {
  return {
    agent: Object.fromEntries(input.agents.map((agent) => [agent.configKey, createOpenCodeAgentDefinition(agent)])),
    defaultAgent: input.defaultAgentConfigKey,
  };
}

export function findProjectedAgentByConfigKey(
  agents: OpenCodeProjectedAgentConfig[],
  configKey: string,
): OpenCodeProjectedAgentConfig | undefined {
  return agents.find((agent) => agent.configKey === configKey);
}

export function findProjectedAgentByPublicName(
  agents: OpenCodeProjectedAgentConfig[],
  publicName: string,
): OpenCodeProjectedAgentConfig | undefined {
  return agents.find((agent) => agent.publicName === publicName);
}

export function resolveProjectedAgentSelection(
  agents: OpenCodeProjectedAgentConfig[],
  selection: OpenCodeAgentSelectionInput,
): OpenCodeProjectedAgentConfig | undefined {
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
