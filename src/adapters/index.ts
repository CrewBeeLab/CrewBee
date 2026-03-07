import type {
  HostCapabilityContract,
  RuntimeEvent,
  RuntimeSnapshot,
  TeamExecutionPlan,
  TeamSelection,
  TeamSpec,
} from "../core";

export interface AdapterDefinition {
  hostId: string;
  displayName: string;
  capabilities: HostCapabilityContract;
}

export interface TeamRuntimeBinding {
  selection: TeamSelection;
  team: TeamSpec;
}

export interface AdapterRunContext {
  binding: TeamRuntimeBinding;
  snapshot: RuntimeSnapshot;
}

export interface AdapterRuntimeView {
  context: AdapterRunContext;
  events: RuntimeEvent[];
}

export function createTeamRuntimeBinding(selection: TeamSelection, team: TeamSpec): TeamRuntimeBinding {
  return {
    selection,
    team,
  };
}

export function createAdapterRunContext(plan: TeamExecutionPlan, team: TeamSpec): AdapterRunContext {
  return {
    binding: createTeamRuntimeBinding(plan.selection, team),
    snapshot: {
      teamId: plan.selection.teamId,
      mode: plan.selection.mode,
      activeExecutor: plan.activeExecutorId,
      stage: plan.stage,
      recentActions: [],
    },
  };
}

export function createRuntimeEvents(plan: TeamExecutionPlan): RuntimeEvent[] {
  return [
    {
      type: "team-selected",
      detail: `Selected team ${plan.selection.teamId}.`,
    },
    {
      type: "mode-selected",
      detail: `Selected mode ${plan.selection.mode}.`,
    },
    {
      type: "executor-changed",
      detail: `Active executor is ${plan.activeExecutorId}.`,
    },
    {
      type: "stage-changed",
      detail: `Workflow stage is ${plan.stage}.`,
    },
  ];
}
