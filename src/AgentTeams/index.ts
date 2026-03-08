import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import type {
  AgentExamples,
  AgentGuardrails,
  AgentOps,
  AgentProfileSpec,
  AgentTeamDefinition,
  CapabilityBindings,
  CollaborationBinding,
  CollaborationBindingInput,
  MinimalOperations,
  MinimalTemplates,
  OutputContract,
  SharedCapabilities,
  TeamDocumentationRefs,
  TeamLibrary,
  TeamManifest,
  TeamPolicy,
  WorkflowOverride,
} from "../core";

export const TEAM_CONFIG_ROOT = "AgentTeams";
export const EMBEDDED_TEAM_IDS = ["coding-team"] as const;
export const PUBLIC_CONFIG_TEAM_DIRS = ["GeneralTeam", "WukongTeam"] as const;

export interface TeamValidationIssue {
  level: "error" | "warning";
  message: string;
  filePath?: string;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as UnknownRecord;
}

function asOptionalRecord(value: unknown): UnknownRecord | undefined {
  if (!value) {
    return undefined;
  }

  return asRecord(value, "record");
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  return value;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function asStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.map((entry, index) => asString(entry, `${label}[${index}]`));
}

function readTextFile(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function parseYamlFile(filePath: string): UnknownRecord {
  return asRecord(parseYaml(readTextFile(filePath)), filePath);
}

function parseFrontmatter(filePath: string): { data: UnknownRecord; body: string } {
  const text = readTextFile(filePath);
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!match) {
    throw new Error(`${filePath} is missing YAML frontmatter.`);
  }

  return {
    data: asRecord(parseYaml(match[1]), `${filePath} frontmatter`),
    body: match[2],
  };
}

function extractSection(body: string, title: string): string | undefined {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`, "m");
  const match = body.match(regex);
  return match?.[1]?.trim();
}

function extractSubsection(section: string, title: string): string | undefined {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^###\\s+${escaped}\\s*$([\\s\\S]*?)(?=^###\\s+|^##\\s+|\\Z)`, "m");
  const match = section.match(regex);
  return match?.[1]?.trim();
}

function extractBullets(section?: string): string[] {
  if (!section) {
    return [];
  }

  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function extractNumbered(section?: string): string[] {
  if (!section) {
    return [];
  }

  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s+/, "").trim());
}

function extractLabelList(section: string | undefined, label: string): string[] {
  if (!section) {
    return [];
  }

  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped}[：:]\\s*$([\\s\\S]*?)(?=^[^\\s-].*[：:]\\s*$|^###\\s+|^##\\s+|\\Z)`, "m");
  const match = section.match(regex);
  return extractBullets(match?.[1]?.trim());
}

function extractExamples(section?: string): AgentExamples | undefined {
  if (!section) {
    return undefined;
  }

  const goodFit = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- Good fit:"))
    .map((line) => line.replace("- Good fit:", "").trim());
  const badFit = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- Bad fit:"))
    .map((line) => line.replace("- Bad fit:", "").trim());

  if (goodFit.length === 0 && badFit.length === 0) {
    return undefined;
  }

  return { goodFit, badFit };
}

function mapCapabilityBindings(raw: UnknownRecord | undefined): CapabilityBindings | undefined {
  if (!raw) {
    return undefined;
  }

  return {
    modelProfileRef: asString(raw.model_profile_ref ?? raw.modelProfileRef, "model_profile_ref"),
    toolProfileRef: asString(raw.tool_profile_ref ?? raw.toolProfileRef, "tool_profile_ref"),
    skillProfileRefs: raw.skill_profile_refs ?? raw.skillProfileRefs ? asStringArray(raw.skill_profile_refs ?? raw.skillProfileRefs, "skill_profile_refs") : undefined,
    memoryProfileRef: asOptionalString(raw.memory_profile_ref ?? raw.memoryProfileRef),
    hookBundleRef: asOptionalString(raw.hook_bundle_ref ?? raw.hookBundleRef),
    instructionPackRefs:
      raw.instruction_pack_refs ?? raw.instructionPackRefs
        ? asStringArray(raw.instruction_pack_refs ?? raw.instructionPackRefs, "instruction_pack_refs")
        : undefined,
    mcpServerRefs: raw.mcp_server_refs ?? raw.mcpServerRefs ? asStringArray(raw.mcp_server_refs ?? raw.mcpServerRefs, "mcp_server_refs") : undefined,
  };
}

function mapWorkflowOverride(raw: UnknownRecord | undefined): WorkflowOverride | undefined {
  if (!raw) {
    return undefined;
  }

  const deviations = asOptionalRecord(raw.deviations_from_archetype_only ?? raw.deviationsFromArchetypeOnly);

  if (!deviations) {
    return undefined;
  }

  return {
    deviationsFromArchetypeOnly: {
      autonomyLevel: asOptionalString(deviations.autonomy_level ?? deviations.autonomyLevel),
      ambiguityPolicy: asOptionalString(deviations.ambiguity_policy ?? deviations.ambiguityPolicy),
      stopConditions:
        deviations.stop_conditions ?? deviations.stopConditions
          ? asStringArray(deviations.stop_conditions ?? deviations.stopConditions, "stop_conditions")
          : undefined,
    },
  };
}

function mapOutputContract(raw: UnknownRecord | undefined): OutputContract | undefined {
  if (!raw) {
    return undefined;
  }

  return {
    tone: asString(raw.tone, "tone"),
    defaultFormat: asString(raw.default_format ?? raw.defaultFormat, "default_format"),
    updatePolicy: asString(raw.update_policy ?? raw.updatePolicy, "update_policy"),
  };
}

function mapCollaborationBinding(entry: unknown): CollaborationBindingInput {
  if (typeof entry === "string") {
    return entry;
  }

  const record = asRecord(entry, "collaboration binding");

  return {
    agentRef: asString(record.agent_ref ?? record.agentRef, "agent_ref"),
    description: asString(record.description, "description"),
    capabilityBindings: mapCapabilityBindings(asOptionalRecord(record.capability_bindings ?? record.capabilityBindings)),
    workflowOverride: mapWorkflowOverride(asOptionalRecord(record.workflow_override ?? record.workflowOverride)),
    outputContract: mapOutputContract(asOptionalRecord(record.output_contract ?? record.outputContract)),
  };
}

