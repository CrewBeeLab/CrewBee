import type {
  AgentExamples,
  AgentProfileSpec,
  CollaborationBindingInput,
  ExecutionPolicyTaskTriage,
  TeamManifest,
  TeamMemberGuidance,
  ToolSkillStrategySpec,
} from "../../core";
import {
  TEAM_PROJECTABLE_FIELDS,
  shouldProjectField,
} from "../../prompt-projection";
import type { ProjectedAgent } from "../../runtime";

const TEAM_SECTION_TITLES = {
  mission: "Mission",
  workingRules: "Working Rules",
  approvalSafety: "Approval & Safety",
  requiredChecks: "Required Checks",
} as const;

const AGENT_SECTION_TITLES = {
  identityRole: "Identity / Role",
  ambiguityPolicy: "Ambiguity Policy",
  taskTriage: "Task Triage",
  delegationReview: "Delegation & Review",
  todoDiscipline: "Todo Discipline",
  completionGate: "Completion Gate",
  collaboration: "Collaboration",
  operatingProcedure: "Operating Procedure",
  rulesHeuristicsAntiPatterns: "Guardrails / Heuristics / Anti-patterns",
  outputAndClosure: "Output Contract / Final Report Template / Micro Examples / Tool Strategy",
} as const;

type TeamSectionKey = keyof typeof TEAM_SECTION_TITLES;
type AgentSectionKey = keyof typeof AGENT_SECTION_TITLES;

const DEFAULT_AGENT_RENDER_ORDER = [
  "persona_core",
  "responsibility_core.description",
  "responsibility_core.objective",
  "responsibility_core.authority",
  "responsibility_core.output_preference",
  "execution_policy.ambiguity_policy",
  "execution_policy.task_triage",
  "execution_policy.delegation_policy",
  "execution_policy.review_policy",
  "execution_policy.todo_discipline",
  "execution_policy.completion_gate",
  "collaboration",
  "operations.autonomy_level",
  "operations.stop_conditions",
  "operations.core_operation_skeleton",
  "guardrails.critical",
  "heuristics",
  "anti_patterns",
  "output_contract",
  "templates.final_report",
  "examples.micro",
  "tool_skill_strategy.principles",
  "tool_skill_strategy.preferred_order",
  "tool_skill_strategy.avoid",
] as const;

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function takeStrings(values: readonly string[] | undefined): string[] {
  return unique((values ?? []).map((value) => value.trim()).filter(present));
}

function renderMemberGuidance(agentRef: string, member: TeamMemberGuidance): string {
  const parts = [`agent_ref=${agentRef}`, `responsibility=${member.responsibility}`];

  if (present(member.delegateWhen)) {
    parts.push(`delegate_when=${member.delegateWhen}`);
  }

  if (present(member.delegateMode)) {
    parts.push(`delegate_mode=${member.delegateMode}`);
  }

  return parts.join("; ");
}

function renderBinding(binding: CollaborationBindingInput): string {
  if (typeof binding === "string") {
    return `agent_ref=${binding}`;
  }

  const parts = [`agent_ref=${binding.agentRef}`];

  if (present(binding.description)) {
    parts.push(`description=${binding.description}`);
  }

  return parts.join("; ");
}

class SectionAccumulator<TSectionKey extends string> {
  private readonly order: TSectionKey[] = [];
  private readonly sections = new Map<TSectionKey, string[]>();

  constructor(private readonly titles: Record<TSectionKey, string>) {}

  private ensure(key: TSectionKey): string[] {
    if (!this.sections.has(key)) {
      this.sections.set(key, []);
      this.order.push(key);
    }

    return this.sections.get(key)!;
  }

  addRawLines(key: TSectionKey, lines: readonly string[]): void {
    const target = this.ensure(key);
    for (const line of lines) {
      target.push(line);
    }
  }

  addBullet(key: TSectionKey, text: string | undefined): void {
    if (!present(text)) {
      return;
    }

    this.addRawLines(key, [`- ${text}`]);
  }

  addKeyValue(
    key: TSectionKey,
    label: string,
    value: string | number | boolean | undefined,
  ): void {
    if (value === undefined) {
      return;
    }

    const rendered = typeof value === "boolean" ? (value ? "是" : "否") : String(value).trim();
    if (!present(rendered)) {
      return;
    }

    this.addRawLines(key, [`- ${label}: ${rendered}`]);
  }

  addList(key: TSectionKey, label: string, items: readonly string[] | undefined): void {
    const normalized = takeStrings(items);
    if (normalized.length === 0) {
      return;
    }

    this.addRawLines(key, [`- ${label}:`, ...normalized.map((item) => `  - ${item}`)]);
  }

