import type { AgentTeamDefinition, TeamLibrary } from "../core";

import { EMBEDDED_TEAM_IDS } from "./constants";
import type { TeamValidationIssue } from "./types";

export function validateTeamDefinition(team: AgentTeamDefinition): TeamValidationIssue[] {
  const issues: TeamValidationIssue[] = [];
  const agentIds = new Set(team.agents.map((agent) => agent.metadata.id));

  if (!agentIds.has(team.manifest.leader.agentRef)) {
    issues.push({
      level: "error",
      message: `Leader agent '${team.manifest.leader.agentRef}' is not defined in this Team.`,
    });
  }

  for (const member of team.manifest.members) {
    if (!agentIds.has(member.agentRef)) {
      issues.push({
        level: "error",
        message: `Member agent '${member.agentRef}' is not defined in this Team.`,
      });
    }
  }

  if (team.sharedCapabilities && team.manifest.sharedRefs.capabilityRef !== team.sharedCapabilities.id) {
    issues.push({
      level: "error",
      message: `Shared capabilities id '${team.sharedCapabilities.id}' does not match manifest ref '${team.manifest.sharedRefs.capabilityRef}'.`,
    });
  }

  if (team.manifest.sharedRefs.policyRef !== team.policy.id) {
    issues.push({
      level: "error",
      message: `Policy id '${team.policy.id}' does not match manifest ref '${team.manifest.sharedRefs.policyRef}'.`,
    });
  }

  if (!team.documentation?.teamReadme && !EMBEDDED_TEAM_IDS.includes(team.manifest.id as (typeof EMBEDDED_TEAM_IDS)[number])) {
    issues.push({
      level: "warning",
      message: `Team '${team.manifest.id}' has no human-facing TEAM.md/README documentation path.`,
    });
  }

  return issues;
}

export function validateTeamLibrary(teamLibrary: TeamLibrary): TeamValidationIssue[] {
  return teamLibrary.teams.flatMap(validateTeamDefinition);
}
