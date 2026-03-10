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
import {
  createOpenCodeCoexistencePolicy,
  detectOpenCodeProjectionCollisions,
  type OpenCodeProjectionCollisionReport,
} from "./coexistence";
import { projectCatalogToOpenCodeAgents, type OpenCodeProjectedAgentConfig } from "./projection";

export interface OpenCodeAdapterDefaults {
  defaultMode: ExecutionMode;
  defaultTeamId?: string;
}

export interface OpenCodeBootstrapInput {
  teamLibrary: TeamLibrary;
  defaults: OpenCodeAdapterDefaults;
  existingConfigKeys?: string[];
  existingPublicNames?: string[];
  sessionID?: string;
  selectedTeamId?: string;
  selectedSourceAgentId?: string;
  selectedMode?: ExecutionMode;
}

export interface OpenCodeBootstrapOutput {
  adapter: AdapterDefinition;
  catalog: CatalogProjection;
  projectedAgents: OpenCodeProjectedAgentConfig[];
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
  catalog: CatalogProjection;
  selectedTeamId?: string;
  selectedSourceAgentId?: string;
  defaults: OpenCodeAdapterDefaults;
}): { teamId: string; sourceAgentId: string } | undefined {
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

export function createOpenCodeBootstrap(input: OpenCodeBootstrapInput): OpenCodeBootstrapOutput {
  const catalog = createCatalogProjection(input.teamLibrary);
  const projectedAgents = projectCatalogToOpenCodeAgents(catalog);
  const collisions = detectOpenCodeProjectionCollisions({
    projectedAgents,
    existingConfigKeys: input.existingConfigKeys,
    existingPublicNames: input.existingPublicNames,
  });

  const bindingAgent = resolveBindingAgent({
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
        source: input.selectedSourceAgentId ? "host-agent-selection" : "plugin-default",
      })
    : undefined;

  return {
    adapter: createOpenCodeAdapterDefinition(),
    catalog,
    projectedAgents,
    collisions,
    sessionBinding,
  };
}
