import type {
  AgentProfileSpec,
  AgentTeamDefinition,
  CollaborationBindingInput,
  TeamGovernanceSpec,
  TeamManifest,
  WorkingModeSpec,
} from "../../core";

import { shouldProjectField } from "../../prompt-projection";
import type { ProjectedAgent } from "../../runtime";

const TEAM_FIELD_ORDER = [
  "id",
  "kind",
  "version",
  "name",
  "status",
  "owner",
  "description",
  "mission",
  "scope",
  "leader",
  "members",
  "modes",
  "working_mode",
  "workflow",
  "implementation_bias",
  "ownership_routing",
  "role_boundaries",
  "structure_principles",
  "governance",
  "agent_runtime",
  "tags",
] as const;

const AGENT_FIELD_ORDER = [
  "id",
  "kind",
  "version",
  "name",
  "status",
  "owner",
  "tags",
  "archetype",
  "persona_core",
  "responsibility_core",
  "collaboration",
  "capabilities",
  "workflow_override",
  "output_contract",
  "operations",
  "templates",
  "guardrails",
  "heuristics",
  "anti_patterns",
  "examples",
  "entry_point",
  "ops",
] as const;

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

function bulletList(items: readonly string[]): string[] {
  return items.filter(present).map((item) => `- ${item}`);
}

function scalarLine(label: string, value: string | number | boolean | undefined): string[] {
  return value === undefined ? [] : [`${label}: ${String(value)}`];
}

function inlineList(label: string, values?: readonly string[]): string[] {
  return values && values.length > 0 ? [`${label}: ${values.join(", ")}`] : [];
}

function nestedBlock(label: string, lines: string[]): string[] {
  return lines.length > 0 ? [`${label}:`, ...lines] : [];
}

function fieldBlock(label: string, lines: string[]): string[] {
  return lines.length > 0 ? [`${label}:`, ...lines] : [];
}

function renderBinding(binding: CollaborationBindingInput): string {
  if (typeof binding === "string") {
    return binding;
  }

  const parts = [
    `agent_ref=${binding.agentRef}`,
    `description=${binding.description}`,
  ];

  return parts.join("; ");
}

function renderBindings(bindings: readonly CollaborationBindingInput[]): string[] {
  return bulletList(bindings.map(renderBinding));
}

function renderWorkingMode(workingMode: WorkingModeSpec): string[] {
  return [
    ...scalarLine("human_to_leader_only", workingMode.humanToLeaderOnly),
    ...scalarLine("leader_driven_coordination", workingMode.leaderDrivenCoordination),
    ...scalarLine("single_active_context_owner", workingMode.singleActiveContextOwner),
    ...scalarLine("agent_communication_via_session_context", workingMode.agentCommunicationViaSessionContext),
    ...scalarLine("explicit_routing_files_required", workingMode.explicitRoutingFilesRequired),
    ...scalarLine("explicit_contract_files_required", workingMode.explicitContractFilesRequired),
  ];
}

function renderGovernance(governance: TeamGovernanceSpec): string[] {
  return [
    ...nestedBlock("instruction_precedence", bulletList(governance.instructionPrecedence)),
    ...nestedBlock("approval_policy", [
      ...nestedBlock("required_for", bulletList(governance.approvalPolicy.requiredFor)),
      ...nestedBlock("allow_assume_for", bulletList(governance.approvalPolicy.allowAssumeFor)),
    ]),
    ...nestedBlock("forbidden_actions", bulletList(governance.forbiddenActions)),
    ...nestedBlock("quality_floor", [
      ...nestedBlock("required_checks", bulletList(governance.qualityFloor.requiredChecks)),
      ...scalarLine("evidence_required", governance.qualityFloor.evidenceRequired),
    ]),
    ...nestedBlock("working_rules", bulletList(governance.workingRules)),
    ...nestedBlock("notes", bulletList(governance.notes ?? [])),
  ];
}

