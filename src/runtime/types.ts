import type {
  AgentExposure,
  AgentProfileSpec,
  AgentTeamDefinition,
  ExecutionMode,
  TeamLibrary,
  TeamRoleKind,
} from "../core";

export interface ProjectedAgent {
  teamId: string;
  teamName: string;
  sourceTeam: AgentTeamDefinition;
  sourceAgentId: string;
  roleKind: TeamRoleKind;
  exposure: AgentExposure;
  selectionPriority?: number;
  surfaceLabel: string;
  description: string;
  sourceAgent: AgentProfileSpec;
}

export interface ProjectedTeam {
  team: AgentTeamDefinition;
  agents: ProjectedAgent[];
  userSelectableAgents: ProjectedAgent[];
  internalAgents: ProjectedAgent[];
}

export interface TeamLibraryProjection {
  library: TeamLibrary;
  teams: ProjectedTeam[];
  agents: ProjectedAgent[];
}

export type SessionBindingSource = "host-agent-selection" | "host-cli" | "plugin-default";

export interface SessionRuntimeBinding {
  sessionID: string;
  teamId: string;
  selectedAgentId: string;
  selectedSurfaceLabel: string;
  mode: ExecutionMode;
  activeOwnerId: string;
  delegatedAgentId?: string;
  source: SessionBindingSource;
}
