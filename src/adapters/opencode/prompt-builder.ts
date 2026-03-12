import type {
  AgentProfileSpec,
  AgentTeamDefinition,
  CollaborationBindingInput,
  TeamGovernanceSpec,
  WorkingModeSpec,
} from "../../core";

import type { ProjectedAgent } from "../../runtime";

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

function section(title: string, lines: string[]): string[] {
  if (lines.length === 0) {
    return [];
  }

  return [title, ...lines];
}

function bulletList(items: readonly string[]): string[] {
  return items.filter(present).map((item) => `- ${item}`);
}

function keyValue(label: string, value?: string): string[] {
  return present(value) ? [`${label}: ${value}`] : [];
}

function inlineList(label: string, values?: readonly string[]): string[] {
  return values && values.length > 0 ? [`${label}: ${values.join(", ")}`] : [];
}

function renderBindings(bindings: readonly CollaborationBindingInput[]): string[] {
  return bindings.map((binding) => {
    if (typeof binding === "string") {
      return `- ${binding}`;
    }

    return `- ${binding.agentRef}: ${binding.description}`;
  });
}

function renderWorkingMode(workingMode: WorkingModeSpec): string[] {
  const flags: string[] = [];

  if (workingMode.humanToLeaderOnly) flags.push("human interacts through leader")
  if (workingMode.leaderDrivenCoordination) flags.push("leader-driven coordination")
  if (workingMode.singleActiveContextOwner) flags.push("single active context owner")
  if (workingMode.agentCommunicationViaSessionContext) flags.push("agent communication via session context")
  if (workingMode.explicitRoutingFilesRequired) flags.push("explicit routing files required")
  if (workingMode.explicitContractFilesRequired) flags.push("explicit contract files required")

  return bulletList(flags)
}

function renderGovernance(governance: TeamGovernanceSpec): string[] {
  return [
    ...section("Instruction Precedence:", bulletList(governance.instructionPrecedence)),
    ...section("Approval Required For:", bulletList(governance.approvalPolicy.requiredFor)),
    ...section("Approval Assume For:", bulletList(governance.approvalPolicy.allowAssumeFor)),
    ...section("Quality Checks:", bulletList(governance.qualityFloor.requiredChecks)),
    `Evidence Required: ${governance.qualityFloor.evidenceRequired ? "yes" : "no"}`,
    ...section("Working Rules:", bulletList(governance.workingRules)),
    ...section("Forbidden Actions:", bulletList(governance.forbiddenActions)),
    ...section("Governance Notes:", bulletList(governance.notes ?? [])),
  ].filter(present)
}

function createPromptHeader(agent: ProjectedAgent): string[] {
  return [
    `You are ${agent.surfaceLabel}, projected from CrewBee ${agent.teamName}.`,
    `Team ID: ${agent.teamId}`,
    `Source Agent ID: ${agent.sourceAgentId}`,
    `Role Kind: ${agent.roleKind}`,
  ]
}

function createTeamContext(team: AgentTeamDefinition): string[] {
  return [
    ...keyValue("Team Mission", team.manifest.mission.objective),
    ...section("Team Success Definition:", bulletList(team.manifest.mission.successDefinition)),
    ...keyValue("Team Description", team.manifest.description),
    ...section("Team In Scope:", bulletList(team.manifest.scope.inScope)),
    ...section("Team Out Of Scope:", bulletList(team.manifest.scope.outOfScope)),
    ...keyValue("Workflow", team.manifest.workflow.stages.join(" -> ")),
    ...section("Structure Principles:", bulletList(team.manifest.structurePrinciples ?? [])),
    ...section("Working Mode:", renderWorkingMode(team.manifest.workingMode)),
  ]
}

function createAgentIdentityContext(agent: AgentProfileSpec): string[] {
  return [
    ...keyValue("Agent Name", agent.metadata.name),
    ...keyValue("Archetype", agent.metadata.archetype),
    ...inlineList("Tags", agent.metadata.tags),
  ]
}

function createPersonaContext(agent: AgentProfileSpec): string[] {
  return [
    ...keyValue("Temperament", agent.personaCore.temperament),
    ...keyValue("Cognitive Style", agent.personaCore.cognitiveStyle),
    ...keyValue("Risk Posture", agent.personaCore.riskPosture),
    ...keyValue("Communication Style", agent.personaCore.communicationStyle),
    ...keyValue("Persistence Style", agent.personaCore.persistenceStyle),
    ...keyValue("Conflict Style", agent.personaCore.conflictStyle),
    ...section("Default Values:", bulletList(agent.personaCore.defaultValues)),
  ]
}

function createResponsibilityContext(agent: AgentProfileSpec): string[] {
  return [
    ...keyValue("Responsibility", agent.responsibilityCore.description),
    ...keyValue("Objective", agent.responsibilityCore.objective),
    ...section("Use When:", bulletList(agent.responsibilityCore.useWhen)),
    ...section("Avoid When:", bulletList(agent.responsibilityCore.avoidWhen)),
    ...section("Success Definition:", bulletList(agent.responsibilityCore.successDefinition)),
    ...section("Non Goals:", bulletList(agent.responsibilityCore.nonGoals)),
    ...section("In Scope:", bulletList(agent.responsibilityCore.inScope)),
    ...section("Out Of Scope:", bulletList(agent.responsibilityCore.outOfScope)),
    ...keyValue("Authority", agent.responsibilityCore.authority),
    ...section("Output Preference:", bulletList(agent.responsibilityCore.outputPreference ?? [])),
  ]
}