function mapCollaboration(raw: UnknownRecord): AgentProfileSpec["collaboration"] {
  const mapList = (value: unknown, label: string): CollaborationBindingInput[] => {
    if (!Array.isArray(value)) {
      throw new Error(`${label} must be an array.`);
    }

    return value.map(mapCollaborationBinding);
  };

  return {
    defaultConsults: mapList(raw.default_consults ?? raw.defaultConsults ?? [], "default_consults"),
    defaultHandoffs: mapList(raw.default_handoffs ?? raw.defaultHandoffs ?? [], "default_handoffs"),
    escalationTargets: mapList(raw.escalation_targets ?? raw.escalationTargets ?? [], "escalation_targets"),
  };
}

function mapAgentOps(raw: UnknownRecord | undefined): AgentOps | undefined {
  if (!raw) {
    return undefined;
  }

  return {
    evalTags: raw.eval_tags ?? raw.evalTags ? asStringArray(raw.eval_tags ?? raw.evalTags, "eval_tags") : undefined,
    metrics: raw.metrics ? asStringArray(raw.metrics, "metrics") : undefined,
    changeLog: asOptionalString(raw.change_log ?? raw.changeLog),
  };
}

function mapMinimalOperations(raw: UnknownRecord | undefined, body: string): MinimalOperations | undefined {
  const bodySection = extractSection(body, "Minimal Operations");
  const bodySkeleton = extractNumbered(extractSubsection(bodySection ?? "", "Core Operation Skeleton"));
  const frontmatterSkeleton = raw?.core_operation_skeleton ?? raw?.coreOperationSkeleton;
  const coreOperationSkeleton = frontmatterSkeleton
    ? asStringArray(frontmatterSkeleton, "core_operation_skeleton")
    : bodySkeleton;

  if (coreOperationSkeleton.length === 0) {
    return undefined;
  }

  return { coreOperationSkeleton };
}

function mapMinimalTemplates(raw: UnknownRecord | undefined, body: string): MinimalTemplates | undefined {
  const bodySection = extractSection(body, "Minimal Templates");
  const explorationChecklist = raw?.exploration_checklist ?? raw?.explorationChecklist
    ? asStringArray(raw.exploration_checklist ?? raw.explorationChecklist, "exploration_checklist")
    : extractLabelList(bodySection, "探索清单模板");
  const executionPlan = raw?.execution_plan ?? raw?.executionPlan
    ? asStringArray(raw.execution_plan ?? raw.executionPlan, "execution_plan")
    : extractLabelList(bodySection, "执行计划模板");
  const finalReport = raw?.final_report ?? raw?.finalReport
    ? asStringArray(raw.final_report ?? raw.finalReport, "final_report")
    : extractLabelList(bodySection, "最终汇报模板");

  if (explorationChecklist.length === 0 && executionPlan.length === 0 && finalReport.length === 0) {
    return undefined;
  }

  return { explorationChecklist, executionPlan, finalReport };
}

function mapGuardrails(raw: UnknownRecord | undefined, body: string): AgentGuardrails | undefined {
  const bodySection = extractSection(body, "Critical Guardrails");
  const critical = raw?.critical ? asStringArray(raw.critical, "critical") : extractBullets(bodySection);

  if (critical.length === 0) {
    return undefined;
  }

  return { critical };
}

function mapAgentProfile(filePath: string): AgentProfileSpec {
  const { data, body } = parseFrontmatter(filePath);
  const personaCore = asRecord(data.persona_core ?? data.personaCore, "persona_core");
  const responsibilityCore = asRecord(data.responsibility_core ?? data.responsibilityCore, "responsibility_core");
  const collaboration = asRecord(data.collaboration, "collaboration");
  const capabilityBindings = asRecord(data.capability_bindings ?? data.capabilityBindings, "capability_bindings");

  return {
    metadata: {
      id: asString(data.id, "id"),
      kind: "agent",
      version: asString(data.version, "version"),
      name: asString(data.name, "name"),
      status: asString(data.status, "status") as AgentProfileSpec["metadata"]["status"],
      archetype: asString(data.archetype, "archetype") as AgentProfileSpec["metadata"]["archetype"],
      owner: asOptionalString(data.owner),
      tags: data.tags ? asStringArray(data.tags, "tags") : undefined,
    },
    personaCore: {
      temperament: asString(personaCore.temperament, "persona_core.temperament"),
      cognitiveStyle: asString(personaCore.cognitive_style ?? personaCore.cognitiveStyle, "persona_core.cognitive_style"),
      riskPosture: asString(personaCore.risk_posture ?? personaCore.riskPosture, "persona_core.risk_posture"),
      communicationStyle: asString(personaCore.communication_style ?? personaCore.communicationStyle, "persona_core.communication_style"),
      persistenceStyle: asString(personaCore.persistence_style ?? personaCore.persistenceStyle, "persona_core.persistence_style"),
      conflictStyle: asOptionalString(personaCore.conflict_style ?? personaCore.conflictStyle),
      defaultValues: asStringArray(personaCore.default_values ?? personaCore.defaultValues, "persona_core.default_values"),
    },
    responsibilityCore: {
      description: asString(responsibilityCore.description, "responsibility_core.description"),
      useWhen: asStringArray(responsibilityCore.use_when ?? responsibilityCore.useWhen, "responsibility_core.use_when"),
      avoidWhen: asStringArray(responsibilityCore.avoid_when ?? responsibilityCore.avoidWhen, "responsibility_core.avoid_when"),
      objective: asString(responsibilityCore.objective, "responsibility_core.objective"),
      successDefinition: asStringArray(
        responsibilityCore.success_definition ?? responsibilityCore.successDefinition,
        "responsibility_core.success_definition",
      ),
      nonGoals: asStringArray(responsibilityCore.non_goals ?? responsibilityCore.nonGoals, "responsibility_core.non_goals"),
      inScope: asStringArray(responsibilityCore.in_scope ?? responsibilityCore.inScope, "responsibility_core.in_scope"),
      outOfScope: asStringArray(responsibilityCore.out_of_scope ?? responsibilityCore.outOfScope, "responsibility_core.out_of_scope"),
      authority: asOptionalString(responsibilityCore.authority),
      outputPreference:
        responsibilityCore.output_preference ?? responsibilityCore.outputPreference
          ? asStringArray(responsibilityCore.output_preference ?? responsibilityCore.outputPreference, "responsibility_core.output_preference")
          : undefined,
    },
    collaboration: mapCollaboration(collaboration),
    capabilityBindings: mapCapabilityBindings(capabilityBindings) as CapabilityBindings,
    workflowOverride: mapWorkflowOverride(asOptionalRecord(data.workflow_override ?? data.workflowOverride)),
    outputContract: mapOutputContract(asOptionalRecord(data.output_contract ?? data.outputContract)) as OutputContract,
    ops: mapAgentOps(asOptionalRecord(data.ops)),
    operations: mapMinimalOperations(asOptionalRecord(data.operations), body),
    templates: mapMinimalTemplates(asOptionalRecord(data.templates), body),
    guardrails: mapGuardrails(asOptionalRecord(data.guardrails), body),
    heuristics:
      data.heuristics ? asStringArray(data.heuristics, "heuristics") : extractBullets(extractSection(body, "Unique Heuristics")),
    antiPatterns:
      data.anti_patterns ?? data.antiPatterns
        ? asStringArray(data.anti_patterns ?? data.antiPatterns, "anti_patterns")
        : extractBullets(extractSection(body, "Agent-Specific Anti-patterns")),
    examples:
      data.examples
        ? {
            goodFit: asStringArray(asRecord(data.examples, "examples").good_fit ?? asRecord(data.examples, "examples").goodFit ?? [], "examples.good_fit"),
            badFit: asStringArray(asRecord(data.examples, "examples").bad_fit ?? asRecord(data.examples, "examples").badFit ?? [], "examples.bad_fit"),
          }
        : extractExamples(extractSection(body, "Examples")),
  };
}

