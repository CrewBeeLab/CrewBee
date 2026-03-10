import type {
  AgentTeamDefinition,
  HostCapabilityContract,
  RuntimeEvent,
  RuntimeSnapshot,
  TeamExecutionPlan,
  TeamSelection,
} from "../core";

export interface AdapterDefinition {
  hostId: string;
  displayName: string;
  capabilities: HostCapabilityContract;
  entryModel?: {
    hostOwnsPrimaryEntry: boolean;
    usesNativeAgentSelection: boolean;
    usesNativeModelSelection: boolean;
    usesHostCli: boolean;
    requiresCustomManagerEntry: boolean;
  };
  coexistence?: {
    independentFromForeignPlugins: boolean;
    safeWhenCoInstalled: boolean;
    reservedAgentNamePrefix?: string;
    reservedConfigKeyPrefix?: string;
  };
}

export interface TeamRuntimeBinding {
  selection: TeamSelection;
  team: AgentTeamDefinition;
}

export interface AdapterRunContext {
  binding: TeamRuntimeBinding;
  snapshot: RuntimeSnapshot;
}

export interface AdapterRuntimeView {
  context: AdapterRunContext;
  events: RuntimeEvent[];
}

export function createTeamRuntimeBinding(selection: TeamSelection, team: AgentTeamDefinition): TeamRuntimeBinding {
  return {
    selection,
    team,
  };
}

export function createAdapterRunContext(plan: TeamExecutionPlan, team: AgentTeamDefinition): AdapterRunContext {
  return {
    binding: createTeamRuntimeBinding(plan.selection, team),
    snapshot: {
      teamId: plan.selection.teamId,
      mode: plan.selection.mode,
      activeOwner: plan.activeOwnerId,
      stage: plan.stage,
      recentActions: [],
    },
  };
}

export function createRuntimeEvents(plan: TeamExecutionPlan): RuntimeEvent[] {
  return [
    {
      type: "team-selected",
      detail: `Selected team ${plan.teamName} (${plan.selection.teamId}).`,
    },
    {
      type: "mode-selected",
      detail: `Selected mode ${plan.selection.mode}.`,
    },
    {
      type: "owner-changed",
      detail: `Active owner is ${plan.activeOwnerId}.`,
    },
    {
      type: "stage-changed",
      detail: `Workflow stage is ${plan.stage}.`,
    },
  ];
}

export * from "./opencode";
