import type { AdapterDefinition } from "../index";
import type { ExecutionMode, TeamLibrary } from "../../core";
import {
  createCatalogProjection,
  createSessionRuntimeBinding,
  findCatalogAgent,
  pickDefaultUserSelectableAgent,
  type CatalogProjection,
  type SessionRuntimeBinding,
} from "../../runtime";

import { createOpenCodeCapabilityContract } from "./capabilities";
import { applyOpenCodeAgentConfigPatch, type OpenCodeConfigLike, type OpenCodeConfigMergeResult } from "./config-merge";
import {
  createOpenCodeCoexistencePolicy,
  detectOpenCodeProjectionCollisions,
  type OpenCodeProjectionCollisionReport,
} from "./coexistence";
import {
  createOpenCodeAgentConfigPatch,
  projectCatalogToOpenCodeAgents,
  resolveProjectedAgentSelection,
  type OpenCodeAgentConfigPatch,
  type OpenCodeAgentConfig,
} from "./projection";

export interface OpenCodeAdapterDefaults {
  defaultMode: ExecutionMode;
  defaultTeamId?: string;
}

export interface OpenCodeBootstrapInput {
  teamLibrary: TeamLibrary;
  defaults: OpenCodeAdapterDefaults;
  existingConfig?: OpenCodeConfigLike;
  existingConfigKeys?: string[];
  existingPublicNames?: string[];
  existingDefaultAgent?: string;
  sessionID?: string;
  selectedHostAgent?: string;
  selectedTeamId?: string;
  selectedSourceAgentId?: string;
  selectedMode?: ExecutionMode;
}

export interface OpenCodeBootstrapOutput {
  adapter: AdapterDefinition;
  catalog: CatalogProjection;
  projectedAgents: OpenCodeAgentConfig[];
  configPatch: OpenCodeAgentConfigPatch;
  mergedConfig?: OpenCodeConfigLike;
  mergeResult?: OpenCodeConfigMergeResult;
  collisions: OpenCodeProjectionCollisionReport;
  sessionBinding?: SessionRuntimeBinding;
}

export function createOpenCodeAdapterDefinition(): AdapterDefinition {
  const coexistence = createOpenCodeCoexistencePolicy();

  return {
    hostId: "opencode",
    displayName: "OpenCode",
    capabilities: createOpenCodeCapabilityContract(),
    entryModel: {
      hostOwnsPrimaryEntry: true,
      usesNativeAgentSelection: true,
      usesNativeModelSelection: true,
      usesHostCli: true,
      requiresCustomManagerEntry: false,
    },
    coexistence: {
      independentFromForeignPlugins: true,
      safeWhenCoInstalled: coexistence.safeWhenCoInstalled,
      reservedAgentNamePrefix: coexistence.reservedPublicNamePrefix,
      reservedConfigKeyPrefix: coexistence.reservedConfigKeyPrefix,
    },
  };
}

function resolveBindingAgent(input: {
  projectedAgents: OpenCodeAgentConfig[];
  selectedHostAgent?: string;
  catalog: CatalogProjection;
  selectedTeamId?: string;
  selectedSourceAgentId?: string;
  defaults: OpenCodeAdapterDefaults;
}): { teamId: string; sourceAgentId: string } | undefined {
  if (input.selectedHostAgent) {
    const hostSelection = resolveProjectedAgentSelection(input.projectedAgents, {
      configKey: input.selectedHostAgent,
      publicName: input.selectedHostAgent,
    });

    if (hostSelection) {
      return {
        teamId: hostSelection.teamId,
        sourceAgentId: hostSelection.sourceAgentId,
      };
    }
  }

  if (input.selectedTeamId && input.selectedSourceAgentId) {
    const explicit = findCatalogAgent(input.catalog, input.selectedTeamId, input.selectedSourceAgentId);
    if (explicit) {
      return {
        teamId: explicit.teamId,
        sourceAgentId: explicit.sourceAgentId,
      };
    }
  }

  const fallbackTeamId = input.defaults.defaultTeamId ?? input.catalog.teams[0]?.team.manifest.id;
  const fallbackTeam = input.catalog.teams.find((team) => team.team.manifest.id === fallbackTeamId);
  const fallbackAgent = fallbackTeam ? pickDefaultUserSelectableAgent(fallbackTeam.team) : undefined;

  if (!fallbackTeam || !fallbackAgent) {
    return undefined;
  }

  return {
    teamId: fallbackTeam.team.manifest.id,
    sourceAgentId: fallbackAgent.metadata.id,
  };
}

