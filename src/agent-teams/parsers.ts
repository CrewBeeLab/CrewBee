import { readFileSync } from "node:fs";

import { parse as parseYaml } from "yaml";

import type {
  AgentRuntimeModelConfig,
  AgentEntryPointSpec,
  AgentExamples,
  AgentGuardrails,
  AgentPermissionAction,
  AgentRuntimeConfig,
  AgentProfileSpec,
  CollaborationBindingInput,
  ExecutionPolicySpec,
  MinimalOperations,
  MinimalTemplates,
  OutputContract,
  PromptProjectionSpec,
  TeamManifest,
  TeamMemberMap,
  TeamAgentRuntimeMap,
  ToolSkillStrategySpec,
} from "../core";
import {
  normalizeAgentPromptProjection,
  normalizeTeamPromptProjection,
} from "../prompt-projection";

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

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
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

function mapLegacyTeamMembers(rawMembers: unknown): TeamMemberMap {
  if (!Array.isArray(rawMembers)) {
    return {};
  }

  return Object.fromEntries(
    rawMembers.map((entry, index) => {
      const member = asRecord(entry, `members[${index}]`);
      const agentRef = asString(member.agent_ref ?? member.agentRef, `members[${index}].agent_ref`);

      return [
        agentRef,
        {
          responsibility: asString(member.role, `members[${index}].role`),
          delegateWhen: "",
          delegateMode: "",
        },
      ];
    }),
  );
}

function mapTeamMembers(rawMembers: unknown): TeamMemberMap {
  if (!rawMembers) {
    return {};
  }

  if (Array.isArray(rawMembers)) {
    return mapLegacyTeamMembers(rawMembers);
  }

  const members = asRecord(rawMembers, "members");

  return Object.fromEntries(
    Object.entries(members).map(([agentRef, value]) => {
      const member = asRecord(value, `members.${agentRef}`);

      return [
        agentRef,
        {
          responsibility: asString(member.responsibility, `members.${agentRef}.responsibility`),
          delegateWhen: asString(member.delegate_when ?? member.delegateWhen, `members.${agentRef}.delegate_when`),
          delegateMode: asString(member.delegate_mode ?? member.delegateMode, `members.${agentRef}.delegate_mode`),
        },
      ];
    }),
  );
}

function rejectRemovedTeamManifestFields(raw: UnknownRecord, filePath: string): void {
  const removedFields = [
    "kind",
    "status",
    "owner",
    "modes",
    "working_mode",
    "workingMode",
    "implementation_bias",
    "implementationBias",
    "ownership_routing",
    "ownershipRouting",
    "role_boundaries",
    "roleBoundaries",
    "structure_principles",
    "structurePrinciples",
  ];

  for (const field of removedFields) {
    if (raw[field] !== undefined) {
      throw new Error(`${filePath} no longer supports team manifest field '${field}'. Remove legacy team-only structure fields from the manifest.`);
    }
  }
}

function rejectRemovedWorkflowFields(workflow: UnknownRecord | undefined, filePath: string): void {
  if (!workflow) {
    return;
  }

  for (const field of ["id", "name"]) {
    if (workflow[field] !== undefined) {
      throw new Error(`${filePath} no longer supports workflow field '${field}'. Keep only workflow.stages in Team manifests.`);
    }
  }
}

function rejectRemovedAgentProfileFields(data: UnknownRecord, filePath: string): void {
  const removedFields = [
    "role_boundary",
    "roleBoundary",
    "workflow_override",
    "workflowOverride",
    "autonomy_level",
    "autonomyLevel",
    "stop_conditions",
    "stopConditions",
  ];

  for (const field of removedFields) {
    if (data[field] !== undefined) {
      throw new Error(`${filePath} no longer supports agent profile field '${field}'. Remove legacy agent-structure fields from the profile.`);
    }
  }
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

  return {
    fit: {
      goodFit,
      badFit,
    },
  };
}

