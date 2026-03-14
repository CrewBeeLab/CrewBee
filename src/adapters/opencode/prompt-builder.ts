import type {
  AgentProfileSpec,
  AgentTeamDefinition,
  CollaborationBindingInput,
  TeamMemberGuidance,
  TeamManifest,
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
  "workflow",
  "governance",
  "agent_runtime",
  "tags",
] as const;

const AGENT_FIELD_ORDER = [
  "id",
  "name",
  "owner",
  "tags",
  "persona_core",
  "responsibility_core",
  "collaboration",
  "workflow_override",
  "output_contract",
  "operations",
  "templates",
  "guardrails",
  "heuristics",
  "anti_patterns",
  "examples",
  "entry_point",
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

  const parts = [`agent_ref=${binding.agentRef}`, `description=${binding.description}`];

  return parts.join("; ");
}

function renderBindings(bindings: readonly CollaborationBindingInput[]): string[] {
  return bulletList(bindings.map(renderBinding));
}

function renderMemberGuidance(agentRef: string, member: TeamMemberGuidance): string {
  const parts = [
    `agent_ref=${agentRef}`,
    `responsibility=${member.responsibility}`,
  ];

  if (present(member.delegateWhen)) {
    parts.push(`delegate_when=${member.delegateWhen}`);
  }

  if (present(member.delegateMode)) {
    parts.push(`delegate_mode=${member.delegateMode}`);
  }

  return parts.join("; ");
}

function renderLeaderGuidance(manifest: TeamManifest): string {
  return [
    `agent_ref=${manifest.leader.agentRef}`,
    `responsibility=${manifest.leader.responsibilities.join(" / ")}`,
  ].join("; ");
}

function getBindingAgentRef(binding: CollaborationBindingInput): string {
  return typeof binding === "string" ? binding : binding.agentRef;
}

function renderGuidanceBinding(manifest: TeamManifest, binding: CollaborationBindingInput): string | undefined {
  const agentRef = getBindingAgentRef(binding);
  const parts = [
    manifest.members[agentRef]
      ? renderMemberGuidance(agentRef, manifest.members[agentRef])
      : agentRef === manifest.leader.agentRef
        ? renderLeaderGuidance(manifest)
        : undefined,
  ].filter((value): value is string => Boolean(value));

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join("; ");
}