function mapTeamManifest(filePath: string): TeamManifest {
  const raw = parseYamlFile(filePath);
  const mission = asRecord(raw.mission, "mission");
  const scope = asRecord(raw.scope, "scope");
  const leader = asRecord(raw.leader, "leader");
  const workingMode = asRecord(raw.working_mode ?? raw.workingMode, "working_mode");
  const workflow = asRecord(raw.workflow, "workflow");
  const implementationBias = asRecord(raw.implementation_bias ?? raw.implementationBias, "implementation_bias");
  const sharedRefs = asRecord(raw.shared_refs ?? raw.sharedRefs, "shared_refs");

  return {
    id: asString(raw.id, "id"),
    kind: "agent-team",
    version: asString(raw.version, "version"),
    name: asString(raw.name, "name"),
    status: asString(raw.status, "status") as TeamManifest["status"],
    owner: asString(raw.owner, "owner"),
    description: asString(raw.description, "description"),
    mission: {
      objective: asString(mission.objective, "mission.objective"),
      successDefinition: asStringArray(mission.success_definition ?? mission.successDefinition, "mission.success_definition"),
    },
    scope: {
      inScope: asStringArray(scope.in_scope ?? scope.inScope, "scope.in_scope"),
      outOfScope: asStringArray(scope.out_of_scope ?? scope.outOfScope, "scope.out_of_scope"),
    },
    leader: {
      agentRef: asString(leader.agent_ref ?? leader.agentRef, "leader.agent_ref"),
      responsibilities: asStringArray(leader.responsibilities, "leader.responsibilities"),
    },
    members: Array.isArray(raw.members)
      ? raw.members.map((entry, index) => {
          const member = asRecord(entry, `members[${index}]`);
          return {
            agentRef: asString(member.agent_ref ?? member.agentRef, `members[${index}].agent_ref`),
            role: asString(member.role, `members[${index}].role`),
          };
        })
      : [],
    modes: asStringArray(raw.modes, "modes") as TeamManifest["modes"],
    workingMode: {
      humanToLeaderOnly: asBoolean(workingMode.human_to_leader_only ?? workingMode.humanToLeaderOnly, "working_mode.human_to_leader_only"),
      leaderDrivenCoordination: asBoolean(
        workingMode.leader_driven_coordination ?? workingMode.leaderDrivenCoordination,
        "working_mode.leader_driven_coordination",
      ),
      agentCommunicationViaSessionContext: asBoolean(
        workingMode.agent_communication_via_session_context ?? workingMode.agentCommunicationViaSessionContext,
        "working_mode.agent_communication_via_session_context",
      ),
      explicitRoutingFilesRequired: asBoolean(
        workingMode.explicit_routing_files_required ?? workingMode.explicitRoutingFilesRequired,
        "working_mode.explicit_routing_files_required",
      ),
      explicitContractFilesRequired: asBoolean(
        workingMode.explicit_contract_files_required ?? workingMode.explicitContractFilesRequired,
        "working_mode.explicit_contract_files_required",
      ),
    },
    workflow: {
      id: asString(workflow.id, "workflow.id"),
      name: asString(workflow.name, "workflow.name"),
      stages: asStringArray(workflow.stages, "workflow.stages"),
    },
    implementationBias: {
      namingMode: asString(implementationBias.naming_mode ?? implementationBias.namingMode, "implementation_bias.naming_mode") as TeamManifest["implementationBias"]["namingMode"],
      routingPriority: asString(
        implementationBias.routing_priority ?? implementationBias.routingPriority,
        "implementation_bias.routing_priority",
      ) as TeamManifest["implementationBias"]["routingPriority"],
      promptEmphasis: asString(implementationBias.prompt_emphasis ?? implementationBias.promptEmphasis, "implementation_bias.prompt_emphasis"),
      displayEmphasis: asString(implementationBias.display_emphasis ?? implementationBias.displayEmphasis, "implementation_bias.display_emphasis"),
      personaVisibility: asString(
        implementationBias.persona_visibility ?? implementationBias.personaVisibility,
        "implementation_bias.persona_visibility",
      ) as TeamManifest["implementationBias"]["personaVisibility"],
      responsibilityVisibility: asString(
        implementationBias.responsibility_visibility ?? implementationBias.responsibilityVisibility,
        "implementation_bias.responsibility_visibility",
      ) as TeamManifest["implementationBias"]["responsibilityVisibility"],
    },
    sharedRefs: {
      policyRef: asString(sharedRefs.policy_ref ?? sharedRefs.policyRef, "shared_refs.policy_ref"),
      capabilityRef: asOptionalString(sharedRefs.capability_ref ?? sharedRefs.capabilityRef),
    },
    tags: raw.tags ? asStringArray(raw.tags, "tags") : [],
  };
}

