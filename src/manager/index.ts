import type {
  ExecutionMode,
  RuntimeSnapshot,
  TeamExecutionPlan,
  TeamLibrary,
  TeamSelection,
  TeamSpec,
} from "../core";

export interface TeamInstallRecord {
  team: TeamSpec;
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
      record.team.id === teamId ? { ...record, enabled: true } : record,
    ),
  };
}

export function disableTeam(state: ManagerState, teamId: string): ManagerState {
  return {
    ...state,
    availableTeams: state.availableTeams.map((record) =>
      record.team.id === teamId ? { ...record, enabled: false } : record,
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

export function resolveSelectedTeam(state: ManagerState): TeamSpec | null {
  const record = state.availableTeams.find((entry) => entry.team.id === state.selectedTeamId && entry.enabled);
  return record ? record.team : null;
}

export function createExecutionPlan(state: ManagerState): TeamExecutionPlan | null {
  const team = resolveSelectedTeam(state);

  if (!team) {
    return null;
  }

  const defaultExecutor = state.selectedMode === "single-executor" ? team.members[0]?.id ?? team.leader.id : team.leader.id;

  return {
    selection: {
      teamId: team.id,
      mode: state.selectedMode,
    },
    activeExecutorId: defaultExecutor,
    stage: team.workflow.stages[0] ?? "intake",
    delegatedByLeader: state.selectedMode === "single-executor",
  };
}

export function updateRuntimeSnapshot(state: ManagerState, snapshot: RuntimeSnapshot): ManagerState {
  return {
    ...state,
    runtime: snapshot,
  };
}
