import type { AgentProfileSpec, AgentTeamDefinition } from "../../core";

import type { CatalogAgentProjection } from "../../runtime";

function createPromptHeader(agent: CatalogAgentProjection): string[] {
  return [
    `You are ${agent.surfaceLabel}, projected from CrewBee ${agent.teamName}.`,
    `Team ID: ${agent.teamId}`,
    `Source Agent ID: ${agent.sourceAgentId}`,
    `Role Kind: ${agent.roleKind}`,
  ];
}

function createTeamContext(team: AgentTeamDefinition): string[] {
  return [
    `Team Mission: ${team.manifest.mission.objective}`,
    `Team Description: ${team.manifest.description}`,
    `Workflow: ${team.manifest.workflow.stages.join(" -> ")}`,
  ];
}

function createAgentContext(agent: AgentProfileSpec): string[] {
  return [
    `Responsibility: ${agent.responsibilityCore.description}`,
    `Objective: ${agent.responsibilityCore.objective}`,
    `Use When: ${agent.responsibilityCore.useWhen.join("; ")}`,
    `Avoid When: ${agent.responsibilityCore.avoidWhen.join("; ")}`,
  ];
}

function createPolicyContext(team: AgentTeamDefinition): string[] {
  return [
    "Working Rules:",
    ...team.manifest.governance.workingRules.map((rule) => `- ${rule}`),
    "Forbidden Actions:",
    ...team.manifest.governance.forbiddenActions.map((rule) => `- ${rule}`),
  ];
}

function createCapabilityContext(agent: AgentProfileSpec, requestedTools?: readonly string[]): string[] {
  const capabilities = agent.capabilities;

  return [
    `Requested Tools: ${(requestedTools ?? capabilities.requestedTools).join(", ")}`,
    `Permission Rules: ${capabilities.permission.map((rule) => `${rule.permission}:${rule.pattern}:${rule.action}`).join(", ")}`,
    ...(capabilities.instructions && capabilities.instructions.length > 0
      ? [`Instructions: ${capabilities.instructions.join(", ")}`]
      : []),
    ...(capabilities.skills && capabilities.skills.length > 0
      ? [`Skills: ${capabilities.skills.join(", ")}`]
      : []),
  ];
}

export function createOpenCodeAgentPrompt(agent: CatalogAgentProjection, requestedTools?: readonly string[]): string {
  return [
    ...createPromptHeader(agent),
    "",
    ...createTeamContext(agent.sourceTeam),
    "",
    ...createAgentContext(agent.sourceAgent),
    "",
    ...createPolicyContext(agent.sourceTeam),
    "",
    ...createCapabilityContext(agent.sourceAgent, requestedTools),
  ].join("\n");
}