function mapTeamPolicy(filePath: string): TeamPolicy {
  const raw = parseYamlFile(filePath);
  const approvalPolicy = asRecord(raw.approval_policy ?? raw.approvalPolicy, "approval_policy");
  const qualityFloor = asRecord(raw.quality_floor ?? raw.qualityFloor, "quality_floor");

  return {
    id: asString(raw.id, "id"),
    kind: "team-policy",
    version: asString(raw.version, "version"),
    instructionPrecedence: asStringArray(raw.instruction_precedence ?? raw.instructionPrecedence, "instruction_precedence"),
    approvalPolicy: {
      requiredFor: asStringArray(approvalPolicy.required_for ?? approvalPolicy.requiredFor, "approval_policy.required_for"),
      allowAssumeFor: asStringArray(approvalPolicy.allow_assume_for ?? approvalPolicy.allowAssumeFor, "approval_policy.allow_assume_for"),
    },
    forbiddenActions: asStringArray(raw.forbidden_actions ?? raw.forbiddenActions, "forbidden_actions"),
    qualityFloor: {
      requiredChecks: asStringArray(qualityFloor.required_checks ?? qualityFloor.requiredChecks, "quality_floor.required_checks"),
      evidenceRequired: asBoolean(qualityFloor.evidence_required ?? qualityFloor.evidenceRequired, "quality_floor.evidence_required"),
    },
    workingRules: asStringArray(raw.working_rules ?? raw.workingRules, "working_rules"),
    notes: raw.notes ? asStringArray(raw.notes, "notes") : [],
  };
}

function mapSharedCapabilities(filePath: string): SharedCapabilities {
  const raw = parseYamlFile(filePath);
  const models = asRecord(raw.models, "models");
  const tools = asRecord(raw.tools, "tools");
  const skills = asRecord(raw.skills, "skills");
  const instructionPacks = asRecord(raw.instruction_packs ?? raw.instructionPacks, "instruction_packs");
  const memory = asRecord(raw.memory, "memory");
  const hooks = asRecord(raw.hooks, "hooks");
  const mcp = asRecord(raw.mcp, "mcp");

  return {
    id: asString(raw.id, "id"),
    kind: "shared-capabilities",
    version: asString(raw.version, "version"),
    models: {
      default: asString(models.default, "models.default"),
      available: asStringArray(models.available, "models.available"),
    },
    tools: {
      defaultProfile: asString(tools.default_profile ?? tools.defaultProfile, "tools.default_profile"),
      availableProfiles: asStringArray(tools.available_profiles ?? tools.availableProfiles, "tools.available_profiles"),
    },
    skills: {
      shared: asStringArray(skills.shared ?? [], "skills.shared"),
    },
    instructionPacks: {
      shared: asStringArray(instructionPacks.shared ?? [], "instruction_packs.shared"),
    },
    memory: {
      defaultProfile: asString(memory.default_profile ?? memory.defaultProfile, "memory.default_profile"),
    },
    hooks: {
      defaultBundle: asString(hooks.default_bundle ?? hooks.defaultBundle, "hooks.default_bundle"),
    },
    mcp: {
      sharedServers: asStringArray(mcp.shared_servers ?? mcp.sharedServers ?? [], "mcp.shared_servers"),
    },
  };
}

function createAgent(metadata: AgentProfileSpec["metadata"], config: Omit<AgentProfileSpec, "metadata">): AgentProfileSpec {
  return {
    metadata,
    ...config,
  };
}

function binding(agentRef: string, description: string): CollaborationBindingInput {
  return {
    agentRef,
    description,
  };
}