function mapExecutionPolicyTriageBucket(
  raw: UnknownRecord | undefined,
  label: string,
): { signals?: string[]; defaultAction?: string } | undefined {
  if (!raw) {
    return undefined;
  }

  const signals = raw.signals ? asStringArray(raw.signals, `${label}.signals`) : undefined;
  const defaultAction = asOptionalString(raw.default_action ?? raw.defaultAction);

  if (!signals && !defaultAction) {
    return undefined;
  }

  return {
    signals,
    defaultAction,
  };
}

function mapExecutionPolicy(raw: UnknownRecord | undefined): ExecutionPolicySpec | undefined {
  if (!raw) {
    return undefined;
  }

  const taskTriageRaw = asOptionalRecord(raw.task_triage ?? raw.taskTriage);
  const taskTriage = taskTriageRaw
    ? {
        trivial: mapExecutionPolicyTriageBucket(asOptionalRecord(taskTriageRaw.trivial), "execution_policy.task_triage.trivial"),
        explicit: mapExecutionPolicyTriageBucket(asOptionalRecord(taskTriageRaw.explicit), "execution_policy.task_triage.explicit"),
        nonTrivial: mapExecutionPolicyTriageBucket(
          asOptionalRecord(taskTriageRaw.non_trivial ?? taskTriageRaw.nonTrivial),
          "execution_policy.task_triage.non_trivial",
        ),
        ambiguous: mapExecutionPolicyTriageBucket(asOptionalRecord(taskTriageRaw.ambiguous), "execution_policy.task_triage.ambiguous"),
      }
    : undefined;

  const executionPolicy: ExecutionPolicySpec = {
    corePrinciple:
      raw.core_principle ?? raw.corePrinciple
        ? asStringArray(raw.core_principle ?? raw.corePrinciple, "execution_policy.core_principle")
        : undefined,
    inputValidation:
      raw.input_validation ?? raw.inputValidation
        ? asStringArray(raw.input_validation ?? raw.inputValidation, "execution_policy.input_validation")
        : undefined,
    reviewTargetPolicy:
      raw.review_target_policy ?? raw.reviewTargetPolicy
        ? asStringArray(raw.review_target_policy ?? raw.reviewTargetPolicy, "execution_policy.review_target_policy")
        : undefined,
    approvalBias:
      raw.approval_bias ?? raw.approvalBias
        ? asStringArray(raw.approval_bias ?? raw.approvalBias, "execution_policy.approval_bias")
        : undefined,
    blockingThreshold:
      raw.blocking_threshold ?? raw.blockingThreshold
        ? asStringArray(raw.blocking_threshold ?? raw.blockingThreshold, "execution_policy.blocking_threshold")
        : undefined,
    dateAwareness:
      raw.date_awareness ?? raw.dateAwareness
        ? asStringArray(raw.date_awareness ?? raw.dateAwareness, "execution_policy.date_awareness")
        : undefined,
    requestClassification:
      raw.request_classification ?? raw.requestClassification
        ? asStringArray(
            raw.request_classification ?? raw.requestClassification,
            "execution_policy.request_classification",
          )
        : undefined,
    documentationDiscovery:
      raw.documentation_discovery ?? raw.documentationDiscovery
        ? asStringArray(
            raw.documentation_discovery ?? raw.documentationDiscovery,
            "execution_policy.documentation_discovery",
          )
        : undefined,
    researchPathPolicy:
      raw.research_path_policy ?? raw.researchPathPolicy
        ? asStringArray(raw.research_path_policy ?? raw.researchPathPolicy, "execution_policy.research_path_policy")
        : undefined,
    sourcePriority:
      raw.source_priority ?? raw.sourcePriority
        ? asStringArray(raw.source_priority ?? raw.sourcePriority, "execution_policy.source_priority")
        : undefined,
    versionPolicy:
      raw.version_policy ?? raw.versionPolicy
        ? asStringArray(raw.version_policy ?? raw.versionPolicy, "execution_policy.version_policy")
        : undefined,
    evidencePolicy:
      raw.evidence_policy ?? raw.evidencePolicy
        ? asStringArray(raw.evidence_policy ?? raw.evidencePolicy, "execution_policy.evidence_policy")
        : undefined,
    parallelismPolicy:
      raw.parallelism_policy ?? raw.parallelismPolicy
        ? asStringArray(raw.parallelism_policy ?? raw.parallelismPolicy, "execution_policy.parallelism_policy")
        : undefined,
    outputPolicy:
      raw.output_policy ?? raw.outputPolicy
        ? asStringArray(raw.output_policy ?? raw.outputPolicy, "execution_policy.output_policy")
        : undefined,
    scopeControl:
      raw.scope_control ?? raw.scopeControl
        ? asStringArray(raw.scope_control ?? raw.scopeControl, "execution_policy.scope_control")
        : undefined,
    ambiguityPolicy:
      raw.ambiguity_policy ?? raw.ambiguityPolicy
        ? asStringArray(raw.ambiguity_policy ?? raw.ambiguityPolicy, "execution_policy.ambiguity_policy")
        : undefined,
    recommendationPolicy:
      raw.recommendation_policy ?? raw.recommendationPolicy
        ? asStringArray(raw.recommendation_policy ?? raw.recommendationPolicy, "execution_policy.recommendation_policy")
        : undefined,
    highRiskSelfCheck:
      raw.high_risk_self_check ?? raw.highRiskSelfCheck
        ? asStringArray(raw.high_risk_self_check ?? raw.highRiskSelfCheck, "execution_policy.high_risk_self_check")
        : undefined,
    toolUsePolicy:
      raw.tool_use_policy ?? raw.toolUsePolicy
        ? asStringArray(raw.tool_use_policy ?? raw.toolUsePolicy, "execution_policy.tool_use_policy")
        : undefined,
    supportTriggers:
      raw.support_triggers ?? raw.supportTriggers
        ? asStringArray(raw.support_triggers ?? raw.supportTriggers, "execution_policy.support_triggers")
        : undefined,
    repositoryAssessment:
      raw.repository_assessment ?? raw.repositoryAssessment
        ? asStringArray(raw.repository_assessment ?? raw.repositoryAssessment, "execution_policy.repository_assessment")
        : undefined,
    concernEscalationPolicy:
      raw.concern_escalation_policy ?? raw.concernEscalationPolicy
        ? asStringArray(
            raw.concern_escalation_policy ?? raw.concernEscalationPolicy,
            "execution_policy.concern_escalation_policy",
          )
        : undefined,
    taskTriage:
      taskTriage && Object.values(taskTriage).some(Boolean)
        ? taskTriage
        : undefined,
    delegationPolicy:
      raw.delegation_policy ?? raw.delegationPolicy
        ? asStringArray(raw.delegation_policy ?? raw.delegationPolicy, "execution_policy.delegation_policy")
        : undefined,
    reviewPolicy:
      raw.review_policy ?? raw.reviewPolicy
        ? asStringArray(raw.review_policy ?? raw.reviewPolicy, "execution_policy.review_policy")
        : undefined,
    todoDiscipline:
      raw.todo_discipline ?? raw.todoDiscipline
        ? asStringArray(raw.todo_discipline ?? raw.todoDiscipline, "execution_policy.todo_discipline")
        : undefined,
    completionGate:
      raw.completion_gate ?? raw.completionGate
        ? asStringArray(raw.completion_gate ?? raw.completionGate, "execution_policy.completion_gate")
        : undefined,
    failureRecovery:
      raw.failure_recovery ?? raw.failureRecovery
        ? asStringArray(raw.failure_recovery ?? raw.failureRecovery, "execution_policy.failure_recovery")
        : undefined,
  };

  if (!Object.values(executionPolicy).some(Boolean)) {
    return undefined;
  }

  return executionPolicy;
}

