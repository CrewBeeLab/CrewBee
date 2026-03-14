import type {
  AgentProfileSpec,
  CollaborationBindingInput,
  TeamManifest,
  TeamMemberGuidance,
} from "../../core";
import {
  AGENT_PROJECTABLE_FIELDS,
  TEAM_PROJECTABLE_FIELDS,
  shouldProjectField,
  type AgentProjectableField,
  type TeamProjectableField,
} from "../../prompt-projection";
import type { ProjectedAgent } from "../../runtime";

const TEAM_SECTION_TITLES = {
  context: "Context",
  mission: "Mission",
  scope: "Scope",
  workflow: "Workflow",
  governance: "Governance",
} as const;

const AGENT_SECTION_TITLES = {
  role: "Role",
  objective: "Objective",
  successCriteria: "Success Criteria",
  boundaries: "Boundaries",
  workingStyle: "Working Style",
  collaboration: "Collaboration",
  workflow: "Workflow",
  operatingProcedure: "Operating Procedure",
  output: "Output",
  toolSkillStrategy: "Tool & Skill Strategy",
  templates: "Templates",
  guardrails: "Guardrails",
  heuristics: "Heuristics",
  antiPatterns: "Anti-patterns",
  examples: "Examples",
  entryPoint: "Entry Point",
} as const;

type TeamSectionKey = keyof typeof TEAM_SECTION_TITLES;
type AgentSectionKey = keyof typeof AGENT_SECTION_TITLES;

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

  private pushLine(key: TSectionKey, line: string): void {
    const lines = this.ensure(key);

    if (!lines.includes(line)) {
      lines.push(line);
    }
  }

  addBullet(key: TSectionKey, text: string | undefined): void {
    if (!present(text)) {
      return;
    }

    this.pushLine(key, `- ${text}`);
  }

  addKeyValue(
    key: TSectionKey,
    label: string,
    value: string | number | boolean | undefined,
  ): void {
    if (value === undefined) {
      return;
    }

    const rendered =
      typeof value === "boolean"
        ? value
          ? "是"
          : "否"
        : String(value).trim();

    if (!present(rendered)) {
      return;
    }

    this.pushLine(key, `- ${label}: ${rendered}`);
  }

  addList(key: TSectionKey, label: string, items: readonly string[] | undefined): void {
    const normalized = takeStrings(items);

    if (normalized.length === 0) {
      return;
    }

    this.pushLine(key, `- ${label}:`);
    for (const item of normalized) {
      this.pushLine(key, `  - ${item}`);
    }
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

    return present(guidanceWithoutAgentRef)
      ? `${base}; ${guidanceWithoutAgentRef}`
      : base;
  }
}

function renderTeamField(
  acc: SectionAccumulator<TeamSectionKey>,
  ctx: RenderContext,
  field: TeamProjectableField,
): void {
  const team = ctx.team;

  switch (field) {
    case "description":
      acc.addBullet("context", team.description);
      return;
    case "mission":
      acc.addKeyValue("mission", "Objective", team.mission.objective);
      acc.addList("mission", "Success definition", team.mission.successDefinition);
      return;
    case "scope":
      acc.addList("scope", "In scope", team.scope.inScope);
      acc.addList("scope", "Out of scope", team.scope.outOfScope);
      return;
    case "workflow":
      acc.addList("workflow", "Stages", team.workflow.stages);
      return;
    case "governance":
      acc.addList("governance", "Instruction precedence", team.governance.instructionPrecedence);
      acc.addList("governance", "Approval required for", team.governance.approvalPolicy.requiredFor);
      acc.addList("governance", "Allow assume for", team.governance.approvalPolicy.allowAssumeFor);
      acc.addList("governance", "Forbidden actions", team.governance.forbiddenActions);
      acc.addList("governance", "Required checks", team.governance.qualityFloor.requiredChecks);
      acc.addKeyValue("governance", "Evidence required", team.governance.qualityFloor.evidenceRequired);
      acc.addList("governance", "Working rules", team.governance.workingRules);
      return;
    case "id":
      acc.addKeyValue("context", "Team ID", team.id);
      return;
    case "name":
      acc.addKeyValue("context", "Team name", team.name);
      return;
    case "version":
      acc.addKeyValue("context", "Team version", team.version);
      return;
    case "tags":
      acc.addList("context", "Team tags", team.tags);
      return;
  }
}