function renderGuidanceBindings(manifest: TeamManifest, bindings: readonly CollaborationBindingInput[]): string[] {
  return bulletList(
    bindings
      .map((binding) => renderGuidanceBinding(manifest, binding))
      .filter((value): value is string => Boolean(value)),
  );
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
        bulletList(
          Object.entries(manifest.members).map(([agentRef, member]) => renderMemberGuidance(agentRef, member)),
        ),
      );
    case "workflow":
      return fieldBlock("team.workflow", [
        ...scalarLine("id", manifest.workflow.id),
        ...scalarLine("name", manifest.workflow.name),
        ...nestedBlock("stages", bulletList(manifest.workflow.stages)),
      ]);
    case "governance":
      return fieldBlock("team.governance", [
        ...nestedBlock("instruction_precedence", bulletList(manifest.governance.instructionPrecedence)),
        ...nestedBlock("approval_policy", [
          ...nestedBlock("required_for", bulletList(manifest.governance.approvalPolicy.requiredFor)),
          ...nestedBlock("allow_assume_for", bulletList(manifest.governance.approvalPolicy.allowAssumeFor)),
        ]),
        ...nestedBlock("forbidden_actions", bulletList(manifest.governance.forbiddenActions)),
        ...nestedBlock("quality_floor", [
          ...nestedBlock("required_checks", bulletList(manifest.governance.qualityFloor.requiredChecks)),
          ...scalarLine("evidence_required", manifest.governance.qualityFloor.evidenceRequired),
        ]),
        ...nestedBlock("working_rules", bulletList(manifest.governance.workingRules)),
      ]);
    case "agent_runtime":
      return fieldBlock(
        "team.agent_runtime",
        bulletList(
          Object.entries(manifest.agentRuntime ?? {}).map(([agentId, runtime]) => {
            const parts = [`agent=${agentId}`, `provider=${runtime.provider}`, `model=${runtime.model}`];

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

function renderAgentField(agent: AgentProfileSpec, field: (typeof AGENT_FIELD_ORDER)[number]): string[] {
  switch (field) {
    case "id":
      return scalarLine("agent.id", agent.metadata.id);
    case "name":
      return scalarLine("agent.name", agent.metadata.name);
    case "owner":
      return scalarLine("agent.owner", agent.metadata.owner);
    case "tags":
      return fieldBlock("agent.tags", bulletList(agent.metadata.tags ?? []));
    case "persona_core":
      return fieldBlock("agent.persona_core", [
        ...scalarLine("temperament", agent.personaCore.temperament),
        ...scalarLine("cognitive_style", agent.personaCore.cognitiveStyle),
        ...scalarLine("risk_posture", agent.personaCore.riskPosture),
        ...scalarLine("communication_style", agent.personaCore.communicationStyle),
        ...scalarLine("persistence_style", agent.personaCore.persistenceStyle),
        ...scalarLine("conflict_style", agent.personaCore.conflictStyle),
        ...nestedBlock("decision_priorities", bulletList(agent.personaCore.decisionPriorities)),
      ]);
    case "responsibility_core":
      return fieldBlock("agent.responsibility_core", [
        ...scalarLine("description", agent.responsibilityCore.description),
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
      ]);
    case "workflow_override": {
      const override = agent.workflowOverride?.deviationsFromArchetypeOnly;

      return fieldBlock(
        "agent.workflow_override",
        override
          ? [
              ...nestedBlock("deviations_from_archetype_only", [
                ...scalarLine("autonomy_level", override.autonomyLevel),
                ...nestedBlock("stop_conditions", bulletList(override.stopConditions ?? [])),
              ]),
            ]
          : [],
      );
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
      return fieldBlock(
        "agent.entry_point",
        agent.entryPoint
          ? [
              ...scalarLine("exposure", agent.entryPoint.exposure),
              ...scalarLine("selection_label", agent.entryPoint.selectionLabel),
              ...scalarLine("selection_description", agent.entryPoint.selectionDescription),
            ]
          : [],
      );
  }
}

function createTeamBlocks(team: AgentTeamDefinition): string[][] {
  return TEAM_FIELD_ORDER
    .filter((field) => shouldProjectField(team.manifest.promptProjection, field))
    .map((field) => renderTeamField(team.manifest, field));
}

function createAgentBlocks(agent: AgentProfileSpec): string[][] {
  return AGENT_FIELD_ORDER
    .filter((field) => shouldProjectField(agent.promptProjection, field))
    .map((field) => renderAgentField(agent, field));
}

function createCollaborationGuidanceBlock(agent: ProjectedAgent): string[] {
  return fieldBlock("agent.collaboration_guidance", [
    ...nestedBlock(
      "consult_targets",
      renderGuidanceBindings(agent.sourceTeam.manifest, agent.sourceAgent.collaboration.defaultConsults),
    ),
    ...nestedBlock(
      "handoff_targets",
      renderGuidanceBindings(agent.sourceTeam.manifest, agent.sourceAgent.collaboration.defaultHandoffs),
    ),
  ]);
}

function joinBlocks(blocks: string[][]): string {
  return blocks
    .filter((block) => block.length > 0)
    .map((block) => block.join("\n"))
    .join("\n\n");
}

export function createOpenCodeAgentPrompt(agent: ProjectedAgent, _requestedTools?: readonly string[]): string {
  return joinBlocks([
    createPromptHeader(agent),
    ...createTeamBlocks(agent.sourceTeam),
    ...createAgentBlocks(agent.sourceAgent),
    createCollaborationGuidanceBlock(agent),
  ]);
}
