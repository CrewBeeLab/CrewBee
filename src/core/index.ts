export type ExecutionMode = "single-executor" | "team-collaboration";

export type AgentStatus = "active" | "draft" | "deprecated";
export type TeamRoleKind = "leader" | "member";
export type AgentArchetype =
  | "orchestrator"
  | "planner"
  | "executor"
  | "researcher"
  | "advisor"
  | "reviewer"
  | "interpreter"
  | "operator";

export interface TeamWorkflowSpec {
  id: string;
  name: string;
  stages: string[];
}

export interface TeamMissionSpec {
  objective: string;
  successDefinition: string[];
}

export interface TeamScopeSpec {
  inScope: string[];
  outOfScope: string[];
}

export interface TeamLeaderRef {
  agentRef: string;
  responsibilities: string[];
}

export interface TeamMemberRef {
  agentRef: string;
  role: string;
}

export interface TeamOwnershipRouting {
  defaultActiveOwner: string;
  switchToManagementLeaderWhen: string[];
}

export interface TeamRoleBoundaries {
  writeExecutionRoles: string[];
  readOnlySupportRoles: string[];
}

export interface WorkingModeSpec {
  humanToLeaderOnly: boolean;
  leaderDrivenCoordination: boolean;
  singleActiveContextOwner?: boolean;
  agentCommunicationViaSessionContext: boolean;
  explicitRoutingFilesRequired: boolean;
  explicitContractFilesRequired: boolean;
}

export interface ImplementationBiasProfile {
  namingMode: "responsibility-first" | "persona-first" | "hybrid";
  routingPriority: "responsibility-first" | "persona-first" | "balanced";
  promptEmphasis: string;
  displayEmphasis: string;
  personaVisibility: "high" | "balanced" | "low";
  responsibilityVisibility: "high" | "balanced" | "low";
}

export interface SharedRefsSpec {
  policyRef?: string;
  capabilityRef?: string;
  toolsAndSkillsRef?: string;
}

export interface TeamGovernanceSpec {
  instructionPrecedence: string[];
  approvalPolicy: ApprovalPolicy;
  forbiddenActions: string[];
  qualityFloor: QualityFloor;
  workingRules: string[];
}

export interface TeamManifest {
  id: string;
  kind: "agent-team";
  version: string;
  name: string;
  status: AgentStatus;
  owner: string;
  description: string;
  mission: TeamMissionSpec;
  scope: TeamScopeSpec;
  leader: TeamLeaderRef;
  members: TeamMemberRef[];
  modes: ExecutionMode[];
  workingMode: WorkingModeSpec;
  workflow: TeamWorkflowSpec;
  defaultWorkflow: string[];
  implementationBias?: ImplementationBiasProfile;
  ownershipRouting?: TeamOwnershipRouting;
  roleBoundaries?: TeamRoleBoundaries;
  structurePrinciples?: string[];
  governance?: TeamGovernanceSpec;
  sharedRefs?: SharedRefsSpec;
  tags: string[];
}

export interface ApprovalPolicy {
  requiredFor: string[];
  allowAssumeFor: string[];
}

export interface QualityFloor {
  requiredChecks: string[];
  evidenceRequired: boolean;
}

export interface TeamPolicy {
  id: string;
  kind: "team-policy";
  version: string;
  instructionPrecedence: string[];
  approvalPolicy: ApprovalPolicy;
  forbiddenActions: string[];
  qualityFloor: QualityFloor;
  workingRules: string[];
  notes: string[];
}

export interface SharedCapabilities {
  id: string;
  kind: "shared-capabilities";
  version: string;
  models: {
    default: string;
    available: string[];
  };
  tools: {
    defaultProfile: string;
    availableProfiles: string[];
  };
  skills: {
    shared: string[];
  };
  instructionPacks: {
    shared: string[];
  };
  memory: {
    defaultProfile: string;
  };
  hooks: {
    defaultBundle: string;
  };
  mcp: {
    sharedServers: string[];
  };
}

export interface PersonaCore {
  temperament: string;
  cognitiveStyle: string;
  riskPosture: string;
  communicationStyle: string;
  persistenceStyle: string;
  conflictStyle?: string;
  defaultValues: string[];
}

export interface ResponsibilityCore {
  description: string;
  useWhen: string[];
  avoidWhen: string[];
  objective: string;
  successDefinition: string[];
  nonGoals: string[];
  inScope: string[];
  outOfScope: string[];
  authority?: string;
  outputPreference?: string[];
}

export interface CollaborationBinding {
  agentRef: string;
  description: string;
  capabilityBindings?: Partial<CapabilityBindings>;
  workflowOverride?: WorkflowOverride;
  outputContract?: OutputContract;
}

export type CollaborationBindingInput = string | CollaborationBinding;

export interface CollaborationSpec {
  defaultConsults: CollaborationBindingInput[];
  defaultHandoffs: CollaborationBindingInput[];
  escalationTargets: CollaborationBindingInput[];
}

export interface CapabilityBindings {
  modelProfileRef: string;
  toolProfileRef: string;
  skillProfileRefs?: string[];
  memoryProfileRef?: string;
  hookBundleRef?: string;
  instructionPackRefs?: string[];
  mcpServerRefs?: string[];
}

export interface WorkflowOverride {
  deviationsFromArchetypeOnly: {
    autonomyLevel?: string;
    ambiguityPolicy?: string;
    stopConditions?: string[];
  };
}

export interface OutputContract {
  tone: string;
  defaultFormat: string;
  updatePolicy: string;
}

export interface AgentOps {
  evalTags?: string[];
  metrics?: string[];
  changeLog?: string;
}

export interface AgentExamples {
  goodFit: string[];
  badFit: string[];
}

export interface MinimalOperations {
  coreOperationSkeleton?: string[];
}

export interface MinimalTemplates {
  explorationChecklist?: string[];
  executionPlan?: string[];
  finalReport?: string[];
}

export interface AgentGuardrails {
  critical?: string[];
}

export interface AgentMetadata {
  id: string;
  kind: "agent";
  version: string;
  name: string;
  status: AgentStatus;
  archetype: AgentArchetype;
  owner?: string;
  tags?: string[];
}

export interface AgentProfileSpec {
  metadata: AgentMetadata;
  personaCore: PersonaCore;
  responsibilityCore: ResponsibilityCore;
  collaboration: CollaborationSpec;
  capabilityBindings: CapabilityBindings;
  workflowOverride?: WorkflowOverride;
  outputContract: OutputContract;
  ops?: AgentOps;
  operations?: MinimalOperations;
  templates?: MinimalTemplates;
  guardrails?: AgentGuardrails;
  heuristics?: string[];
  antiPatterns?: string[];
  examples?: AgentExamples;
}

export interface TeamDocumentationRefs {
  teamReadme: string;
  agentProfiles?: string[];
}

export interface AgentTeamDefinition {
  manifest: TeamManifest;
  policy: TeamPolicy;
  sharedCapabilities?: SharedCapabilities;
  agents: AgentProfileSpec[];
  documentation?: TeamDocumentationRefs;
}

export interface TeamLibrary {
  version: string;
  teams: AgentTeamDefinition[];
}

export type TeamSpec = TeamManifest;

export interface TeamSelection {
  teamId: string;
  mode: ExecutionMode;
}

export interface TeamExecutionPlan {
  selection: TeamSelection;
  teamName: string;
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