function mapRuntimeConfig(raw: UnknownRecord | undefined): AgentRuntimeConfig | undefined {
  if (!raw) {
    return undefined;
  }

  const permissionRaw = raw.permission ?? raw.permission_rules ?? raw.permissionRules ?? raw.permissions;

  if (!Array.isArray(permissionRaw)) {
    throw new Error("permission must be an array.");
  }

  return {
    requestedTools: asStringArray(raw.requested_tools ?? raw.requestedTools ?? raw.tools, "requested_tools"),
    permission: permissionRaw.map((entry, index) => {
      const record = asRecord(entry, `permission[${index}]`);
      const action = asString(record.action, `permission[${index}].action`);

      if (!["allow", "deny", "ask"].includes(action)) {
        throw new Error(`permission[${index}].action must be one of allow/deny/ask.`);
      }

      return {
        permission: asString(record.permission, `permission[${index}].permission`),
        action: action as AgentPermissionAction,
        pattern: asOptionalString(record.pattern) ?? "*",
      };
    }),
    skills:
      raw.skills
        ? asStringArray(raw.skills, "skills")
        : undefined,
    memory: asOptionalString(raw.memory),
    hooks: asOptionalString(raw.hooks),
    instructions:
      raw.instructions
        ? asStringArray(raw.instructions, "instructions")
        : undefined,
    mcpServers:
      raw.mcp_servers
        ? asStringArray(raw.mcp_servers, "mcp_servers")
        : undefined,
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
    runtimeConfig: mapRuntimeConfig(
      asOptionalRecord(record.runtime_config ?? record.runtimeConfig ?? record.capabilities),
    ),
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
  };
}