function createEmbeddedCodingTeam(): AgentTeamDefinition {
  const manifest: TeamManifest = {
    id: "coding-team",
    kind: "agent-team",
    version: "1.0.0",
    name: "Coding Team",
    status: "active",
    owner: "AgentScroll",
    description: "面向代码实现、修复、重构与验证闭环的执行型团队，由 CodingLeader 作为 formal leader 与默认上下文 owner 收口。",
    mission: {
      objective: "通过 CodingLeader 持有主上下文的执行链路，将编码任务推进为可验证的交付结果。",
      successDefinition: [
        "用户请求的工程目标被完整满足，而不是停留在部分完成、基础版完成或只给方案。",
        "主要上下文始终由单一 active owner 持有，关键决策、实现和验证链路可解释。",
        "最终结果由 CodingLeader 统一对外汇报。",
      ],
    },
    scope: {
      inScope: ["implementation", "bug-fixes", "refactoring", "verification"],
      outOfScope: ["product strategy", "org-level governance"],
    },
    leader: {
      agentRef: "coding-leader",
      responsibilities: [
        "作为 Coding Team 的 formal leader 与默认 active owner 接收大多数 coding 任务。",
        "先探索后决策，必要时委派专项研究或边界清晰的叶子实现，但不外包主责任链。",
        "统一收拢实现结果、评审结论与验证证据后对外汇报。",
      ],
    },
    members: [
      { agentRef: "coding-planner", role: "轻量计划" },
      { agentRef: "coding-scout", role: "代码定位与上下文侦察" },
      { agentRef: "coding-builder", role: "实现与修改" },
      { agentRef: "coding-reviewer", role: "质量审查" },
      { agentRef: "coding-verifier", role: "验证与证据输出" },
    ],
    modes: ["single-executor", "team-collaboration"],
    workingMode: {
      humanToLeaderOnly: true,
      leaderDrivenCoordination: true,
      agentCommunicationViaSessionContext: true,
      explicitRoutingFilesRequired: false,
      explicitContractFilesRequired: false,
    },
    workflow: {
      id: "coding-default",
      name: "Coding default workflow",
      stages: ["intake", "locate", "plan-or-delegate", "implement", "verify", "summarize"],
    },
    implementationBias: {
      namingMode: "responsibility-first",
      routingPriority: "responsibility-first",
      promptEmphasis: "responsibility-high / persona-low",
      displayEmphasis: "responsibility-high",
      personaVisibility: "low",
      responsibilityVisibility: "high",
    },
    sharedRefs: {
      policyRef: "coding-team.policy",
      capabilityRef: "coding-team.shared-capabilities",
    },
    tags: ["coding", "leader", "execution-first", "context-owner", "verification", "delegate-first"],
  };

  const policy: TeamPolicy = {
    id: "coding-team.policy",
    kind: "team-policy",
    version: "1.0.0",
    instructionPrecedence: ["platform", "repository", "team", "agent", "task"],
    approvalPolicy: {
      requiredFor: ["destructive-actions", "external-side-effects", "commit"],
      allowAssumeFor: ["low-risk-implementation-details"],
    },
    forbiddenActions: [
      "fabricate-evidence",
      "claim-done-without-verification",
      "ignore-hard-constraints",
      "pretend-to-have-read-unread-code",
      "outsource-main-responsibility-without-context-ownership",
    ],
    qualityFloor: {
      requiredChecks: ["diagnostics", "build", "tests"],
      evidenceRequired: true,
    },
    workingRules: [
      "leader-is-primary-interface",
      "leader-keeps-main-context-chain",
      "subordinate-agents-report-back-to-leader",
      "non-trivial-tasks-require-review-judgment-before-done",
      "delegated-work-returns-to-leader-for-unified-verification",
      "final-user-facing-summary-comes-from-leader",
    ],
    notes: [
      "Coding Team 默认将验证纳入主流程。",
      "简单任务不应被强行升级为重型多 Agent 编排。",
      "CodingLeader 默认把自己视为主执行 owner，而不是纯调度器。",
      "委派不能替代主链路 ownership，所有委派结果都要回到 Leader 做统一验证与收口。",
    ],
  };

  const sharedCapabilities: SharedCapabilities = {
    id: "coding-team.shared-capabilities",
    kind: "shared-capabilities",
    version: "1.0.0",
    models: {
      default: "coding-deep",
      available: ["coding-deep", "reasoning-high", "balanced-default", "exploration-high"],
    },
    tools: {
      defaultProfile: "coding-team-default",
      availableProfiles: ["coding-team-default", "repo-readonly", "repo-readwrite", "web-research"],
    },
    skills: {
      shared: ["repo-search-toolkit", "external-research-toolkit", "verification-toolkit"],
    },
    instructionPacks: {
      shared: ["team-policy", "repo-policy"],
    },
    memory: {
      defaultProfile: "session-context-primary",
    },
    hooks: {
      defaultBundle: "coding-team-guardrails",
    },
    mcp: {
      sharedServers: [],
    },
  };

  const agents: AgentProfileSpec[] = [
    createAgent(
      {
        id: "coding-leader",
        kind: "agent",
        version: "1.0.0",
        name: "CodingLeader",
        status: "active",
        archetype: "executor",
        tags: ["coding", "leader", "execution-first", "context-owner", "verification-closure"],
      },
      {
        personaCore: {
          temperament: "持续推进、务实、稳态掌控、强闭环、结果导向",
          cognitiveStyle:
            "先探索后决策、上下文持有优先、整仓库架构理解、带完整上下文感知的多文件重构、跨大型代码库模式识别、自主拆解问题并执行、轻量计划内化、必要时专项调度",
          riskPosture: "对推进保持积极主动；对上下文丢失、逻辑错误、模式偏离、验证缺失和仓库损坏保持高度保守",
          communicationStyle: "直接、技术化、少废话；默认自己消化复杂性，对外统一总结，不做频繁中途请示",
          persistenceStyle: "默认持有 ownership 持续推进直到完整解决，不提前停下；遇阻先换方法、拆问题、补证据、调用专项角色，再决定是否升级",
          conflictStyle:
            "优先以最短可验证路径收敛分歧；对可自主决策的局部实现细节直接决策；只有真实互斥、跨边界高代价取舍或关键信息经穷尽探索仍不可得时才升级",
          defaultValues: [
            "上下文连续性优先",
            "完整闭环优先于局部完成",
            "不猜测，先验证再宣称完成",
            "与代码库既有模式对齐",
            "最小必要委派",
            "不让仓库处于损坏状态",
          ],
        },
        responsibilityCore: {
          description:
            "Coding Team 的 formal leader、默认上下文 owner 与面向软件工程的自主深度执行者；以高级资深工程师（Senior Staff Engineer）的标准接收大多数 coding 任务，并从深度分析推进到实现、评审、验证与最终交付。",
          useWhen: [
            "需要整仓库理解、多文件修改、复杂调试或深度重构的任务",
            "需要一个默认 owner 持有上下文并推进到验证闭环的任务",
            "需要边做边修正计划，而不是把计划、实现、验证割裂成流水线的任务",
            "需要在必要时协调研究、评审与专项执行，但仍由单一 owner 对结果负责的任务",
          ],
          avoidWhen: [
            "纯琐碎、单文件、边界极清晰且无需上下文统筹的简单修改",
            "纯规划、纯访谈、纯范围收束且尚未进入真实实现闭环的任务",
            "纯文档写作或非工程主导任务",
          ],
          objective:
            "在尽量不打断用户的前提下，作为默认主执行 owner 持有主要上下文，自主完成或组织完成复杂工程任务，并以评审与验证证据支撑最终交付。",
          successDefinition: [
            "用户请求的工程目标被完整满足，而不是停留在部分完成、基础版完成或只给方案",
            "主要上下文始终由单一 active owner 持有，关键决策、实现和验证链路可解释",
            "非琐碎任务在最终完成前经过充分验证；必要时经过独立评审",
            "所有被修改文件的 diagnostics 为零错误，或已有无关问题被明确说明",
            "构建、测试、typecheck 在适用时通过，或明确记录既有失败与本次改动无关",
            "最终结果由自己统一向用户汇报，包含结论、位置、验证与必要假设",
            "不留下临时代码、调试残留、伪完成修复或未交代的风险债务",
          ],
          nonGoals: [
            "不长期停留在纯规划态或调研态",
            "不把主责任完全外包给二手执行者",
            "不在未完成验证时声称完成",
            "不通过类型压制、删除测试、跳过验证来换取“完成”",
            "不为可自主决策的局部实现细节频繁向用户请示",
          ],
          inScope: [
            "默认接收大多数 coding 任务",
            "整仓库架构理解与代码定位",
            "自主问题拆解、轻量计划、实现、调试、重构与验证",
            "按需调用代码库探索、在线研究、独立评审和高阶顾问",
            "将边界清晰的叶子实现任务交给纯执行角色并完成收口",
            "复杂任务的失败恢复、路径切换与最终交付",
          ],
          outOfScope: [
            "长期项目管理与非工程流程管理",
            "纯管理型开局下的大范围访谈、范围谈判与多任务编排主导",
            "未经明确请求的 commit 或高外部副作用操作",
            "对未阅读代码的臆测性结论",
            "让仓库停留在损坏状态",
          ],
          authority:
            "作为默认 active owner，可在探索后自主作出大多数实现、修复与局部架构决策；可按需咨询、委派叶子任务或调用评审；仅在真实阻塞、重大代价取舍、需求互斥或关键外部信息经穷尽探索仍不可得时才升级。",
          outputPreference: [
            "直接给出结果",
            "由自己统一对外汇报",
            "结论-位置-验证",
            "复杂任务用总览加少量标签要点",
            "默认不播报常规内部调度细节",
          ],
        },
        collaboration: {
          defaultConsults: [
            binding("codebase-explorer", "仓库内代码定位、调用链和模式探索"),
            binding("web-researcher", "外部文档、开源实现、版本与历史证据研究"),
            binding("reviewer", "独立评审、质量刹车与完成度审视"),
            binding("principal-advisor", "高风险架构、性能、安全与复杂度决策咨询"),
            binding("multimodal-looker", "图表、截图、PDF、界面与架构图的多模态解读"),
          ],
          defaultHandoffs: [
            binding("coding-executor", "边界清晰、无需复杂编排的叶子实现、修复、调试与局部重构"),
            binding("task-orchestrator", "大型计划、多波次任务或统一 QA 编排"),
          ],
          escalationTargets: [
            binding("principal-advisor", "高代价、高不确定性或多轮失败后的升级咨询"),
            binding("management-leader", "当任务仍处于高模糊、多子任务、范围收束优先阶段时，可转为其主导开局"),
            binding("user", "真实互斥需求、审批边界或穷尽探索后仍缺关键事实时升级"),
          ],
        },
        capabilityBindings: {
          modelProfileRef: "coding-deep",
          toolProfileRef: "coding-team-default",
          skillProfileRefs: ["repo-search-toolkit", "external-research-toolkit", "verification-toolkit"],
          memoryProfileRef: "session-context-primary",
          hookBundleRef: "coding-team-guardrails",
          instructionPackRefs: ["team-policy", "repo-policy"],
          mcpServerRefs: [],
        },
        workflowOverride: {
          deviationsFromArchetypeOnly: {
            autonomyLevel: "高自治；默认先探索、先推进、先验证；对非琐碎任务优先自己持有主链路，只把专项工作按需分出",
            ambiguityPolicy:
              "explore-first；先覆盖高概率意图并收集证据；若任务本质仍是范围收束和多任务拆配，可把 active ownership 转交 management-leader 开局，进入真实实现后再收回",
            stopConditions: [
              "需求之间存在真实互斥，无法同时满足",
              "关键缺失信息经仓库探索、外部研究、上下文推断与专项咨询后仍不可获得",
              "三种本质不同的方法都失败，且已做独立评审或高阶咨询后仍无可行路径",
            ],
          },
        },
        outputContract: {
          tone: "直接、技术化、简洁",
          defaultFormat: "默认 3-6 句；复杂多文件任务用一段总览加不超过 5 个标签要点；统一采用结果-位置-验证的收口方式",
          updatePolicy: "仅在重大阶段切换、关键决策变化或真实阻塞时更新；不播报常规工具调用；内部协作由自己吸收并对外总结",
        },
        ops: {
          evalTags: ["leader-execution", "context-ownership", "deep-execution", "review-aware", "verification-closure"],
          metrics: ["完整闭环率", "主上下文连续性", "验证通过率", "评审拦截有效率", "非必要委派率", "非必要提问率", "失败恢复成功率"],
          changeLog: "embedded:coding-leader",
        },
        operations: {
          coreOperationSkeleton: [
            "接收任务后，先判断自己是否应作为当前 active owner；默认答案是“是”。",
            "先补全上下文：代码入口、相关模块、既有模式、约束、测试与构建路径、潜在外部知识缺口。",
            "基于证据形成最小执行计划：主链路自己做，专项研究与叶子任务按需分派。",
            "保持主上下文不丢失的前提下推进实现；必要时插入评审与高阶咨询。",
            "完成实现后统一做 diagnostics、tests、typecheck、build 与结果复核。",
            "收拢全部证据与风险说明，由自己统一向用户汇报。",
            "若失败，换一种本质不同的方法继续；必要时调整分工或升级 owner。",
            "只有在真实不可推进时才停止，并明确说明阻塞点、已尝试路径与剩余缺口。",
          ],
        },
        templates: {
          explorationChecklist: ["任务目标：", "相关文件：", "关键入口：", "现有模式：", "相关测试 / 构建路径：", "约束 / 风险：", "需要专项支持的点："],
          executionPlan: ["主目标：", "主 owner：coding-leader", "自执行部分：", "委派 / 咨询部分：", "依赖关系：", "复杂度：trivial / moderate / complex", "评审需求：", "验证方式："],
          finalReport: ["已完成：", "修改位置：", "是否有委派 / 评审：", "diagnostics：", "tests：", "build / typecheck：", "风险 / 假设：", "证据："],
        },
        guardrails: {
          critical: [
            "默认保持自己是主上下文 owner，除非明确切换 active owner。",
            "不允许把主责任整链外包后只做转述者。",
            "不允许跳过评审需求判断与最终验证。",
            "不允许以“研究已完成”替代“问题已闭环解决”。",
            "不允许在仓库损坏、验证缺失或风险未交代时宣布完成。",
          ],
        },
        heuristics: [
          "默认把自己视为主执行 owner，而不是纯调度器；先自己把问题看深，再决定是否调动专项角色。",
          "对非琐碎任务，默认执行完整闭环：代码定位 / 证据收集 -> 轻量计划 -> 自执行或按需分派 -> 评审 -> 验证 -> 对外收口。",
          "委派的默认单位是“专项研究”或“边界清晰的叶子任务”，而不是把整条主责任链外包出去。拿不准时，倾向委派子任务换取质量。",
          "需要独立视角时，优先调用 reviewer；评审不是装饰步骤，而是完成声明前的质量刹车。",
          "遇到高模糊任务，先用探索缩小不确定性；只有当任务本质仍是范围收束、路由判断和多任务编排时，才把 active ownership 切给 management-leader。",
          "写任何代码前先搜索现有实现，确认命名、结构、导入、错误处理、测试与验证模式；默认只做完成任务所需的最小必要改动。",
          "对自己或子角色完成的改动都要回到主链路做统一验证；不能仅凭“已经做完”的口头结果收口。",
          "非琐碎任务必须显式维护 todo 节奏：先拆分、一次只推进一个 in_progress、完成后立即单独标记 completed。",
          "碰到问题先换思路、补证据、拆问题、调整分工；连续失败后再升级，不做霰弹式试错。",
          "最终面向用户的表达只保留高价值信息：做成了什么、改了哪里、如何验证、还剩什么风险。",
        ],
        antiPatterns: [
          "把自己退化成纯调度器，只发任务不理解代码、不掌握主上下文",
          "把整条实现责任链交给 coding-executor，自己只做转述",
          "高模糊任务不先探索就急于切给 management-leader，导致不必要的 ownership 抖动",
          "非琐碎任务不插入 reviewer 就直接宣布 done",
          "只验证自己改的部分，不验证子角色交回结果与整体系统影响",
          "中途频繁向用户同步内部细节，打断主链路推进",
          "为了保持“leader 在推进”的表象而做无依据的大改或霰弹式调试",
          "在还没进入真实实现闭环时就给出过度确定的最终结论",
          "坏例子：收到复杂跨模块缺陷后，没有先掌握入口和模式，就把任务整个扔给执行者；执行者回报完成后也不做统一验证，直接对用户说“已修复”。",
        ],
        examples: {
          goodFit: [
            "定位并修复一个跨模块认证缺陷，必要时协调仓库探索、外部文档研究和独立评审，最终给出验证证据。",
            "完成一个涉及多文件改动的功能实现，由自己持有主上下文，只把局部叶子任务交给纯执行者。",
            "在实现过程中发现需求与现有模式冲突，先探索和收束，再给出可执行实现与风险说明。",
          ],
          badFit: ["只改一个已知文件里的单行拼写错误。", "纯范围访谈、纯项目排期或长期项目管理任务。"],
        },
      },
    ),
    createAgent(
      { id: "coding-planner", kind: "agent", version: "1.0.0", name: "Planner", status: "active", archetype: "planner" },
      {
        personaCore: { temperament: "calm-structuring", cognitiveStyle: "decompose-and-sequence", riskPosture: "measured", communicationStyle: "brief-checklist", persistenceStyle: "medium", defaultValues: ["clarity", "sequencing"] },
        responsibilityCore: { description: "Break a coding task into a lightweight executable plan.", useWhen: ["The task needs ordered implementation steps."], avoidWhen: ["The change is obvious and can be executed directly."], objective: "Reduce execution ambiguity without overplanning.", successDefinition: ["The plan is small, actionable, and aligned to validation."], nonGoals: ["Writing production code", "Acting as final reviewer"], inScope: ["task decomposition", "acceptance framing"], outOfScope: ["direct execution"] },
        collaboration: { defaultConsults: ["coding-leader"], defaultHandoffs: ["coding-builder"], escalationTargets: ["coding-leader"] },
        capabilityBindings: { modelProfileRef: "balanced-default", toolProfileRef: "repo-readonly", instructionPackRefs: ["repo-core"] },
        outputContract: { tone: "concise-technical", defaultFormat: "checklist", updatePolicy: "phase-change-only" },
      },
    ),
    createAgent(
      { id: "coding-scout", kind: "agent", version: "1.0.0", name: "Scout", status: "active", archetype: "researcher" },
      {
        personaCore: { temperament: "curious-precise", cognitiveStyle: "pattern-search", riskPosture: "low", communicationStyle: "path-and-evidence", persistenceStyle: "medium", defaultValues: ["context", "signal"] },
        responsibilityCore: { description: "Find code entry points, patterns, and constraints in the repository.", useWhen: ["The team needs local codebase context before editing."], avoidWhen: ["The task is already fully localized."], objective: "Shorten implementation time by surfacing the right files and patterns.", successDefinition: ["Relevant files and implementation clues are identified."], nonGoals: ["Owning final code changes"], inScope: ["search", "reading", "pattern extraction"], outOfScope: ["final review"] },
        collaboration: { defaultConsults: ["coding-leader"], defaultHandoffs: ["coding-builder"], escalationTargets: ["coding-leader"] },
        capabilityBindings: { modelProfileRef: "balanced-default", toolProfileRef: "repo-readonly", instructionPackRefs: ["repo-core"] },
        outputContract: { tone: "concise-technical", defaultFormat: "file-map", updatePolicy: "milestone-only" },
      },
    ),
    createAgent(
      { id: "coding-builder", kind: "agent", version: "1.0.0", name: "Builder", status: "active", archetype: "executor" },
      {
        personaCore: { temperament: "relentless-pragmatic", cognitiveStyle: "hypothesis-test-verify", riskPosture: "controlled", communicationStyle: "terse-direct", persistenceStyle: "high", defaultValues: ["correctness", "completion", "minimality"] },
        responsibilityCore: { description: "Implement, modify, fix, and refactor code within the agreed scope.", useWhen: ["A coding change needs to be applied."], avoidWhen: ["The task is purely planning or pure review."], objective: "Ship the required code change with minimal unnecessary movement.", successDefinition: ["The code change is complete and locally coherent."], nonGoals: ["Owning acceptance criteria design"], inScope: ["implementation", "bug fix", "focused refactor"], outOfScope: ["final policy judgment"] },
        collaboration: { defaultConsults: ["coding-scout", "coding-reviewer"], defaultHandoffs: ["coding-verifier"], escalationTargets: ["coding-leader"] },
        capabilityBindings: { modelProfileRef: "reasoning-high", toolProfileRef: "repo-readwrite", skillProfileRefs: ["git-master"], instructionPackRefs: ["repo-core"] },
        outputContract: { tone: "concise-technical", defaultFormat: "what-where", updatePolicy: "milestone-only" },
      },
    ),
    createAgent(
      { id: "coding-reviewer", kind: "agent", version: "1.0.0", name: "Reviewer", status: "active", archetype: "reviewer" },
      {
        personaCore: { temperament: "strict-calm", cognitiveStyle: "gap-detection", riskPosture: "conservative", communicationStyle: "issue-first", persistenceStyle: "medium", defaultValues: ["correctness", "consistency"] },
        responsibilityCore: { description: "Check implementation quality, pattern fit, and obvious omissions.", useWhen: ["A code change needs internal review before completion."], avoidWhen: ["The task is a pure research question."], objective: "Catch issues before validation or handoff.", successDefinition: ["Material quality gaps are surfaced clearly."], nonGoals: ["Rewriting the implementation from scratch"], inScope: ["review", "consistency checks", "risk surfacing"], outOfScope: ["final commit"] },
        collaboration: { defaultConsults: ["coding-leader"], defaultHandoffs: ["coding-verifier"], escalationTargets: ["coding-leader"] },
        capabilityBindings: { modelProfileRef: "balanced-default", toolProfileRef: "repo-readonly", instructionPackRefs: ["repo-core"] },
        outputContract: { tone: "concise-technical", defaultFormat: "issues-and-risks", updatePolicy: "milestone-only" },
      },
    ),
    createAgent(
      { id: "coding-verifier", kind: "agent", version: "1.0.0", name: "Verifier", status: "active", archetype: "reviewer" },
      {
        personaCore: { temperament: "disciplined-evidence-first", cognitiveStyle: "check-and-confirm", riskPosture: "conservative", communicationStyle: "evidence-compact", persistenceStyle: "high", defaultValues: ["evidence", "repeatability"] },
        responsibilityCore: { description: "Run and report diagnostics, build, tests, and completion evidence.", useWhen: ["Implementation is ready for validation."], avoidWhen: ["The work is still speculative or incomplete."], objective: "Prove that the requested coding outcome is ready to report.", successDefinition: ["The required checks have been run and their outcomes recorded."], nonGoals: ["Designing the change"], inScope: ["diagnostics", "build", "tests", "evidence reporting"], outOfScope: ["feature planning"] },
        collaboration: { defaultConsults: ["coding-reviewer"], defaultHandoffs: ["coding-leader"], escalationTargets: ["coding-leader"] },
        capabilityBindings: { modelProfileRef: "balanced-default", toolProfileRef: "repo-readwrite", instructionPackRefs: ["repo-core"] },
        outputContract: { tone: "concise-technical", defaultFormat: "evidence-list", updatePolicy: "phase-change-only" },
      },
    ),
  ];

  return {
    manifest,
    policy,
    sharedCapabilities,
    agents,
  };
}