function createCollaborationContext(agent: AgentProfileSpec): string[] {
  return [
    ...section("Default Consults:", renderBindings(agent.collaboration.defaultConsults)),
    ...section("Default Handoffs:", renderBindings(agent.collaboration.defaultHandoffs)),
    ...section("Escalation Targets:", renderBindings(agent.collaboration.escalationTargets)),
  ]
}

function createCapabilityContext(agent: AgentProfileSpec, requestedTools?: readonly string[]): string[] {
  const capabilities = agent.capabilities

  return [
    `Requested Tools: ${(requestedTools ?? capabilities.requestedTools).join(", ")}`,
    `Permission Rules: ${capabilities.permission.map((rule) => `${rule.permission}:${rule.pattern}:${rule.action}`).join(", ")}`,
    ...inlineList("Instructions", capabilities.instructions),
    ...inlineList("Skills", capabilities.skills),
    ...keyValue("Memory", capabilities.memory),
    ...keyValue("Hooks", capabilities.hooks),
    ...inlineList("MCP Servers", capabilities.mcpServers),
  ]
}

function createWorkflowOverrideContext(agent: AgentProfileSpec): string[] {
  const override = agent.workflowOverride?.deviationsFromArchetypeOnly

  if (!override) {
    return []
  }

  return [
    ...keyValue("Autonomy Level", override.autonomyLevel),
    ...keyValue("Ambiguity Policy", override.ambiguityPolicy),
    ...section("Stop Conditions:", bulletList(override.stopConditions ?? [])),
  ]
}

function createOutputContractContext(agent: AgentProfileSpec): string[] {
  return [
    ...keyValue("Tone", agent.outputContract.tone),
    ...keyValue("Default Format", agent.outputContract.defaultFormat),
    ...keyValue("Update Policy", agent.outputContract.updatePolicy),
  ]
}

function createGuardrailContext(agent: AgentProfileSpec): string[] {
  return section("Critical Guardrails:", bulletList(agent.guardrails?.critical ?? []))
}

function createOperationContext(agent: AgentProfileSpec): string[] {
  return section("Core Operation Skeleton:", bulletList(agent.operations?.coreOperationSkeleton ?? []))
}

function createTemplateContext(agent: AgentProfileSpec): string[] {
  const templates = agent.templates

  if (!templates) {
    return []
  }

  return [
    ...section("Exploration Checklist Template:", bulletList(templates.explorationChecklist ?? [])),
    ...section("Execution Plan Template:", bulletList(templates.executionPlan ?? [])),
    ...section("Final Report Template:", bulletList(templates.finalReport ?? [])),
  ]
}

function createHeuristicContext(agent: AgentProfileSpec): string[] {
  return section("Unique Heuristics:", bulletList(agent.heuristics ?? []))
}

function createAntiPatternContext(agent: AgentProfileSpec): string[] {
  return section("Agent-Specific Anti-patterns:", bulletList(agent.antiPatterns ?? []))
}

function createExampleContext(agent: AgentProfileSpec): string[] {
  return [
    ...section("Good Fit Examples:", bulletList(agent.examples?.goodFit ?? [])),
    ...section("Bad Fit Examples:", bulletList(agent.examples?.badFit ?? [])),
  ]
}

function createOpsContext(agent: AgentProfileSpec): string[] {
  if (!agent.ops) {
    return []
  }

  return [
    ...inlineList("Eval Tags", agent.ops.evalTags),
    ...inlineList("Metrics", agent.ops.metrics),
    ...keyValue("Change Log", agent.ops.changeLog),
  ]
}

export function createOpenCodeAgentPrompt(agent: ProjectedAgent, requestedTools?: readonly string[]): string {
  return [
    ...createPromptHeader(agent),
    "",
    ...section("Team Context:", createTeamContext(agent.sourceTeam)),
    "",
    ...section("Agent Identity:", createAgentIdentityContext(agent.sourceAgent)),
    "",
    ...section("Persona Core:", createPersonaContext(agent.sourceAgent)),
    "",
    ...section("Responsibility Core:", createResponsibilityContext(agent.sourceAgent)),
    "",
    ...section("Collaboration:", createCollaborationContext(agent.sourceAgent)),
    "",
    ...section("Team Governance:", renderGovernance(agent.sourceTeam.manifest.governance)),
    "",
    ...section("Capabilities:", createCapabilityContext(agent.sourceAgent, requestedTools)),
    "",
    ...section("Workflow Override:", createWorkflowOverrideContext(agent.sourceAgent)),
    "",
    ...section("Output Contract:", createOutputContractContext(agent.sourceAgent)),
    "",
    ...createGuardrailContext(agent.sourceAgent),
    "",
    ...createOperationContext(agent.sourceAgent),
    "",
    ...section("Minimal Templates:", createTemplateContext(agent.sourceAgent)),
    "",
    ...createHeuristicContext(agent.sourceAgent),
    "",
    ...createAntiPatternContext(agent.sourceAgent),
    "",
    ...section("Examples:", createExampleContext(agent.sourceAgent)),
    "",
    ...section("Operational Metadata:", createOpsContext(agent.sourceAgent)),
  ].join("\n")
}