  renderSections(): string {
    return this.order
      .map((key) => {
        const lines = this.sections.get(key) ?? [];
        if (lines.length === 0) {
          return undefined;
        }
        return [`### ${this.titles[key]}`, ...lines].join("\n");
      })
      .filter((block): block is string => Boolean(block))
      .join("\n\n");
  }
}

class RenderContext {
  constructor(readonly projected: ProjectedAgent) {}

  get team(): TeamManifest {
    return this.projected.sourceTeam.manifest;
  }

  get agent(): AgentProfileSpec {
    return this.projected.sourceAgent;
  }

  renderBindingWithGuidance(binding: CollaborationBindingInput): string {
    const base = renderBinding(binding);
    const agentRef = typeof binding === "string" ? binding : binding.agentRef;
    const member = this.team.members[agentRef];

    if (!member) {
      return base;
    }

    const guidanceWithoutAgentRef = renderMemberGuidance(agentRef, member)
      .split("; ")
      .filter((part) => !part.startsWith("agent_ref="))
      .join("; ");

    return present(guidanceWithoutAgentRef) ? `${base}; ${guidanceWithoutAgentRef}` : base;
  }
}

function getOrderedTeamProjectionEntries(team: TeamManifest): readonly string[] {
  return team.promptProjection?.include?.length ? team.promptProjection.include : TEAM_PROJECTABLE_FIELDS;
}

function getOrderedAgentProjectionEntries(agent: AgentProfileSpec): readonly string[] {
  return agent.promptProjection?.include?.length ? agent.promptProjection.include : DEFAULT_AGENT_RENDER_ORDER;
}

function renderTaskTriage(
  acc: SectionAccumulator<AgentSectionKey>,
  taskTriage: ExecutionPolicyTaskTriage | undefined,
): void {
  if (!taskTriage) {
    return;
  }

  for (const [label, bucket] of [
    ["Trivial", taskTriage.trivial],
    ["Explicit", taskTriage.explicit],
    ["Non-trivial", taskTriage.nonTrivial],
    ["Ambiguous", taskTriage.ambiguous],
  ] as const) {
    if (!bucket) {
      continue;
    }

    const lines = [`- ${label}:`];
    const signals = takeStrings(bucket.signals);
    if (signals.length > 0) {
      lines.push("  - Signals:");
      lines.push(...signals.map((signal) => `    - ${signal}`));
    }
    if (present(bucket.defaultAction)) {
      lines.push(`  - Default action: ${bucket.defaultAction}`);
    }
    acc.addRawLines("taskTriage", lines);
  }
}

function renderMicroExamples(acc: SectionAccumulator<AgentSectionKey>, examples: AgentExamples | undefined): void {
  const micro = examples?.micro;
  if (!micro) {
    return;
  }

  acc.addList("outputAndClosure", "Ambiguity resolution", micro.ambiguityResolution);
  acc.addList("outputAndClosure", "Final closure", micro.finalClosure);
}

function renderFitExamples(acc: SectionAccumulator<AgentSectionKey>, examples: AgentExamples | undefined): void {
  const fit = examples?.fit ?? {
    goodFit: examples?.goodFit,
    badFit: examples?.badFit,
  };
  if (!fit) {
    return;
  }

  acc.addList("outputAndClosure", "Good fit", fit.goodFit);
  acc.addList("outputAndClosure", "Bad fit", fit.badFit);
}

function renderToolStrategy(
  acc: SectionAccumulator<AgentSectionKey>,
  strategy: ToolSkillStrategySpec | undefined,
  field: string,
): void {
  if (!strategy) {
    return;
  }

  switch (field) {
    case "tool_skill_strategy":
      acc.addList("outputAndClosure", "Tool strategy principles", strategy.principles);
      acc.addList("outputAndClosure", "Preferred tool order", strategy.preferredOrder);
      acc.addList("outputAndClosure", "Avoid", strategy.avoid);
      return;
    case "tool_skill_strategy.principles":
      acc.addList("outputAndClosure", "Tool strategy principles", strategy.principles);
      return;
    case "tool_skill_strategy.preferred_order":
      acc.addList("outputAndClosure", "Preferred tool order", strategy.preferredOrder);
      return;
    case "tool_skill_strategy.avoid":
      acc.addList("outputAndClosure", "Avoid", strategy.avoid);
      return;
    case "tool_skill_strategy.notes":
      acc.addList("outputAndClosure", "Notes", strategy.notes);
      return;
  }
}