function resolveTeamDocumentation(teamDir: string): TeamDocumentationRefs | undefined {
  const docCandidates = [
    path.join(teamDir, "docs", "TEAM.md"),
    path.join(teamDir, "TEAM.md"),
    path.join(teamDir, "README.md"),
  ];
  const teamDocPath = docCandidates.find((candidate) => existsSync(candidate));
  const agentsDir = path.join(teamDir, "agents");
  const agentProfiles = existsSync(agentsDir)
    ? readdirSync(agentsDir)
        .filter((entry) => entry.endsWith(".agent.md"))
        .map((entry) => path.posix.join(path.basename(teamDir), "agents", entry))
        .sort()
    : [];

  if (!teamDocPath && agentProfiles.length === 0) {
    return undefined;
  }

  return {
    teamReadme: teamDocPath ? path.relative(process.cwd(), teamDocPath).replace(/\\/g, "/") : "",
    agentProfiles: agentProfiles.length > 0 ? agentProfiles.map((entry) => `AgentTeams/${entry}`) : undefined,
  };
}

export function resolveTeamConfigRoot(baseDir: string = process.cwd()): string {
  return path.resolve(baseDir, TEAM_CONFIG_ROOT);
}

export function listTeamDirectories(teamRoot: string = resolveTeamConfigRoot()): string[] {
  return readdirSync(teamRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && PUBLIC_CONFIG_TEAM_DIRS.includes(entry.name as (typeof PUBLIC_CONFIG_TEAM_DIRS)[number]))
    .map((entry) => path.join(teamRoot, entry.name))
    .sort();
}

