import type { AgentTeamDefinition, TeamLibrary } from "../core";

import { EMBEDDED_TEAM_IDS } from "./constants";
import type { TeamValidationIssue } from "./types";

export function validateTeamDefinition(team: AgentTeamDefinition): TeamValidationIssue[] {
  const issues: TeamValidationIssue[] = [];
  const agentIds = new Set(team.agents.map((agent) => agent.metadata.id));
  const { manifest } = team;

  if (!agentIds.has(manifest.leader.agentRef)) {
    issues.push({
      level: "error",
      message: `Leader agent '${manifest.leader.agentRef}' is not defined in this Team.`,
    });
  }

  for (const member of manifest.members) {
    if (!agentIds.has(member.agentRef)) {
      issues.push({
        level: "error",
        message: `Member agent '${member.agentRef}' is not defined in this Team.`,
      });
    }
  }

  for (const [agentId] of Object.entries(manifest.agentRuntime ?? {})) {
    if (!agentIds.has(agentId)) {
      issues.push({
        level: "error",
        message: `Agent runtime override '${agentId}' is not defined in this Team.`,
      });
    }
  }

  for (const agent of team.agents) {
    const requestedTools = new Set(agent.runtimeConfig.requestedTools);

    if (requestedTools.size === 0) {
      issues.push({
        level: "error",
        message: `Agent '${agent.metadata.id}' must declare at least one requested tool.`,
      });
    }

    if (agent.runtimeConfig.permission.length === 0) {
      issues.push({
        level: "error",
        message: `Agent '${agent.metadata.id}' must declare at least one permission rule.`,
      });
    }
  }

  if (manifest.governance.instructionPrecedence.length === 0) {
    issues.push({
      level: "error",
      message: `Team '${manifest.id}' must define governance.instructionPrecedence.`,
    });
  }

  if (manifest.governance.workingRules.length === 0) {
    issues.push({
      level: "error",
      message: `Team '${manifest.id}' must define governance.workingRules.`,
    });
  }

  if (manifest.governance.qualityFloor.requiredChecks.length === 0) {
    issues.push({
      level: "error",
      message: `Team '${manifest.id}' must define governance.qualityFloor.requiredChecks.`,
    });
  }

  if (!team.documentation?.teamReadme && !EMBEDDED_TEAM_IDS.includes(manifest.id as (typeof EMBEDDED_TEAM_IDS)[number])) {
    issues.push({
      level: "warning",
      message: `Team '${manifest.id}' has no human-facing TEAM.md/README documentation path.`,
    });
  }

  return issues;
}

export function validateTeamLibrary(teamLibrary: TeamLibrary): TeamValidationIssue[] {
  return teamLibrary.teams.flatMap(validateTeamDefinition);
}
