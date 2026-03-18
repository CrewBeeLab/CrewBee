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
} as const;

const AGENT_SECTION_TITLES = {
  identityRole: "Identity / Role",
  corePrinciple: "Core Principle",
  dateAwareness: "Date Awareness",
  requestClassification: "Request Classification",
  documentationDiscovery: "Documentation Discovery",
  researchPathPolicy: "Research Path Policy",
  sourcePriority: "Source Priority",
  versionPolicy: "Version Policy",
  evidencePolicy: "Evidence Policy",
  parallelismPolicy: "Parallelism Policy",
  outputPolicy: "Output Policy",
  scopeControl: "Scope Control",
  ambiguityPolicy: "Ambiguity Policy",
  supportTriggers: "Support Triggers",
  repositoryAssessment: "Repository Assessment",
  concernEscalationPolicy: "Concern Escalation Policy",
  taskTriage: "Task Triage",
  delegationReview: "Delegation & Review",
  todoDiscipline: "Todo Discipline",
  completionGate: "Completion Gate",
  failureRecovery: "Failure Recovery",
  collaboration: "Collaboration",
  operatingProcedure: "Operating Procedure",
  rulesHeuristicsAntiPatterns: "Guardrails / Heuristics / Anti-patterns",
  outputAndClosure: "Output Contract / Final Report Template / Tool Strategy",
} as const;

type TeamSectionKey = keyof typeof TEAM_SECTION_TITLES;
type AgentSectionKey = keyof typeof AGENT_SECTION_TITLES;

