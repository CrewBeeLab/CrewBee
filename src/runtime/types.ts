import type {
  AgentExposure,
  AgentProfileSpec,
  AgentTeamDefinition,
  ExecutionMode,
  TeamLibrary,
  TeamRoleKind,
} from "../core";

export interface CatalogAgentProjection {
  teamId: string;
  teamName: string;
  sourceAgentId: string;
  roleKind: TeamRoleKind;
  exposure: AgentExposure;
  surfaceLabel: string;
  description: string;
  sourceAgent: AgentProfileSpec;
}

export interface TeamCatalogProjection {
  team: AgentTeamDefinition;
  agents: CatalogAgentProjection[];
  userSelectableAgents: CatalogAgentProjection[];
  internalAgents: CatalogAgentProjection[];
}

export interface CatalogProjection {
  library: TeamLibrary;
  teams: TeamCatalogProjection[];
  agents: CatalogAgentProjection[];
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
