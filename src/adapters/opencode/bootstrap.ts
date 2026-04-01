import type { AdapterDefinition } from "../index";
import type { ExecutionMode, TeamLibrary } from "../../core";
import type { AvailableToolDefinition } from "../../runtime";
import {
  createTeamLibraryProjection,
  createSessionRuntimeBinding,
  findProjectedAgent,
  pickDefaultUserSelectableAgent,
  type TeamLibraryProjection,
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
  createOpenCodeAgentConfigs,
  createOpenCodeAgentConfigPatch,
  createOpenCodeProjectedIdentities,
  createOpenCodePublicNameAliasKey,
  type OpenCodeAgentConfig,
  resolveProjectedAgentSelection,
  type OpenCodeAgentConfigPatch,
} from "./projection";
import { createOpenCodeToolDomainPlan, type OpenCodeToolDomainPlan } from "./tool-domain";

export interface OpenCodeBootstrapDefaults {
  defaultMode: ExecutionMode;
  defaultTeamId?: string;
}

export interface OpenCodeBootstrapInput {
  teamLibrary: TeamLibrary;
  defaults: OpenCodeBootstrapDefaults;
  availableTools?: readonly (string | AvailableToolDefinition)[];
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
  projection: TeamLibraryProjection;
  projectedAgents: OpenCodeAgentConfig[];
  toolDomainPlan: OpenCodeToolDomainPlan;
  configPatch: OpenCodeAgentConfigPatch;
  mergedConfig?: OpenCodeConfigLike;
  mergeResult?: OpenCodeConfigMergeResult;
  collisions: OpenCodeProjectionCollisionReport;
  sessionBinding?: SessionRuntimeBinding;
}

