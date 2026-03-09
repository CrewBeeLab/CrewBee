import type {
  AgentTeamDefinition,
  ExecutionMode,
  RuntimeSnapshot,
  TeamExecutionPlan,
  TeamLibrary,
  TeamSelection,
} from "../core";

export interface TeamInstallRecord {
  team: AgentTeamDefinition;
  enabled: boolean;
}

export interface ManagerState {
  availableTeams: TeamInstallRecord[];
  selectedTeamId: string | null;
  selectedMode: ExecutionMode;
  runtime: RuntimeSnapshot | null;
}

export interface ManagerConfig {
  defaultTeamId: string | null;
  defaultMode: ExecutionMode;
}

export function createManagerState(teamLibrary: TeamLibrary, config: ManagerConfig): ManagerState {
  return {
    availableTeams: teamLibrary.teams.map((team) => ({ team, enabled: true })),
    selectedTeamId: config.defaultTeamId,
    selectedMode: config.defaultMode,
    runtime: null,
  };
}

export function createTeamSelection(teamId: string, mode: ExecutionMode): TeamSelection {
  return { teamId, mode };
}

export function enableTeam(state: ManagerState, teamId: string): ManagerState {
  return {
    ...state,
    availableTeams: state.availableTeams.map((record) =>
      record.team.manifest.id === teamId ? { ...record, enabled: true } : record,
    ),
  };
}

export function disableTeam(state: ManagerState, teamId: string): ManagerState {
  return {
    ...state,
    availableTeams: state.availableTeams.map((record) =>
      record.team.manifest.id === teamId ? { ...record, enabled: false } : record,
    ),
  };
}

export function selectTeam(state: ManagerState, selection: TeamSelection): ManagerState {
  return {
    ...state,
    selectedTeamId: selection.teamId,
    selectedMode: selection.mode,
  };
}

export function resolveSelectedTeam(state: ManagerState): AgentTeamDefinition | null {
  const record = state.availableTeams.find(
    (entry) => entry.team.manifest.id === state.selectedTeamId && entry.enabled,
  );
  return record ? record.team : null;
}

export function createExecutionPlan(state: ManagerState): TeamExecutionPlan | null {
  const team = resolveSelectedTeam(state);

  if (!team) {
    return null;
  }

  const manifest = team.manifest;

  return {
    selection: {
      teamId: manifest.id,
      mode: state.selectedMode,
    },
    teamName: manifest.name,
    activeExecutorId: manifest.ownershipRouting?.defaultActiveOwner ?? manifest.leader.agentRef,
    stage: manifest.defaultWorkflow[0] ?? manifest.workflow.stages[0] ?? "intake",
    delegatedByLeader: false,
  };
}

export function updateRuntimeSnapshot(state: ManagerState, snapshot: RuntimeSnapshot): ManagerState {
  return {
    ...state,
    runtime: snapshot,
  };
}