const DEFAULT_AGENT_RENDER_ORDER = [
  "persona_core",
  "responsibility_core.description",
  "responsibility_core.objective",
  "responsibility_core.authority",
  "responsibility_core.output_preference",
  "execution_policy.core_principle",
  "execution_policy.date_awareness",
  "execution_policy.request_classification",
  "execution_policy.documentation_discovery",
  "execution_policy.research_path_policy",
  "execution_policy.source_priority",
  "execution_policy.version_policy",
  "execution_policy.evidence_policy",
  "execution_policy.parallelism_policy",
  "execution_policy.output_policy",
  "execution_policy.scope_control",
  "execution_policy.ambiguity_policy",
  "execution_policy.support_triggers",
  "execution_policy.repository_assessment",
  "execution_policy.concern_escalation_policy",
  "execution_policy.task_triage",
  "execution_policy.delegation_policy",
  "execution_policy.review_policy",
  "execution_policy.todo_discipline",
  "execution_policy.completion_gate",
  "execution_policy.failure_recovery",
  "collaboration",
  "operations.autonomy_level",
  "operations.stop_conditions",
  "operations.core_operation_skeleton",
  "guardrails.critical",
  "heuristics",
  "anti_patterns",
  "output_contract",
  "templates.final_report",
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

function trimTrailingPunctuation(text: string | undefined): string | undefined {
  if (!present(text)) {
    return undefined;
  }

  const trimmed = text.trim().replace(/[。；;，,：:\s]+$/u, "");
  return present(trimmed) ? trimmed : undefined;
}

function renderCollaborationUsage(text: string | undefined): string | undefined {
  const trimmed = trimTrailingPunctuation(text);
  if (!present(trimmed)) {
    return undefined;
  }

  return trimmed.endsWith("时") ? `${trimmed}使用` : trimmed;
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
    if (lines.length === 0) {
      return;
    }

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
    const agentRef = typeof binding === "string" ? binding : binding.agentRef;
    const member = this.team.members[agentRef];

    if (!member) {
      const fallback = typeof binding === "string" ? undefined : trimTrailingPunctuation(binding.description);
      return present(fallback) ? `${agentRef}：${fallback}` : agentRef;
    }

    const parts = [`${agentRef}：${trimTrailingPunctuation(member.responsibility) ?? agentRef}`];
    const usage = renderCollaborationUsage(member.delegateWhen);
    if (present(usage)) {
      parts.push(usage);
    }

    return parts.join("；");
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
      return;
    case "governance":
      acc.addRawLines("workingRules", takeStrings(team.governance.workingRules).map((rule) => `- ${rule}`));
      acc.addList("approvalSafety", "Approval required for", team.governance.approvalPolicy.requiredFor);
      acc.addList("approvalSafety", "Forbidden actions", team.governance.forbiddenActions);
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
      renderAgentEntry(acc, ctx, "execution_policy.core_principle");
      renderAgentEntry(acc, ctx, "execution_policy.date_awareness");
      renderAgentEntry(acc, ctx, "execution_policy.request_classification");
      renderAgentEntry(acc, ctx, "execution_policy.documentation_discovery");
      renderAgentEntry(acc, ctx, "execution_policy.research_path_policy");
      renderAgentEntry(acc, ctx, "execution_policy.source_priority");
      renderAgentEntry(acc, ctx, "execution_policy.version_policy");
      renderAgentEntry(acc, ctx, "execution_policy.evidence_policy");
      renderAgentEntry(acc, ctx, "execution_policy.parallelism_policy");
      renderAgentEntry(acc, ctx, "execution_policy.output_policy");
      renderAgentEntry(acc, ctx, "execution_policy.scope_control");
      renderAgentEntry(acc, ctx, "execution_policy.ambiguity_policy");
      renderAgentEntry(acc, ctx, "execution_policy.support_triggers");
      renderAgentEntry(acc, ctx, "execution_policy.repository_assessment");
      renderAgentEntry(acc, ctx, "execution_policy.concern_escalation_policy");
      renderAgentEntry(acc, ctx, "execution_policy.task_triage");
      renderAgentEntry(acc, ctx, "execution_policy.delegation_policy");
      renderAgentEntry(acc, ctx, "execution_policy.review_policy");
      renderAgentEntry(acc, ctx, "execution_policy.todo_discipline");
      renderAgentEntry(acc, ctx, "execution_policy.completion_gate");
      renderAgentEntry(acc, ctx, "execution_policy.failure_recovery");
      return;
    case "execution_policy.core_principle":
      acc.addRawLines("corePrinciple", takeStrings(agent.executionPolicy?.corePrinciple).map((item) => `- ${item}`));
      return;
    case "execution_policy.date_awareness":
      acc.addList("dateAwareness", "Date awareness", agent.executionPolicy?.dateAwareness);
      return;
    case "execution_policy.request_classification":
      acc.addList("requestClassification", "Request classification", agent.executionPolicy?.requestClassification);
      return;
    case "execution_policy.documentation_discovery":
      acc.addList("documentationDiscovery", "Documentation discovery", agent.executionPolicy?.documentationDiscovery);
      return;
    case "execution_policy.research_path_policy":
      acc.addList("researchPathPolicy", "Research path policy", agent.executionPolicy?.researchPathPolicy);
      return;
    case "execution_policy.source_priority":
      acc.addList("sourcePriority", "Source priority", agent.executionPolicy?.sourcePriority);
      return;
    case "execution_policy.version_policy":
      acc.addList("versionPolicy", "Version policy", agent.executionPolicy?.versionPolicy);
      return;
    case "execution_policy.evidence_policy":
      acc.addList("evidencePolicy", "Evidence policy", agent.executionPolicy?.evidencePolicy);
      return;
    case "execution_policy.parallelism_policy":
      acc.addList("parallelismPolicy", "Parallelism policy", agent.executionPolicy?.parallelismPolicy);
      return;
    case "execution_policy.output_policy":
      acc.addList("outputPolicy", "Output policy", agent.executionPolicy?.outputPolicy);
      return;
    case "execution_policy.scope_control":
      acc.addRawLines("scopeControl", takeStrings(agent.executionPolicy?.scopeControl).map((item) => `- ${item}`));
      return;
    case "execution_policy.ambiguity_policy":
      acc.addList("ambiguityPolicy", "Ambiguity policy", agent.executionPolicy?.ambiguityPolicy);
      return;
    case "execution_policy.support_triggers":
      acc.addRawLines("supportTriggers", takeStrings(agent.executionPolicy?.supportTriggers).map((item) => `- ${item}`));
      return;
    case "execution_policy.repository_assessment":
      acc.addRawLines(
        "repositoryAssessment",
        takeStrings(agent.executionPolicy?.repositoryAssessment).map((item) => `- ${item}`),
      );
      return;
    case "execution_policy.concern_escalation_policy":
      acc.addRawLines(
        "concernEscalationPolicy",
        takeStrings(agent.executionPolicy?.concernEscalationPolicy).map((item) => `- ${item}`),
      );
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
      acc.addRawLines("failureRecovery", takeStrings(agent.executionPolicy?.failureRecovery).map((item) => `- ${item}`));
      return;
    case "collaboration":
      acc.addRawLines("collaboration", [
        ...agent.collaboration.defaultConsults.map((binding) => `- ${ctx.renderBindingWithGuidance(binding)}`),
        ...agent.collaboration.defaultHandoffs.map((binding) => `- ${ctx.renderBindingWithGuidance(binding)}`),
      ]);
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