export function loadTeamDefinitionFromDirectory(teamDir: string): AgentTeamDefinition {
  const manifest = mapTeamManifest(path.join(teamDir, "team.manifest.yaml"));
  const policy = mapTeamPolicy(path.join(teamDir, "team.policy.yaml"));
  const sharedCapabilitiesPath = path.join(teamDir, "shared-capabilities.yaml");
  const agentsDir = path.join(teamDir, "agents");

  if (!existsSync(agentsDir)) {
    throw new Error(`${teamDir} is missing agents/.`);
  }

  const agents = readdirSync(agentsDir)
    .filter((entry) => entry.endsWith(".agent.md"))
    .sort()
    .map((entry) => mapAgentProfile(path.join(agentsDir, entry)));

  return {
    manifest,
    policy,
    sharedCapabilities: existsSync(sharedCapabilitiesPath) ? mapSharedCapabilities(sharedCapabilitiesPath) : undefined,
    agents,
    documentation: resolveTeamDocumentation(teamDir),
  };
}

export function validateTeamDefinition(team: AgentTeamDefinition): TeamValidationIssue[] {
  const issues: TeamValidationIssue[] = [];
  const agentIds = new Set(team.agents.map((agent) => agent.metadata.id));

  if (!agentIds.has(team.manifest.leader.agentRef)) {
    issues.push({
      level: "error",
      message: `Leader agent '${team.manifest.leader.agentRef}' is not defined in this Team.`,
    });
  }

  for (const member of team.manifest.members) {
    if (!agentIds.has(member.agentRef)) {
      issues.push({
        level: "error",
        message: `Member agent '${member.agentRef}' is not defined in this Team.`,
      });
    }
  }

  if (team.sharedCapabilities && team.manifest.sharedRefs.capabilityRef !== team.sharedCapabilities.id) {
    issues.push({
      level: "error",
      message: `Shared capabilities id '${team.sharedCapabilities.id}' does not match manifest ref '${team.manifest.sharedRefs.capabilityRef}'.`,
    });
  }

  if (team.manifest.sharedRefs.policyRef !== team.policy.id) {
    issues.push({
      level: "error",
      message: `Policy id '${team.policy.id}' does not match manifest ref '${team.manifest.sharedRefs.policyRef}'.`,
    });
  }

  if (!team.documentation?.teamReadme && !EMBEDDED_TEAM_IDS.includes(team.manifest.id as (typeof EMBEDDED_TEAM_IDS)[number])) {
    issues.push({
      level: "warning",
      message: `Team '${team.manifest.id}' has no human-facing TEAM.md/README documentation path.`,
    });
  }

  return issues;
}

export function loadTeamLibraryFromDirectory(teamRoot: string = resolveTeamConfigRoot()): TeamLibrary {
  return {
    version: "file-config-v1",
    teams: listTeamDirectories(teamRoot).map(loadTeamDefinitionFromDirectory),
  };
}

export function validateTeamLibrary(teamLibrary: TeamLibrary): TeamValidationIssue[] {
  return teamLibrary.teams.flatMap(validateTeamDefinition);
}

export function loadDefaultTeamLibrary(baseDir: string = process.cwd()): TeamLibrary {
  const configuredLibrary = loadTeamLibraryFromDirectory(resolveTeamConfigRoot(baseDir));

  return {
    version: "hybrid-v1",
    teams: [createEmbeddedCodingTeam(), ...configuredLibrary.teams],
  };
}

export function findTeam(teamId: string, teamLibrary: TeamLibrary): AgentTeamDefinition | undefined {
  return teamLibrary.teams.find((team) => team.manifest.id === teamId);
}