function createPromptHeader(agent: ProjectedAgent): string[] {
  return [
    `host.surface_label: ${agent.surfaceLabel}`,
    `host.team_name: ${agent.teamName}`,
    `host.team_id: ${agent.teamId}`,
    `host.source_agent_id: ${agent.sourceAgentId}`,
    `host.role_kind: ${agent.roleKind}`,
  ];
}

function renderTeamField(manifest: TeamManifest, field: (typeof TEAM_FIELD_ORDER)[number]): string[] {
  switch (field) {
    case "id":
      return scalarLine("team.id", manifest.id);
    case "kind":
      return scalarLine("team.kind", manifest.kind);
    case "version":
      return scalarLine("team.version", manifest.version);
    case "name":
      return scalarLine("team.name", manifest.name);
    case "status":
      return scalarLine("team.status", manifest.status);
    case "owner":
      return scalarLine("team.owner", manifest.owner);
    case "description":
      return scalarLine("team.description", manifest.description);
    case "mission":
      return fieldBlock("team.mission", [
        ...scalarLine("objective", manifest.mission.objective),
        ...nestedBlock("success_definition", bulletList(manifest.mission.successDefinition)),
      ]);
    case "scope":
      return fieldBlock("team.scope", [
        ...nestedBlock("in_scope", bulletList(manifest.scope.inScope)),
        ...nestedBlock("out_of_scope", bulletList(manifest.scope.outOfScope)),
      ]);
    case "leader":
      return fieldBlock("team.leader", [
        ...scalarLine("agent_ref", manifest.leader.agentRef),
        ...nestedBlock("responsibilities", bulletList(manifest.leader.responsibilities)),
      ]);
    case "members":
      return fieldBlock(
        "team.members",
        bulletList(manifest.members.map((member) => `agent_ref=${member.agentRef}; role=${member.role}`)),
      );
    case "modes":
      return fieldBlock("team.modes", bulletList(manifest.modes));
    case "working_mode":
      return fieldBlock("team.working_mode", renderWorkingMode(manifest.workingMode));
    case "workflow":
      return fieldBlock("team.workflow", [
        ...scalarLine("id", manifest.workflow.id),
        ...scalarLine("name", manifest.workflow.name),
        ...nestedBlock("stages", bulletList(manifest.workflow.stages)),
      ]);
    case "implementation_bias":
      return fieldBlock("team.implementation_bias", manifest.implementationBias ? [
        ...scalarLine("naming_mode", manifest.implementationBias.namingMode),
        ...scalarLine("routing_priority", manifest.implementationBias.routingPriority),
        ...scalarLine("prompt_emphasis", manifest.implementationBias.promptEmphasis),
        ...scalarLine("display_emphasis", manifest.implementationBias.displayEmphasis),
        ...scalarLine("persona_visibility", manifest.implementationBias.personaVisibility),
        ...scalarLine("responsibility_visibility", manifest.implementationBias.responsibilityVisibility),
      ] : []);
    case "ownership_routing":
      return fieldBlock("team.ownership_routing", manifest.ownershipRouting ? [
        ...scalarLine("default_active_owner", manifest.ownershipRouting.defaultActiveOwner),
        ...nestedBlock(
          "switch_to_management_leader_when",
          bulletList(manifest.ownershipRouting.switchToManagementLeaderWhen),
        ),
      ] : []);
    case "role_boundaries":
      return fieldBlock("team.role_boundaries", manifest.roleBoundaries ? [
        ...nestedBlock("write_execution_roles", bulletList(manifest.roleBoundaries.writeExecutionRoles)),
        ...nestedBlock("read_only_support_roles", bulletList(manifest.roleBoundaries.readOnlySupportRoles)),
      ] : []);
    case "structure_principles":
      return fieldBlock("team.structure_principles", bulletList(manifest.structurePrinciples ?? []));
    case "governance":
      return fieldBlock("team.governance", renderGovernance(manifest.governance));
    case "agent_runtime":
      return fieldBlock(
        "team.agent_runtime",
        bulletList(
          Object.entries(manifest.agentRuntime ?? {}).map(([agentId, runtime]) => {
            const parts = [
              `agent=${agentId}`,
              `provider=${runtime.provider}`,
              `model=${runtime.model}`,
            ];

            if (runtime.temperature !== undefined) parts.push(`temperature=${runtime.temperature}`);
            if (runtime.topP !== undefined) parts.push(`top_p=${runtime.topP}`);
            if (runtime.variant) parts.push(`variant=${runtime.variant}`);

            return parts.join("; ");
          }),
        ),
      );
    case "tags":
      return fieldBlock("team.tags", bulletList(manifest.tags));
  }
}

