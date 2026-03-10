import type {
  AgentProfileSpec,
  AgentTeamDefinition,
  ExecutionMode,
  TeamLibrary,
  TeamRoleKind,
} from "../core";

import type {
  CatalogAgentProjection,
  CatalogProjection,
  SessionBindingSource,
  SessionRuntimeBinding,
  TeamCatalogProjection,
} from "./types";

function isLeaderAgent(team: AgentTeamDefinition, agent: AgentProfileSpec): boolean {
  return team.manifest.leader.agentRef === agent.metadata.id;
}

function getSurfaceLabel(agent: AgentProfileSpec): string {
  return agent.entryPoint?.selectionLabel ?? agent.metadata.id;
}

function getExposure(agent: AgentProfileSpec): CatalogAgentProjection["exposure"] {
  return agent.entryPoint?.exposure ?? "internal-only";
}

function getProjectionDescription(agent: AgentProfileSpec): string {
  return agent.entryPoint?.selectionDescription ?? agent.responsibilityCore.description;
}

export function createCatalogAgentProjection(
  team: AgentTeamDefinition,
  agent: AgentProfileSpec,
): CatalogAgentProjection {
  const roleKind: TeamRoleKind = isLeaderAgent(team, agent) ? "leader" : "member";

  return {
    teamId: team.manifest.id,
    teamName: team.manifest.name,
    sourceAgentId: agent.metadata.id,
    roleKind,
    exposure: getExposure(agent),
    surfaceLabel: getSurfaceLabel(agent),
    description: getProjectionDescription(agent),
    sourceAgent: agent,
  };
}

export function createTeamCatalogProjection(team: AgentTeamDefinition): TeamCatalogProjection {
  const agents = team.agents.map((agent) => createCatalogAgentProjection(team, agent));

  return {
    team,
    agents,
    userSelectableAgents: agents.filter((agent) => agent.exposure === "user-selectable"),
    internalAgents: agents.filter((agent) => agent.exposure !== "user-selectable"),
  };
}

export function createCatalogProjection(library: TeamLibrary): CatalogProjection {
  const teams = library.teams.map((team) => createTeamCatalogProjection(team));

  return {
    library,
    teams,
    agents: teams.flatMap((team) => team.agents),
  };
}

export function findCatalogAgent(
  projection: CatalogProjection,
  teamId: string,
  sourceAgentId: string,
): CatalogAgentProjection | undefined {
  return projection.agents.find((agent) => agent.teamId === teamId && agent.sourceAgentId === sourceAgentId);
}

export function createSessionRuntimeBinding(input: {
  projection: CatalogProjection;
  sessionID: string;
  teamId: string;
  sourceAgentId: string;
  mode: ExecutionMode;
  source: SessionBindingSource;
}): SessionRuntimeBinding {
  const selectedAgent = findCatalogAgent(input.projection, input.teamId, input.sourceAgentId);

  if (!selectedAgent) {
    throw new Error(`Unknown projected agent ${input.teamId}/${input.sourceAgentId}.`);
  }

  return {
    sessionID: input.sessionID,
    teamId: input.teamId,
    selectedAgentId: selectedAgent.sourceAgentId,
    selectedSurfaceLabel: selectedAgent.surfaceLabel,
    mode: input.mode,
    activeOwnerId: selectedAgent.sourceAgentId,
    source: input.source,
  };
}

export function pickDefaultUserSelectableAgent(team: AgentTeamDefinition): AgentProfileSpec | undefined {
  return team.agents.find((agent) => agent.entryPoint?.exposure === "user-selectable");
}
