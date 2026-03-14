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
  MinimalOperations,
  MinimalTemplates,
  OutputContract,
  PromptProjectionSpec,
  TeamManifest,
  TeamMemberMap,
  TeamAgentRuntimeMap,
  WorkflowOverride,
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

function rejectRemovedAgentProfileFields(data: UnknownRecord, filePath: string): void {
  const removedFields = ["role_boundary", "roleBoundary"];

  for (const field of removedFields) {
    if (data[field] !== undefined) {
      throw new Error(`${filePath} no longer supports agent profile field '${field}'. Remove stale role boundary metadata from the agent profile.`);
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

  return { goodFit, badFit };
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
    runtimeConfig: mapRuntimeConfig(
      asOptionalRecord(record.runtime_config ?? record.runtimeConfig ?? record.capabilities),
    ),
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
    workflowOverride: mapWorkflowOverride(asOptionalRecord(data.workflow_override ?? data.workflowOverride)),
    outputContract: mapOutputContract(asOptionalRecord(data.output_contract ?? data.outputContract)) as OutputContract,
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
    kind: "agent-team",
    version: asString(raw.version, "version"),
    name,
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
    members: mapTeamMembers(raw.members),
    workflow: {
      id: workflow ? asString(workflow.id, "workflow.id") : `${id}-default`,
      name: workflow ? asString(workflow.name, "workflow.name") : `${name} default workflow`,
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
