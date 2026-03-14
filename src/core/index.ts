export type ExecutionMode = "single-executor" | "team-collaboration";

export type TeamRoleKind = "leader" | "member";
export type AgentArchetype =
  | "orchestrator"
  | "planner"
  | "executor"
  | "executor+orchestrator"
  | "researcher"
  | "advisor"
  | "reviewer"
  | "interpreter"
  | "operator";

export interface TeamWorkflowSpec {
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

export interface TeamMemberGuidance {
  responsibility: string;
  delegateWhen: string;
  delegateMode: string;
}

export type TeamMemberMap = Record<string, TeamMemberGuidance>;

export interface AgentRuntimeModelConfig {
  provider: string;
  model: string;
  temperature?: number;
  topP?: number;
  variant?: string;
  options?: Record<string, unknown>;
}

export type TeamAgentRuntimeMap = Record<string, AgentRuntimeModelConfig>;

export interface TeamGovernanceSpec {
  instructionPrecedence: string[];
  approvalPolicy: ApprovalPolicy;
  forbiddenActions: string[];
  qualityFloor: QualityFloor;
  workingRules: string[];
}

export interface TeamManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  mission: TeamMissionSpec;
  scope: TeamScopeSpec;
  leader: TeamLeaderRef;
  members: TeamMemberMap;
  workflow: TeamWorkflowSpec;
  governance: TeamGovernanceSpec;
  agentRuntime?: TeamAgentRuntimeMap;
  tags: string[];
  promptProjection?: PromptProjectionSpec;
}

export interface ApprovalPolicy {
  requiredFor: string[];
  allowAssumeFor: string[];
}

export interface QualityFloor {
  requiredChecks: string[];
  evidenceRequired: boolean;
}

export interface PromptProjectionSpec {
  include?: string[];
  exclude?: string[];
}

export interface PersonaCore {
  temperament: string;
  cognitiveStyle: string;
  riskPosture: string;
  communicationStyle: string;
  persistenceStyle: string;
  conflictStyle?: string;
  decisionPriorities: string[];
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
  runtimeConfig?: Partial<AgentRuntimeConfig>;
  outputContract?: OutputContract;
}

export type CollaborationBindingInput = string | CollaborationBinding;

export interface CollaborationSpec {
  defaultConsults: CollaborationBindingInput[];
  defaultHandoffs: CollaborationBindingInput[];
}

export type AgentPermissionAction = "allow" | "deny" | "ask";

export interface AgentPermissionRule {
  permission: string;
  action: AgentPermissionAction;
  pattern: string;
}

export interface AgentRuntimeConfig {
  requestedTools: string[];
  permission: AgentPermissionRule[];
  skills?: string[];
  memory?: string;
  hooks?: string;
  instructions?: string[];
  mcpServers?: string[];
}

export interface OutputContract {
  tone: string;
  defaultFormat: string;
  updatePolicy: string;
}

export interface AgentExamples {
  goodFit: string[];
  badFit: string[];
}

export interface MinimalOperations {
  autonomyLevel?: string;
  stopConditions?: string[];
  coreOperationSkeleton?: string[];
}

export interface MinimalTemplates {
  explorationChecklist?: string[];
  executionPlan?: string[];
  finalReport?: string[];
}

// Prompt-only guidance for how an agent should prioritize direct tools, skills,
// and delegated help. This does not register or enable capabilities at runtime;
// runtimeConfig.requestedTools and runtimeConfig.skills remain the source of
// truth for actual host/runtime availability.
export interface ToolSkillStrategySpec {
  principles?: string[];
  preferredOrder?: string[];
  avoid?: string[];
  notes?: string[];
}

export interface AgentGuardrails {
  critical?: string[];
}

export interface AgentMetadata {
  id: string;
  name: string;
  archetype: AgentArchetype;
  owner?: string;
  tags?: string[];
}

export type AgentExposure = "user-selectable" | "internal-only";

export interface AgentEntryPointSpec {
  exposure: AgentExposure;
  selectionLabel?: string;
  selectionDescription?: string;
}

export interface AgentProfileSpec {
  metadata: AgentMetadata;
  personaCore: PersonaCore;
  responsibilityCore: ResponsibilityCore;
  collaboration: CollaborationSpec;
  runtimeConfig: AgentRuntimeConfig;
  outputContract: OutputContract;
  operations?: MinimalOperations;
  templates?: MinimalTemplates;
  guardrails?: AgentGuardrails;
  heuristics?: string[];
  antiPatterns?: string[];
  examples?: AgentExamples;
  // Prompt-only strategy text. It must stay consistent with the real runtime
  // capability set declared under runtimeConfig.
  toolSkillStrategy?: ToolSkillStrategySpec;
  entryPoint?: AgentEntryPointSpec;
  promptProjection?: PromptProjectionSpec;
}

export interface TeamDocumentationRefs {
  teamReadme: string;
  agentProfiles?: string[];
}

export interface AgentTeamDefinition {
  manifest: TeamManifest;
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
  activeOwnerId: string;
  stage: string;
  delegatedByLeader: boolean;
}

export interface RuntimeSnapshot {
  teamId: string;
  mode: ExecutionMode;
  activeOwner: string;
  stage: string;
  recentActions: string[];
}

export interface HostCapabilityContract {
  supportsAgentRegistration: boolean;
  supportsAgentSwitching: boolean;
  supportsNativeAgentSelection: boolean;
  supportsNativeModelSelection: boolean;
  supportsCliOverrides: boolean;
  supportsSingleExecutorMode: boolean;
  supportsTeamCollaboration: boolean;
  supportsRuntimeEvents: boolean;
  supportsToolDomainInjection: boolean;
  supportsSessionLogExport: boolean;
}

export interface RuntimeEvent {
  type: "team-selected" | "mode-selected" | "stage-changed" | "owner-changed" | "note";
  detail: string;
}