function mapMinimalOperations(raw: UnknownRecord | undefined, body: string): MinimalOperations | undefined {
  const bodySection = extractSection(body, "Minimal Operations");
  const bodySkeleton = extractNumbered(extractSubsection(bodySection ?? "", "Core Operation Skeleton"));
  const frontmatterSkeleton = raw?.core_operation_skeleton ?? raw?.coreOperationSkeleton;
  const autonomyLevel = asOptionalString(raw?.autonomy_level ?? raw?.autonomyLevel);
  const stopConditions =
    raw?.stop_conditions ?? raw?.stopConditions
      ? asStringArray(raw.stop_conditions ?? raw.stopConditions, "operations.stop_conditions")
      : undefined;
  const coreOperationSkeleton = frontmatterSkeleton
    ? asStringArray(frontmatterSkeleton, "core_operation_skeleton")
    : bodySkeleton;

  if (!autonomyLevel && !stopConditions && coreOperationSkeleton.length === 0) {
    return undefined;
  }

  return { autonomyLevel, stopConditions, coreOperationSkeleton };
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

function mapToolSkillStrategy(raw: UnknownRecord | undefined): ToolSkillStrategySpec | undefined {
  if (!raw) {
    return undefined;
  }

  const principles = raw.principles ? asStringArray(raw.principles, "tool_skill_strategy.principles") : undefined;
  const preferredOrder =
    raw.preferred_order ?? raw.preferredOrder
      ? asStringArray(raw.preferred_order ?? raw.preferredOrder, "tool_skill_strategy.preferred_order")
      : undefined;
  const avoid = raw.avoid ? asStringArray(raw.avoid, "tool_skill_strategy.avoid") : undefined;
  const notes = raw.notes ? asStringArray(raw.notes, "tool_skill_strategy.notes") : undefined;

  if (!principles && !preferredOrder && !avoid && !notes) {
    return undefined;
  }

  return {
    principles,
    preferredOrder,
    avoid,
    notes,
  };
}

function mapExamples(raw: UnknownRecord | undefined, body: string): AgentExamples | undefined {
  if (!raw) {
    return extractExamples(extractSection(body, "Examples"));
  }

  const fit = asOptionalRecord(raw.fit);
  const micro = asOptionalRecord(raw.micro);

  if (fit || micro) {
    return {
      fit: fit
        ? {
            goodFit:
              fit.good_fit ?? fit.goodFit
                ? asStringArray(fit.good_fit ?? fit.goodFit, "examples.fit.good_fit")
                : undefined,
            badFit:
              fit.bad_fit ?? fit.badFit
                ? asStringArray(fit.bad_fit ?? fit.badFit, "examples.fit.bad_fit")
                : undefined,
          }
        : undefined,
      micro: micro
        ? {
            ambiguityResolution:
              micro.ambiguity_resolution ?? micro.ambiguityResolution
                ? asStringArray(
                    micro.ambiguity_resolution ?? micro.ambiguityResolution,
                    "examples.micro.ambiguity_resolution",
                  )
                : undefined,
            finalClosure:
              micro.final_closure ?? micro.finalClosure
                ? asStringArray(micro.final_closure ?? micro.finalClosure, "examples.micro.final_closure")
                : undefined,
          }
        : undefined,
    };
  }

  return {
    fit: {
      goodFit:
        raw.good_fit ?? raw.goodFit
          ? asStringArray(raw.good_fit ?? raw.goodFit, "examples.good_fit")
          : undefined,
      badFit:
        raw.bad_fit ?? raw.badFit
          ? asStringArray(raw.bad_fit ?? raw.badFit, "examples.bad_fit")
          : undefined,
    },
  };
}

function mapEntryPoint(raw: UnknownRecord | undefined): AgentEntryPointSpec | undefined {
  if (!raw) {
    return undefined;
  }

  return {
    exposure: asString(raw.exposure, "entry_point.exposure") as AgentEntryPointSpec["exposure"],
    selectionLabel: asOptionalString(raw.selection_label ?? raw.selectionLabel),
    selectionDescription: asOptionalString(raw.selection_description ?? raw.selectionDescription),
  };
}

function mapPromptProjection(raw: UnknownRecord | undefined): PromptProjectionSpec | undefined {
  if (!raw) {
    return undefined;
  }

  const include = raw.include ? asStringArray(raw.include, "prompt_projection.include") : undefined;
  const exclude = raw.exclude ? asStringArray(raw.exclude, "prompt_projection.exclude") : undefined;

  if (!include && !exclude) {
    return undefined;
  }

  return { include, exclude };
}

function mapAgentRuntime(raw: UnknownRecord | undefined): TeamAgentRuntimeMap | undefined {
  if (!raw) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(raw).map(([agentId, value]) => {
      const record = asRecord(value, `agent_runtime.${agentId}`);
      const options = asOptionalRecord(record.options);

      const runtime: AgentRuntimeModelConfig = {
        provider: asString(record.provider, `agent_runtime.${agentId}.provider`),
        model: asString(record.model, `agent_runtime.${agentId}.model`),
        temperature: record.temperature !== undefined ? Number(record.temperature) : undefined,
        topP: record.top_p !== undefined || record.topP !== undefined ? Number(record.top_p ?? record.topP) : undefined,
        variant: asOptionalString(record.variant),
        options: options ? { ...options } : undefined,
      };

      return [agentId, runtime];
    }),
  );
}

