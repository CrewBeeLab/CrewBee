import type {
  AgentProfileSpec,
  AgentTeamDefinition,
  ExecutionMode,
  TeamLibrary,
  TeamRoleKind,
} from "../core";

import type {
  ProjectedAgent,
  ProjectedTeam,
  SessionBindingSource,
  SessionRuntimeBinding,
  TeamLibraryProjection,
} from "./types";

function isLeaderAgent(team: AgentTeamDefinition, agent: AgentProfileSpec): boolean {
  return team.manifest.leader.agentRef === agent.metadata.id;
}

function getExposure(agent: AgentProfileSpec): ProjectedAgent["exposure"] {
  return agent.entryPoint?.exposure ?? "internal-only";
}

function getProjectionDescription(agent: AgentProfileSpec): string {
  return agent.entryPoint?.selectionDescription ?? agent.responsibilityCore.description;
}

function getLeaderSortRank(team: AgentTeamDefinition, agent: AgentProfileSpec): number {
  return isLeaderAgent(team, agent) ? 0 : 1;
}

function getSelectionPriority(agent: AgentProfileSpec): number {
  return agent.entryPoint?.selectionPriority ?? Number.POSITIVE_INFINITY;
}

function sortTeamAgents(team: AgentTeamDefinition): AgentProfileSpec[] {
  return team.agents
    .map((agent, index) => ({ agent, index }))
    .sort((left, right) => {
      const leaderOrder = getLeaderSortRank(team, left.agent) - getLeaderSortRank(team, right.agent);
      if (leaderOrder !== 0) {
        return leaderOrder;
      }

      const priorityOrder = getSelectionPriority(left.agent) - getSelectionPriority(right.agent);
      if (priorityOrder !== 0) {
        return priorityOrder;
      }

      return left.index - right.index;
    })
    .map(({ agent }) => agent);
}

export function createProjectedAgent(
  team: AgentTeamDefinition,
  agent: AgentProfileSpec,
): ProjectedAgent {
  const roleKind: TeamRoleKind = isLeaderAgent(team, agent) ? "leader" : "member";
  const canonicalAgentId = agent.canonicalAgentId ?? agent.metadata.id;

  return {
    teamId: team.manifest.id,
    teamName: team.manifest.name,
    sourceTeam: team,
    canonicalAgentId,
    roleKind,
    exposure: getExposure(agent),
    selectionPriority: agent.entryPoint?.selectionPriority,
    description: getProjectionDescription(agent),
    sourceAgent: agent,
  };
}

export function createProjectedTeam(team: AgentTeamDefinition): ProjectedTeam {
  const agents = sortTeamAgents(team).map((agent) => createProjectedAgent(team, agent));

  return {
    team,
    agents,
    userSelectableAgents: agents.filter((agent) => agent.exposure === "user-selectable"),
    internalAgents: agents.filter((agent) => agent.exposure !== "user-selectable"),
  };
}

export function createTeamLibraryProjection(library: TeamLibrary): TeamLibraryProjection {
  const teams = library.teams.map((team) => createProjectedTeam(team));

  return {
    library,
    teams,
    agents: teams.flatMap((team) => team.agents),
  };
}

export function findProjectedAgent(
  projection: TeamLibraryProjection,
  teamId: string,
  canonicalAgentId: string,
): ProjectedAgent | undefined {
  return projection.agents.find((agent) => agent.teamId === teamId && agent.canonicalAgentId === canonicalAgentId);
}

export function createSessionRuntimeBinding(input: {
  projection: TeamLibraryProjection;
  sessionID: string;
  teamId: string;
  canonicalAgentId: string;
  mode: ExecutionMode;
  source: SessionBindingSource;
}): SessionRuntimeBinding {
  const selectedAgent = findProjectedAgent(input.projection, input.teamId, input.canonicalAgentId);

  if (!selectedAgent) {
    throw new Error(`Unknown projected agent ${input.teamId}/${input.canonicalAgentId}.`);
  }

  return {
    sessionID: input.sessionID,
    teamId: input.teamId,
    selectedAgentId: selectedAgent.canonicalAgentId,
    mode: input.mode,
    activeOwnerId: selectedAgent.canonicalAgentId,
    source: input.source,
  };
}

export function pickDefaultUserSelectableAgent(team: AgentTeamDefinition): AgentProfileSpec | undefined {
  const leader = team.agents.find(
    (agent) => isLeaderAgent(team, agent) && agent.entryPoint?.exposure === "user-selectable",
  );

  if (leader) {
    return leader;
  }

  return sortTeamAgents(team).find((agent) => agent.entryPoint?.exposure === "user-selectable");
}