function filterSafeProjectedAgents(
  agents: OpenCodeAgentConfig[],
  collisions: OpenCodeProjectionCollisionReport,
): OpenCodeAgentConfig[] {
  const blockedConfigKeys = new Set(collisions.configKeyCollisions);
  const blockedPublicNames = new Set(collisions.publicNameCollisions);

  return agents.filter((agent) => !blockedConfigKeys.has(agent.configKey) && !blockedPublicNames.has(agent.publicName));
}

function shouldSetDefaultAgent(input: {
  existingDefaultAgent?: string;
  defaultAgentConfigKey?: string;
}): string | undefined {
  if (!input.defaultAgentConfigKey) {
    return undefined;
  }

  if (!input.existingDefaultAgent) {
    return input.defaultAgentConfigKey;
  }

  if (input.existingDefaultAgent.startsWith("agentscroll.")) {
    return input.defaultAgentConfigKey;
  }

  return undefined;
}

export function createOpenCodeBootstrap(input: OpenCodeBootstrapInput): OpenCodeBootstrapOutput {
  const catalog = createCatalogProjection(input.teamLibrary);
  const projectedAgents = projectCatalogToOpenCodeAgents(catalog);
  const collisions = detectOpenCodeProjectionCollisions({
    projectedAgents: projectedAgents.map((agent) => ({
      configKey: agent.configKey,
      publicName: agent.publicName,
    })),
    existingConfigKeys: input.existingConfigKeys,
    existingPublicNames: input.existingPublicNames,
  });
  const safeProjectedAgents = filterSafeProjectedAgents(projectedAgents, collisions);

  const bindingAgent = resolveBindingAgent({
    projectedAgents: safeProjectedAgents,
    selectedHostAgent: input.selectedHostAgent,
    catalog,
    selectedTeamId: input.selectedTeamId,
    selectedSourceAgentId: input.selectedSourceAgentId,
    defaults: input.defaults,
  });

  const sessionBinding = input.sessionID && bindingAgent
    ? createSessionRuntimeBinding({
        projection: catalog,
        sessionID: input.sessionID,
        teamId: bindingAgent.teamId,
        sourceAgentId: bindingAgent.sourceAgentId,
        mode: input.selectedMode ?? input.defaults.defaultMode,
        source: input.selectedHostAgent || input.selectedSourceAgentId ? "host-agent-selection" : "plugin-default",
      })
    : undefined;

  const defaultProjectedAgent = bindingAgent
    ? safeProjectedAgents.find(
        (agent) => agent.teamId === bindingAgent.teamId && agent.sourceAgentId === bindingAgent.sourceAgentId,
      )
    : undefined;

  const configPatch = createOpenCodeAgentConfigPatch({
    agents: safeProjectedAgents,
    defaultAgentConfigKey: shouldSetDefaultAgent({
      existingDefaultAgent: input.existingDefaultAgent ?? input.existingConfig?.default_agent,
      defaultAgentConfigKey: defaultProjectedAgent?.configKey,
    }),
  });

  const mergeResult = input.existingConfig ? applyOpenCodeAgentConfigPatch(input.existingConfig, configPatch) : undefined;

  return {
    adapter: createOpenCodeAdapterDefinition(),
    catalog,
    projectedAgents: safeProjectedAgents,
    configPatch,
    mergedConfig: mergeResult?.config,
    mergeResult,
    collisions,
    sessionBinding,
  };
}
