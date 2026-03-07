export type ExecutionMode = "single-executor" | "team-collaboration";

export type TeamRoleKind = "leader" | "member";

export interface TeamRoleSpec {
  id: string;
  name: string;
  kind: TeamRoleKind;
  responsibility: string;
}

export interface TeamWorkflowSpec {
  id: string;
  name: string;
  stages: string[];
}

export interface ToolDomainPolicy {
  id: string;
  enabledByDefault: boolean;
  description: string;
}

export interface OutputRequirement {
  id: string;
  description: string;
}

export interface TeamSpec {
  id: string;
  name: string;
  description: string;
  scene: string;
  leader: TeamRoleSpec;
  members: TeamRoleSpec[];
  workflow: TeamWorkflowSpec;
  toolDomains: ToolDomainPolicy[];
  outputRequirements: OutputRequirement[];
  delegateFirst: boolean;
  collaborationStyle: string;
}

export interface TeamLibrary {
  version: string;
  teams: TeamSpec[];
}

export interface TeamSelection {
  teamId: string;
  mode: ExecutionMode;
}

export interface TeamExecutionPlan {
  selection: TeamSelection;
  activeExecutorId: string;
  stage: string;
  delegatedByLeader: boolean;
}

export interface RuntimeSnapshot {
  teamId: string;
  mode: ExecutionMode;
  activeExecutor: string;
  stage: string;
  recentActions: string[];
}

export interface HostCapabilityContract {
  supportsAgentRegistration: boolean;
  supportsAgentSwitching: boolean;
  supportsSingleExecutorMode: boolean;
  supportsTeamCollaboration: boolean;
  supportsRuntimeEvents: boolean;
  supportsToolDomainInjection: boolean;
  supportsSessionLogExport: boolean;
}

export interface RuntimeEvent {
  type: "team-selected" | "mode-selected" | "stage-changed" | "executor-changed" | "note";
  detail: string;
}