const CURRENT_PLUGIN_KEY_PREFIX = "crewbee.";
const LEGACY_PLUGIN_KEY_PREFIX = "agentscroll.";

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
  projection: TeamLibraryProjection;
  selectedTeamId?: string;
  selectedSourceAgentId?: string;
  defaults: OpenCodeBootstrapDefaults;
}): { teamId: string; sourceAgentId: string } | undefined {
  if (input.selectedHostAgent) {
    const normalizedHostAgent = input.selectedHostAgent.startsWith(LEGACY_PLUGIN_KEY_PREFIX)
      ? `${CURRENT_PLUGIN_KEY_PREFIX}${input.selectedHostAgent.slice(LEGACY_PLUGIN_KEY_PREFIX.length)}`
      : input.selectedHostAgent;
    const hostSelection = resolveProjectedAgentSelection(input.projectedAgents, {
      configKey: normalizedHostAgent,
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
    const explicit = findProjectedAgent(input.projection, input.selectedTeamId, input.selectedSourceAgentId);
    if (explicit) {
      return {
        teamId: explicit.teamId,
        sourceAgentId: explicit.sourceAgentId,
      };
    }
  }

  const preferredFallbackTeamId = input.defaults.defaultTeamId ?? input.projection.teams[0]?.team.manifest.id;
  const orderedFallbackTeams = preferredFallbackTeamId
    ? [
        ...input.projection.teams.filter((team) => team.team.manifest.id === preferredFallbackTeamId),
        ...input.projection.teams.filter((team) => team.team.manifest.id !== preferredFallbackTeamId),
      ]
    : input.projection.teams;

  for (const fallbackTeam of orderedFallbackTeams) {
    const fallbackAgent = pickDefaultUserSelectableAgent(fallbackTeam.team);
    if (!fallbackAgent) {
      continue;
    }

    return {
      teamId: fallbackTeam.team.manifest.id,
      sourceAgentId: fallbackAgent.metadata.id,
    };
  }

  return undefined;
}

function filterSafeProjectedAgents(
  agents: OpenCodeAgentConfig[],
  collisions: OpenCodeProjectionCollisionReport,
): OpenCodeAgentConfig[] {
  const blockedConfigKeys = new Set(collisions.configKeyCollisions);
  const blockedPublicNames = new Set(collisions.publicNameCollisions);

  return agents.filter((agent) => {
    if (blockedConfigKeys.has(agent.configKey)) {
      return false;
    }

    if (blockedConfigKeys.has(createOpenCodePublicNameAliasKey(agent))) {
      return false;
    }

    return !blockedPublicNames.has(agent.publicName);
  });
}

function isCompatibleCrewBeeOwnedKey(key: string): boolean {
  return key.startsWith(CURRENT_PLUGIN_KEY_PREFIX) || key.startsWith(LEGACY_PLUGIN_KEY_PREFIX);
}

function getConfiguredAgentName(definition: unknown): string | undefined {
  if (typeof definition !== "object" || definition === null || !("name" in definition)) {
    return undefined;
  }

  const candidate = definition.name;
  return typeof candidate === "string" ? candidate : undefined;
}

function isCrewBeePublicNameAliasEntry(
  key: string,
  definition: unknown,
  allAgents: Record<string, unknown>,
): boolean {
  const publicName = getConfiguredAgentName(definition);

  if (!publicName || key !== publicName || !publicName.startsWith("[")) {
    return false;
  }

  return Object.entries(allAgents).some(([otherKey, otherDefinition]) => {
    if (!isCompatibleCrewBeeOwnedKey(otherKey)) {
      return false;
    }

    return getConfiguredAgentName(otherDefinition) === publicName;
  });
}

function getForeignCollisionInputs(input: {
  existingConfig?: OpenCodeConfigLike;
  existingConfigKeys?: string[];
  existingPublicNames?: string[];
}): { existingConfigKeys?: string[]; existingPublicNames?: string[] } {
  if (!input.existingConfig?.agent) {
    return {
      existingConfigKeys: input.existingConfigKeys,
      existingPublicNames: input.existingPublicNames,
    };
  }

  const compatibleOwnedConfigKeys = new Set<string>();
  const compatibleOwnedPublicNames = new Set<string>();

  for (const [key, definition] of Object.entries(input.existingConfig.agent)) {
    if (!isCompatibleCrewBeeOwnedKey(key) && !isCrewBeePublicNameAliasEntry(key, definition, input.existingConfig.agent)) {
      continue;
    }

    compatibleOwnedConfigKeys.add(key);

    const publicName = getConfiguredAgentName(definition);
    if (publicName) {
      compatibleOwnedPublicNames.add(publicName);
    }
  }

  return {
    existingConfigKeys: input.existingConfigKeys?.filter((key) => !compatibleOwnedConfigKeys.has(key)),
    existingPublicNames: input.existingPublicNames?.filter((name) => !compatibleOwnedPublicNames.has(name)),
  };
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

  if (isCompatibleCrewBeeOwnedKey(input.existingDefaultAgent)) {
    return input.defaultAgentConfigKey;
  }

  return undefined;
}

export function createOpenCodeBootstrap(input: OpenCodeBootstrapInput): OpenCodeBootstrapOutput {
  const projection = createTeamLibraryProjection(input.teamLibrary);
  const toolDomainPlan = createOpenCodeToolDomainPlan();
  const projectedAgents = createOpenCodeAgentConfigs(projection, {
    availableTools: input.availableTools,
  });
  const foreignCollisions = getForeignCollisionInputs({
    existingConfig: input.existingConfig,
    existingConfigKeys: input.existingConfigKeys,
    existingPublicNames: input.existingPublicNames,
  });
  const collisions = detectOpenCodeProjectionCollisions({
    projectedAgents: projectedAgents.flatMap((agent) => createOpenCodeProjectedIdentities(agent)),
    existingConfigKeys: foreignCollisions.existingConfigKeys,
    existingPublicNames: foreignCollisions.existingPublicNames,
  });
  const safeProjectedAgents = filterSafeProjectedAgents(projectedAgents, collisions);

  const bindingAgent = resolveBindingAgent({
    projectedAgents: safeProjectedAgents,
    selectedHostAgent: input.selectedHostAgent,
    projection,
    selectedTeamId: input.selectedTeamId,
    selectedSourceAgentId: input.selectedSourceAgentId,
    defaults: input.defaults,
  });

  const sessionBinding = input.sessionID && bindingAgent
    ? createSessionRuntimeBinding({
        projection,
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
    projection,
    projectedAgents: safeProjectedAgents,
    toolDomainPlan,
    configPatch,
    mergedConfig: mergeResult?.config,
    mergeResult,
    collisions,
    sessionBinding,
  };
}