function renderAgentField(
  acc: SectionAccumulator<AgentSectionKey>,
  ctx: RenderContext,
  field: AgentProjectableField,
): void {
  const agent = ctx.agent;

  switch (field) {
    case "responsibility_core":
      acc.addBullet("role", agent.responsibilityCore.description);
      acc.addKeyValue("objective", "Objective", agent.responsibilityCore.objective);
      acc.addList("successCriteria", "Success definition", agent.responsibilityCore.successDefinition);
      acc.addList("boundaries", "Non-goals", agent.responsibilityCore.nonGoals);
      acc.addList("boundaries", "Avoid when", agent.responsibilityCore.avoidWhen);
      acc.addList("boundaries", "In scope", agent.responsibilityCore.inScope);
      acc.addList("boundaries", "Out of scope", agent.responsibilityCore.outOfScope);
      acc.addKeyValue("boundaries", "Authority", agent.responsibilityCore.authority);
      acc.addList("output", "Output preference", agent.responsibilityCore.outputPreference);
      return;
    case "persona_core":
      acc.addKeyValue("workingStyle", "Temperament", agent.personaCore.temperament);
      acc.addKeyValue("workingStyle", "Cognitive style", agent.personaCore.cognitiveStyle);
      acc.addKeyValue("workingStyle", "Risk posture", agent.personaCore.riskPosture);
      acc.addKeyValue("workingStyle", "Communication style", agent.personaCore.communicationStyle);
      acc.addKeyValue("workingStyle", "Persistence style", agent.personaCore.persistenceStyle);
      acc.addKeyValue("workingStyle", "Conflict style", agent.personaCore.conflictStyle);
      acc.addList("workingStyle", "Decision priorities", agent.personaCore.decisionPriorities);
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
    case "workflow_override": {
      const override = agent.workflowOverride?.deviationsFromArchetypeOnly;
      acc.addKeyValue("workflow", "Autonomy level", override?.autonomyLevel);
      acc.addList("workflow", "Stop conditions", override?.stopConditions);
      return;
    }
    case "output_contract":
      acc.addKeyValue("output", "Tone", agent.outputContract.tone);
      acc.addKeyValue("output", "Default format", agent.outputContract.defaultFormat);
      acc.addKeyValue("output", "Update policy", agent.outputContract.updatePolicy);
      return;
    case "operations":
      acc.addList("operatingProcedure", "Core operation skeleton", agent.operations?.coreOperationSkeleton);
      return;
    case "templates":
      acc.addList("templates", "Exploration checklist", agent.templates?.explorationChecklist);
      acc.addList("templates", "Execution plan", agent.templates?.executionPlan);
      acc.addList("templates", "Final report", agent.templates?.finalReport);
      return;
    case "guardrails":
      acc.addList("guardrails", "Critical guardrails", agent.guardrails?.critical);
      return;
    case "heuristics":
      acc.addList("heuristics", "Heuristics", agent.heuristics);
      return;
    case "anti_patterns":
      acc.addList("antiPatterns", "Anti-patterns", agent.antiPatterns);
      return;
    case "examples":
      acc.addList("examples", "Good fit", agent.examples?.goodFit);
      acc.addList("examples", "Bad fit", agent.examples?.badFit);
      return;
    case "tool_skill_strategy":
      acc.addList("toolSkillStrategy", "Principles", agent.toolSkillStrategy?.principles);
      acc.addList("toolSkillStrategy", "Preferred order", agent.toolSkillStrategy?.preferredOrder);
      acc.addList("toolSkillStrategy", "Avoid", agent.toolSkillStrategy?.avoid);
      acc.addList("toolSkillStrategy", "Notes", agent.toolSkillStrategy?.notes);
      return;
    case "entry_point":
      acc.addKeyValue("entryPoint", "Exposure", agent.entryPoint?.exposure);
      acc.addKeyValue("entryPoint", "Selection label", agent.entryPoint?.selectionLabel);
      acc.addKeyValue("entryPoint", "Selection description", agent.entryPoint?.selectionDescription);
      return;
    case "id":
      acc.addKeyValue("role", "Agent ID", agent.metadata.id);
      return;
    case "name":
      acc.addKeyValue("role", "Profile name", agent.metadata.name);
      return;
    case "owner":
      acc.addKeyValue("role", "Agent owner", agent.metadata.owner);
      return;
    case "tags":
      acc.addList("role", "Agent tags", agent.metadata.tags);
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

  for (const field of TEAM_PROJECTABLE_FIELDS) {
    if (shouldProjectField(ctx.team.promptProjection, field)) {
      renderTeamField(teamAcc, ctx, field);
    }
  }

  for (const field of AGENT_PROJECTABLE_FIELDS) {
    if (shouldProjectField(ctx.agent.promptProjection, field)) {
      renderAgentField(agentAcc, ctx, field);
    }
  }

  return [
    renderPart("Team Contract", teamAcc.renderSections()),
    renderPart("Agent Contract", agentAcc.renderSections()),
  ]
    .filter((block): block is string => Boolean(block))
    .join("\n\n");
}
