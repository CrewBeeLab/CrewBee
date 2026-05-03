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
      code: "team_leader_missing",
      path: "leader.agent_ref",
      message: `Leader agent '${manifest.leader.agentRef}' is not defined in this Team.`,
      suggestion: "Add a matching *.agent.md profile or update leader.agent_ref.",
    });
  } else if (leaderAgent?.entryPoint?.exposure !== "user-selectable") {
    issues.push({
      level: "error",
      code: "team_leader_not_user_selectable",
      path: "leader.agent_ref",
      message: `Leader agent '${manifest.leader.agentRef}' must be user-selectable.`,
      suggestion: "Set entry_point.exposure to user-selectable on the leader Agent profile.",
    });
  }

  for (const agentRef of Object.keys(manifest.members)) {
    if (!agentIds.has(agentRef)) {
      issues.push({
        level: "warning",
        code: "team_member_missing",
        path: `members.${agentRef}`,
        message: `Member agent '${agentRef}' is not defined in this Team.`,
        suggestion: "Add the member Agent profile or remove this manifest member entry.",
      });
    }
  }

  if (!team.policy) {
    issues.push({
      level: "error",
      code: "team_policy_missing",
      path: "team.policy.yaml",
      message: `Team '${manifest.id}' must define team.policy.yaml.`,
      suggestion: "Create team.policy.yaml at the Team root.",
    });
    return issues;
  }

  for (const [agentId] of Object.entries(manifest.agentRuntime ?? {})) {
    if (agentId === "$default") {
      continue;
    }

    if (!agentIds.has(agentId)) {
      issues.push({
        level: "warning",
        code: "team_agent_runtime_target_missing",
        path: `agent_runtime.${agentId}`,
        message: `Agent runtime override '${agentId}' is not defined in this Team.`,
        suggestion: "Remove this runtime override or add the target Agent profile.",
      });
    }
  }

  for (const [agentId] of Object.entries(team.modelConfigOverride?.agents ?? {})) {
    if (!agentIds.has(agentId)) {
      issues.push({
        level: "warning",
        code: "team_agent_model_override_target_missing",
        path: `teams.${manifest.id}.agents.${agentId}`,
        message: `Agent model override '${agentId}' is not defined in Team '${manifest.id}'.`,
        suggestion: "Remove this model override or add the target Agent profile.",
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
        code: "agent_requested_tools_missing",
        path: `agents.${agent.metadata.id}.runtime_config.requested_tools`,
        message: `Agent '${agent.metadata.id}' must declare at least one requested tool.`,
        suggestion: "Add runtime_config.requested_tools with at least one tool name.",
      });
    }

    if (agent.runtimeConfig.permission.length === 0) {
      issues.push({
        level: "error",
        code: "agent_permission_missing",
        path: `agents.${agent.metadata.id}.runtime_config.permission`,
        message: `Agent '${agent.metadata.id}' must declare at least one permission rule.`,
        suggestion: "Add runtime_config.permission with at least one permission rule.",
      });
    }

    for (const targetAgentRef of collaborationTargets) {
      if (!agentIds.has(targetAgentRef)) {
        issues.push({
          level: "warning",
          code: "agent_collaboration_target_unknown",
          path: `agents.${agent.metadata.id}.collaboration`,
          message: `Agent '${agent.metadata.id}' references unknown collaboration target '${targetAgentRef}'.`,
          suggestion: "Add the target Agent profile or update the collaboration binding.",
        });
        continue;
      }

      if (targetAgentRef !== manifest.leader.agentRef && !manifest.members[targetAgentRef]) {
        issues.push({
          level: "error",
          code: "agent_collaboration_target_missing_member_guidance",
          path: `agents.${agent.metadata.id}.collaboration`,
          message: `Agent '${agent.metadata.id}' references collaboration target '${targetAgentRef}' without manifest member guidance.`,
          suggestion: "Add manifest member guidance for this collaboration target or remove the binding.",
        });
      }
    }
  }

  if (manifest.governance.instructionPrecedence.length === 0) {
    issues.push({
      level: "error",
      code: "team_governance_instruction_precedence_missing",
      path: "governance.instruction_precedence",
      message: `Team '${manifest.id}' must define governance.instructionPrecedence.`,
      suggestion: "Add governance.instruction_precedence with at least one rule.",
    });
  }

  if (!team.policy.instructionPrecedence) {
    issues.push({
      level: "error",
      code: "team_policy_instruction_precedence_missing",
      path: "team.policy.yaml.instruction_precedence",
      message: `Team '${manifest.id}' must define policy.instruction_precedence.`,
      suggestion: "Add instruction_precedence to team.policy.yaml.",
    });
  }

  if (!team.policy.workingRules) {
    issues.push({
      level: "error",
      code: "team_policy_working_rules_missing",
      path: "team.policy.yaml.working_rules",
      message: `Team '${manifest.id}' must define policy.working_rules.`,
      suggestion: "Add working_rules to team.policy.yaml.",
    });
  }

  if (!team.policy.qualityFloor) {
    issues.push({
      level: "error",
      code: "team_policy_quality_floor_missing",
      path: "team.policy.yaml.quality_floor",
      message: `Team '${manifest.id}' must define policy.quality_floor.`,
      suggestion: "Add quality_floor to team.policy.yaml.",
    });
  }

  if (manifest.governance.workingRules.length === 0) {
    issues.push({
      level: "error",
      code: "team_governance_working_rules_missing",
      path: "governance.working_rules",
      message: `Team '${manifest.id}' must define governance.workingRules.`,
      suggestion: "Add governance.working_rules with at least one rule.",
    });
  }

  if (manifest.governance.qualityFloor.requiredChecks.length === 0) {
    issues.push({
      level: "error",
      code: "team_governance_required_checks_missing",
      path: "governance.quality_floor.required_checks",
      message: `Team '${manifest.id}' must define governance.qualityFloor.requiredChecks.`,
      suggestion: "Add governance.quality_floor.required_checks with at least one check.",
    });
  }

  if (!team.documentation?.teamReadme && !EMBEDDED_TEAM_IDS.includes(manifest.id as (typeof EMBEDDED_TEAM_IDS)[number])) {
    issues.push({
      level: "warning",
      code: "team_documentation_missing",
      message: `Team '${manifest.id}' has no human-facing TEAM.md or README.md at the team root.`,
      suggestion: "Add TEAM.md or README.md to document this Team for humans.",
    });
  }

  return issues;
}

export function validateTeamLibrary(teamLibrary: TeamLibrary): TeamValidationIssue[] {
  return [...(teamLibrary.loadIssues ?? []), ...teamLibrary.teams.flatMap(validateTeamDefinition)];
}