function renderAgentField(
  agent: AgentProfileSpec,
  field: (typeof AGENT_FIELD_ORDER)[number],
  requestedTools?: readonly string[],
): string[] {
  switch (field) {
    case "id":
      return scalarLine("agent.id", agent.metadata.id);
    case "kind":
      return scalarLine("agent.kind", agent.metadata.kind);
    case "version":
      return scalarLine("agent.version", agent.metadata.version);
    case "name":
      return scalarLine("agent.name", agent.metadata.name);
    case "status":
      return scalarLine("agent.status", agent.metadata.status);
    case "owner":
      return scalarLine("agent.owner", agent.metadata.owner);
    case "tags":
      return fieldBlock("agent.tags", bulletList(agent.metadata.tags ?? []));
    case "archetype":
      return scalarLine("agent.archetype", agent.metadata.archetype);
    case "persona_core":
      return fieldBlock("agent.persona_core", [
        ...scalarLine("temperament", agent.personaCore.temperament),
        ...scalarLine("cognitive_style", agent.personaCore.cognitiveStyle),
        ...scalarLine("risk_posture", agent.personaCore.riskPosture),
        ...scalarLine("communication_style", agent.personaCore.communicationStyle),
        ...scalarLine("persistence_style", agent.personaCore.persistenceStyle),
        ...scalarLine("conflict_style", agent.personaCore.conflictStyle),
        ...nestedBlock("default_values", bulletList(agent.personaCore.defaultValues)),
      ]);
    case "responsibility_core":
      return fieldBlock("agent.responsibility_core", [
        ...scalarLine("description", agent.responsibilityCore.description),
        ...nestedBlock("use_when", bulletList(agent.responsibilityCore.useWhen)),
        ...nestedBlock("avoid_when", bulletList(agent.responsibilityCore.avoidWhen)),
        ...scalarLine("objective", agent.responsibilityCore.objective),
        ...nestedBlock("success_definition", bulletList(agent.responsibilityCore.successDefinition)),
        ...nestedBlock("non_goals", bulletList(agent.responsibilityCore.nonGoals)),
        ...nestedBlock("in_scope", bulletList(agent.responsibilityCore.inScope)),
        ...nestedBlock("out_of_scope", bulletList(agent.responsibilityCore.outOfScope)),
        ...scalarLine("authority", agent.responsibilityCore.authority),
        ...nestedBlock("output_preference", bulletList(agent.responsibilityCore.outputPreference ?? [])),
      ]);
    case "collaboration":
      return fieldBlock("agent.collaboration", [
        ...nestedBlock("default_consults", renderBindings(agent.collaboration.defaultConsults)),
        ...nestedBlock("default_handoffs", renderBindings(agent.collaboration.defaultHandoffs)),
        ...nestedBlock("escalation_targets", renderBindings(agent.collaboration.escalationTargets)),
      ]);
    case "capabilities": {
      const capabilities = agent.capabilities;

      return fieldBlock("agent.capabilities", [
        ...inlineList("requested_tools", requestedTools ?? capabilities.requestedTools),
        ...nestedBlock(
          "permission",
          bulletList(
            capabilities.permission.map(
              (rule) => `permission=${rule.permission}; pattern=${rule.pattern}; action=${rule.action}`,
            ),
          ),
        ),
        ...inlineList("skills", capabilities.skills),
        ...scalarLine("memory", capabilities.memory),
        ...scalarLine("hooks", capabilities.hooks),
        ...inlineList("instructions", capabilities.instructions),
        ...inlineList("mcp_servers", capabilities.mcpServers),
      ]);
    }
    case "workflow_override": {
      const override = agent.workflowOverride?.deviationsFromArchetypeOnly;

      return fieldBlock("agent.workflow_override", override ? [
        ...nestedBlock("deviations_from_archetype_only", [
          ...scalarLine("autonomy_level", override.autonomyLevel),
          ...scalarLine("ambiguity_policy", override.ambiguityPolicy),
          ...nestedBlock("stop_conditions", bulletList(override.stopConditions ?? [])),
        ]),
      ] : []);
    }
    case "output_contract":
      return fieldBlock("agent.output_contract", [
        ...scalarLine("tone", agent.outputContract.tone),
        ...scalarLine("default_format", agent.outputContract.defaultFormat),
        ...scalarLine("update_policy", agent.outputContract.updatePolicy),
      ]);
    case "operations":
      return fieldBlock("agent.operations", [
        ...nestedBlock("core_operation_skeleton", bulletList(agent.operations?.coreOperationSkeleton ?? [])),
      ]);
    case "templates":
      return fieldBlock("agent.templates", [
        ...nestedBlock("exploration_checklist", bulletList(agent.templates?.explorationChecklist ?? [])),
        ...nestedBlock("execution_plan", bulletList(agent.templates?.executionPlan ?? [])),
        ...nestedBlock("final_report", bulletList(agent.templates?.finalReport ?? [])),
      ]);
    case "guardrails":
      return fieldBlock("agent.guardrails", [
        ...nestedBlock("critical", bulletList(agent.guardrails?.critical ?? [])),
      ]);
    case "heuristics":
      return fieldBlock("agent.heuristics", bulletList(agent.heuristics ?? []));
    case "anti_patterns":
      return fieldBlock("agent.anti_patterns", bulletList(agent.antiPatterns ?? []));
    case "examples":
      return fieldBlock("agent.examples", [
        ...nestedBlock("good_fit", bulletList(agent.examples?.goodFit ?? [])),
        ...nestedBlock("bad_fit", bulletList(agent.examples?.badFit ?? [])),
      ]);
    case "entry_point":
      return fieldBlock("agent.entry_point", agent.entryPoint ? [
        ...scalarLine("exposure", agent.entryPoint.exposure),
        ...scalarLine("selection_label", agent.entryPoint.selectionLabel),
        ...scalarLine("selection_description", agent.entryPoint.selectionDescription),
      ] : []);
    case "ops":
      return fieldBlock("agent.ops", agent.ops ? [
        ...inlineList("eval_tags", agent.ops.evalTags),
        ...inlineList("metrics", agent.ops.metrics),
        ...scalarLine("change_log", agent.ops.changeLog),
      ] : []);
  }
}

function createTeamBlocks(team: AgentTeamDefinition): string[][] {
  return TEAM_FIELD_ORDER
    .filter((field) => shouldProjectField(team.manifest.promptProjection, field))
    .map((field) => renderTeamField(team.manifest, field));
}

function createAgentBlocks(agent: AgentProfileSpec, requestedTools?: readonly string[]): string[][] {
  return AGENT_FIELD_ORDER
    .filter((field) => shouldProjectField(agent.promptProjection, field))
    .map((field) => renderAgentField(agent, field, requestedTools));
}

function joinBlocks(blocks: string[][]): string {
  return blocks
    .filter((block) => block.length > 0)
    .map((block) => block.join("\n"))
    .join("\n\n");
}

export function createOpenCodeAgentPrompt(agent: ProjectedAgent, requestedTools?: readonly string[]): string {
  return joinBlocks([
    createPromptHeader(agent),
    ...createTeamBlocks(agent.sourceTeam),
    ...createAgentBlocks(agent.sourceAgent, requestedTools),
  ]);
}
