import type { AgentTeamDefinition, CollaborationBindingInput, TeamLibrary } from "../core";

import { EMBEDDED_TEAM_IDS } from "./constants";
import type { TeamValidationIssue } from "./types";

function getBindingAgentRef(binding: CollaborationBindingInput): string {
  return typeof binding === "string" ? binding : binding.agentRef;
}

export function validateTeamDefinition(team: AgentTeamDefinition): TeamValidationIssue[] {
  const issues: TeamValidationIssue[] = [];
  const agentIds = new Set(team.agents.map((agent) => agent.metadata.id));
  const { manifest } = team;
  const leaderAgent = team.agents.find((agent) => agent.metadata.id === manifest.leader.agentRef);

  if (!agentIds.has(manifest.leader.agentRef)) {
    issues.push({
      level: "error",
      message: `Leader agent '${manifest.leader.agentRef}' is not defined in this Team.`,
    });
  } else if (leaderAgent?.entryPoint?.exposure !== "user-selectable") {
    issues.push({
      level: "error",
      message: `Leader agent '${manifest.leader.agentRef}' must be user-selectable.`,
    });
  }

  for (const agentRef of Object.keys(manifest.members)) {
    if (!agentIds.has(agentRef)) {
      issues.push({
        level: "error",
        message: `Member agent '${agentRef}' is not defined in this Team.`,
      });
    }
  }

  if (!team.policy) {
    issues.push({
      level: "error",
      message: `Team '${manifest.id}' must define team.policy.yaml.`,
    });
    return issues;
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
    const collaborationTargets = [
      ...agent.collaboration.defaultConsults,
      ...agent.collaboration.defaultHandoffs,
    ].map(getBindingAgentRef);

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

    for (const targetAgentRef of collaborationTargets) {
      if (!agentIds.has(targetAgentRef)) {
        issues.push({
          level: "error",
          message: `Agent '${agent.metadata.id}' references unknown collaboration target '${targetAgentRef}'.`,
        });
        continue;
      }

      if (targetAgentRef !== manifest.leader.agentRef && !manifest.members[targetAgentRef]) {
        issues.push({
          level: "error",
          message: `Agent '${agent.metadata.id}' references collaboration target '${targetAgentRef}' without manifest member guidance.`,
        });
      }
    }
  }

  if (manifest.governance.instructionPrecedence.length === 0) {
    issues.push({
      level: "error",
      message: `Team '${manifest.id}' must define governance.instructionPrecedence.`,
    });
  }

  if (!team.policy.instructionPrecedence) {
    issues.push({
      level: "error",
      message: `Team '${manifest.id}' must define policy.instruction_precedence.`,
    });
  }

  if (!team.policy.workingRules) {
    issues.push({
      level: "error",
      message: `Team '${manifest.id}' must define policy.working_rules.`,
    });
  }

  if (!team.policy.qualityFloor) {
    issues.push({
      level: "error",
      message: `Team '${manifest.id}' must define policy.quality_floor.`,
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
      message: `Team '${manifest.id}' has no human-facing TEAM.md or README.md at the team root.`,
    });
  }

  return issues;
}

export function validateTeamLibrary(teamLibrary: TeamLibrary): TeamValidationIssue[] {
  return [...(teamLibrary.loadIssues ?? []), ...teamLibrary.teams.flatMap(validateTeamDefinition)];
}