export function mapAgentProfile(filePath: string): AgentProfileSpec {
  const { data, body } = parseFrontmatter(filePath);
  rejectRemovedAgentProfileFields(data, filePath);
  const personaCore = asRecord(data.persona_core ?? data.personaCore, "persona_core");
  const responsibilityCore = asRecord(data.responsibility_core ?? data.responsibilityCore, "responsibility_core");
  const collaboration = asRecord(data.collaboration, "collaboration");
  const runtimeConfig = asRecord(data.runtime_config ?? data.runtimeConfig ?? data.capabilities, "runtime_config");

  return {
    metadata: {
      id: asString(data.id, "id"),
      name: asString(data.name, "name"),
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
      decisionPriorities: asStringArray(
        personaCore.decision_priorities ??
          personaCore.decisionPriorities ??
          personaCore.default_values ??
          personaCore.defaultValues,
        "persona_core.decision_priorities",
      ),
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
    runtimeConfig: mapRuntimeConfig(runtimeConfig) as AgentRuntimeConfig,
    outputContract: mapOutputContract(asOptionalRecord(data.output_contract ?? data.outputContract)) as OutputContract,
    executionPolicy: mapExecutionPolicy(
      asOptionalRecord(data.execution_policy ?? data.executionPolicy),
    ),
    operations: mapMinimalOperations(asOptionalRecord(data.operations), body),
    templates: mapMinimalTemplates(asOptionalRecord(data.templates), body),
    guardrails: mapGuardrails(asOptionalRecord(data.guardrails), body),
    heuristics:
      data.heuristics ? asStringArray(data.heuristics, "heuristics") : extractBullets(extractSection(body, "Unique Heuristics")),
    antiPatterns:
      data.anti_patterns ?? data.antiPatterns
        ? asStringArray(data.anti_patterns ?? data.antiPatterns, "anti_patterns")
        : extractBullets(extractSection(body, "Agent-Specific Anti-patterns")),
    examples: mapExamples(asOptionalRecord(data.examples), body),
    toolSkillStrategy: mapToolSkillStrategy(
      asOptionalRecord(data.tool_skill_strategy ?? data.toolSkillStrategy),
    ),
    entryPoint: mapEntryPoint(asOptionalRecord(data.entry_point ?? data.entryPoint)),
    promptProjection: normalizeAgentPromptProjection(
      mapPromptProjection(asOptionalRecord(data.prompt_projection ?? data.promptProjection)),
    ),
  };
}

export function mapTeamManifest(filePath: string): TeamManifest {
  const raw = parseYamlFile(filePath);
  rejectRemovedTeamManifestFields(raw, filePath);
  const id = asString(raw.id, "id");
  const name = asString(raw.name, "name");
  const mission = asRecord(raw.mission, "mission");
  const scope = asRecord(raw.scope, "scope");
  const leader = asRecord(raw.leader, "leader");
  const workflow = asOptionalRecord(raw.workflow);
  rejectRemovedWorkflowFields(workflow, filePath);
  const governance = asRecord(raw.governance, "governance");
  const governanceApprovalPolicy = asRecord(
    governance.approval_policy ?? governance.approvalPolicy,
    "governance.approval_policy",
  );
  const governanceQualityFloor = asRecord(
    governance.quality_floor ?? governance.qualityFloor,
    "governance.quality_floor",
  );
  const agentRuntime = asOptionalRecord(raw.agent_runtime ?? raw.agentRuntime);
  const resolvedWorkflowStages = workflow
    ? asStringArray(workflow.stages, "workflow.stages")
    : [];

  if (resolvedWorkflowStages.length === 0) {
    throw new Error(`${filePath} must define workflow.stages.`);
  }

  return {
    id,
    version: asString(raw.version, "version"),
    name,
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
    members: mapTeamMembers(raw.members),
    workflow: {
      stages: resolvedWorkflowStages,
    },
    governance: {
      instructionPrecedence: asStringArray(
        governance.instruction_precedence ?? governance.instructionPrecedence,
        "governance.instruction_precedence",
      ),
      approvalPolicy: {
        requiredFor: asStringArray(
          governanceApprovalPolicy.required_for ?? governanceApprovalPolicy.requiredFor,
          "governance.approval_policy.required_for",
        ),
        allowAssumeFor: asStringArray(
          governanceApprovalPolicy.allow_assume_for ?? governanceApprovalPolicy.allowAssumeFor,
          "governance.approval_policy.allow_assume_for",
        ),
      },
      forbiddenActions: asStringArray(
        governance.forbidden_actions ?? governance.forbiddenActions,
        "governance.forbidden_actions",
      ),
      qualityFloor: {
        requiredChecks: asStringArray(
          governanceQualityFloor.required_checks ?? governanceQualityFloor.requiredChecks,
          "governance.quality_floor.required_checks",
        ),
        evidenceRequired: asBoolean(
          governanceQualityFloor.evidence_required ?? governanceQualityFloor.evidenceRequired,
          "governance.quality_floor.evidence_required",
        ),
      },
      workingRules: asStringArray(
        governance.working_rules ?? governance.workingRules,
        "governance.working_rules",
      ),
    },
    agentRuntime: mapAgentRuntime(agentRuntime),
    tags: raw.tags ? asStringArray(raw.tags, "tags") : [],
    promptProjection: normalizeTeamPromptProjection(
      mapPromptProjection(asOptionalRecord(raw.prompt_projection ?? raw.promptProjection)),
    ),
  };
}