function renderTeamEntry(
  acc: SectionAccumulator<TeamSectionKey>,
  ctx: RenderContext,
  field: string,
): void {
  const team = ctx.team;

  switch (field) {
    case "mission":
      acc.addKeyValue("mission", "Objective", team.mission.objective);
      acc.addList("mission", "Success definition", team.mission.successDefinition);
      return;
    case "governance":
      acc.addList("workingRules", "Working rules", team.governance.workingRules);
      acc.addList("approvalSafety", "Approval required for", team.governance.approvalPolicy.requiredFor);
      acc.addList("approvalSafety", "Forbidden actions", team.governance.forbiddenActions);
      acc.addList("requiredChecks", "Required checks", team.governance.qualityFloor.requiredChecks);
      acc.addKeyValue("requiredChecks", "Evidence required", team.governance.qualityFloor.evidenceRequired);
      return;
  }
}

function renderAgentEntry(
  acc: SectionAccumulator<AgentSectionKey>,
  ctx: RenderContext,
  field: string,
): void {
  const agent = ctx.agent;

  switch (field) {
    case "persona_core":
      acc.addKeyValue("identityRole", "Temperament", agent.personaCore.temperament);
      acc.addKeyValue("identityRole", "Cognitive style", agent.personaCore.cognitiveStyle);
      acc.addKeyValue("identityRole", "Risk posture", agent.personaCore.riskPosture);
      acc.addKeyValue("identityRole", "Communication style", agent.personaCore.communicationStyle);
      acc.addKeyValue("identityRole", "Persistence style", agent.personaCore.persistenceStyle);
      acc.addKeyValue("identityRole", "Conflict style", agent.personaCore.conflictStyle);
      acc.addList("identityRole", "Decision priorities", agent.personaCore.decisionPriorities);
      return;
    case "responsibility_core":
      renderAgentEntry(acc, ctx, "responsibility_core.description");
      renderAgentEntry(acc, ctx, "responsibility_core.objective");
      renderAgentEntry(acc, ctx, "responsibility_core.authority");
      renderAgentEntry(acc, ctx, "responsibility_core.output_preference");
      return;
    case "responsibility_core.description":
      acc.addBullet("identityRole", agent.responsibilityCore.description);
      return;
    case "responsibility_core.objective":
      acc.addKeyValue("identityRole", "Objective", agent.responsibilityCore.objective);
      return;
    case "responsibility_core.authority":
      acc.addKeyValue("identityRole", "Authority", agent.responsibilityCore.authority);
      return;
    case "responsibility_core.output_preference":
      acc.addList("identityRole", "Output preference", agent.responsibilityCore.outputPreference);
      return;
    case "execution_policy":
      renderAgentEntry(acc, ctx, "execution_policy.ambiguity_policy");
      renderAgentEntry(acc, ctx, "execution_policy.task_triage");
      renderAgentEntry(acc, ctx, "execution_policy.delegation_policy");
      renderAgentEntry(acc, ctx, "execution_policy.review_policy");
      renderAgentEntry(acc, ctx, "execution_policy.todo_discipline");
      renderAgentEntry(acc, ctx, "execution_policy.completion_gate");
      renderAgentEntry(acc, ctx, "execution_policy.failure_recovery");
      return;
    case "execution_policy.ambiguity_policy":
      acc.addList("ambiguityPolicy", "Ambiguity policy", agent.executionPolicy?.ambiguityPolicy);
      return;
    case "execution_policy.task_triage":
      renderTaskTriage(acc, agent.executionPolicy?.taskTriage);
      return;
    case "execution_policy.delegation_policy":
      acc.addList("delegationReview", "Delegation policy", agent.executionPolicy?.delegationPolicy);
      return;
    case "execution_policy.review_policy":
      acc.addList("delegationReview", "Review policy", agent.executionPolicy?.reviewPolicy);
      return;
    case "execution_policy.todo_discipline":
      acc.addList("todoDiscipline", "Todo discipline", agent.executionPolicy?.todoDiscipline);
      return;
    case "execution_policy.completion_gate":
      acc.addList("completionGate", "Completion gate", agent.executionPolicy?.completionGate);
      return;
    case "execution_policy.failure_recovery":
      acc.addList("completionGate", "Failure recovery", agent.executionPolicy?.failureRecovery);
      return;
    case "collaboration":
      acc.addList(
        "collaboration",
        "Consult",
        agent.collaboration.defaultConsults.map((binding) => ctx.renderBindingWithGuidance(binding)),
      );
      acc.addList(
        "collaboration",
        "Handoff",
        agent.collaboration.defaultHandoffs.map((binding) => ctx.renderBindingWithGuidance(binding)),
      );
      return;
    case "operations":
      renderAgentEntry(acc, ctx, "operations.autonomy_level");
      renderAgentEntry(acc, ctx, "operations.stop_conditions");
      renderAgentEntry(acc, ctx, "operations.core_operation_skeleton");
      return;
    case "operations.autonomy_level":
      acc.addKeyValue("operatingProcedure", "Autonomy level", agent.operations?.autonomyLevel);
      return;
    case "operations.stop_conditions":
      acc.addList("operatingProcedure", "Stop conditions", agent.operations?.stopConditions);
      return;
    case "operations.core_operation_skeleton":
      acc.addList("operatingProcedure", "Core operation skeleton", agent.operations?.coreOperationSkeleton);
      return;
    case "guardrails":
    case "guardrails.critical":
      acc.addList("rulesHeuristicsAntiPatterns", "Critical guardrails", agent.guardrails?.critical);
      return;
    case "heuristics":
      acc.addList("rulesHeuristicsAntiPatterns", "Heuristics", agent.heuristics);
      return;
    case "anti_patterns":
      acc.addList("rulesHeuristicsAntiPatterns", "Anti-patterns", agent.antiPatterns);
      return;
    case "output_contract":
      acc.addKeyValue("outputAndClosure", "Tone", agent.outputContract.tone);
      acc.addKeyValue("outputAndClosure", "Default format", agent.outputContract.defaultFormat);
      acc.addKeyValue("outputAndClosure", "Update policy", agent.outputContract.updatePolicy);
      return;
    case "templates":
    case "templates.final_report":
      acc.addList("outputAndClosure", "Final report template", agent.templates?.finalReport);
      return;
    case "templates.exploration_checklist":
      acc.addList("outputAndClosure", "Exploration checklist", agent.templates?.explorationChecklist);
      return;
    case "templates.execution_plan":
      acc.addList("outputAndClosure", "Execution plan template", agent.templates?.executionPlan);
      return;
    case "examples":
      renderMicroExamples(acc, agent.examples);
      if (!agent.examples?.micro) {
        renderFitExamples(acc, agent.examples);
      }
      return;
    case "examples.fit":
      renderFitExamples(acc, agent.examples);
      return;
    case "examples.fit.good_fit":
      acc.addList("outputAndClosure", "Good fit", agent.examples?.fit?.goodFit);
      return;
    case "examples.fit.bad_fit":
      acc.addList("outputAndClosure", "Bad fit", agent.examples?.fit?.badFit);
      return;
    case "examples.micro":
      renderMicroExamples(acc, agent.examples);
      return;
    case "examples.micro.ambiguity_resolution":
      acc.addList("outputAndClosure", "Ambiguity resolution", agent.examples?.micro?.ambiguityResolution);
      return;
    case "examples.micro.final_closure":
      acc.addList("outputAndClosure", "Final closure", agent.examples?.micro?.finalClosure);
      return;
    case "tool_skill_strategy":
    case "tool_skill_strategy.principles":
    case "tool_skill_strategy.preferred_order":
    case "tool_skill_strategy.avoid":
    case "tool_skill_strategy.notes":
      renderToolStrategy(acc, agent.toolSkillStrategy, field);
      return;
    case "id":
      acc.addKeyValue("identityRole", "Agent ID", agent.metadata.id);
      return;
    case "name":
      acc.addKeyValue("identityRole", "Profile name", agent.metadata.name);
      return;
    case "owner":
      acc.addKeyValue("identityRole", "Agent owner", agent.metadata.owner);
      return;
    case "tags":
      acc.addList("identityRole", "Agent tags", agent.metadata.tags);
      return;
    case "archetype":
      acc.addKeyValue("identityRole", "Archetype", agent.metadata.archetype);
      return;
    case "entry_point":
      acc.addKeyValue("identityRole", "Exposure", agent.entryPoint?.exposure);
      acc.addKeyValue("identityRole", "Selection label", agent.entryPoint?.selectionLabel);
      acc.addKeyValue("identityRole", "Selection description", agent.entryPoint?.selectionDescription);
      return;
    case "runtime_config":
      return;
  }
}

function renderPart(title: string, body: string): string | undefined {
  return present(body) ? [`## ${title}`, body].join("\n\n") : undefined;
}

export function createOpenCodeAgentPrompt(agent: ProjectedAgent, _requestedTools?: readonly string[]): string {
  const ctx = new RenderContext(agent);
  const teamAcc = new SectionAccumulator<TeamSectionKey>(TEAM_SECTION_TITLES);
  const agentAcc = new SectionAccumulator<AgentSectionKey>(AGENT_SECTION_TITLES);

  for (const field of getOrderedTeamProjectionEntries(ctx.team)) {
    if (shouldProjectField(ctx.team.promptProjection, field)) {
      renderTeamEntry(teamAcc, ctx, field);
    }
  }

  for (const field of getOrderedAgentProjectionEntries(ctx.agent)) {
    if (shouldProjectField(ctx.agent.promptProjection, field)) {
      renderAgentEntry(agentAcc, ctx, field);
    }
  }

  return [
    renderPart("Team Contract", teamAcc.renderSections()),
    renderPart("Agent Contract", agentAcc.renderSections()),
  ]
    .filter((block): block is string => Boolean(block))
    .join("\n\n");
}
