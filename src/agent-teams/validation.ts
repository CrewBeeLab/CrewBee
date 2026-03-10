import type { AgentTeamDefinition, TeamLibrary } from "../core";
import { getToolset } from "../runtime";

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

  if (manifest.ownershipRouting && !agentIds.has(manifest.ownershipRouting.defaultActiveOwner)) {
    issues.push({
      level: "error",
      message: `Ownership default active owner '${manifest.ownershipRouting.defaultActiveOwner}' is not defined in this Team.`,
    });
  }

  for (const agentRef of manifest.roleBoundaries?.writeExecutionRoles ?? []) {
    if (!agentIds.has(agentRef)) {
      issues.push({
        level: "error",
        message: `Write execution role '${agentRef}' is not defined in this Team.`,
      });
    }
  }

  for (const agentRef of manifest.roleBoundaries?.readOnlySupportRoles ?? []) {
    if (!agentIds.has(agentRef)) {
      issues.push({
        level: "error",
        message: `Read-only support role '${agentRef}' is not defined in this Team.`,
      });
    }
  }

  const writeExecutionRoles = new Set(manifest.roleBoundaries?.writeExecutionRoles ?? []);
  const readOnlySupportRoles = new Set(manifest.roleBoundaries?.readOnlySupportRoles ?? []);

  for (const agentRef of writeExecutionRoles) {
    if (readOnlySupportRoles.has(agentRef)) {
      issues.push({
        level: "error",
        message: `Agent '${agentRef}' cannot be both a write execution role and a read-only support role.`,
      });
    }
  }

  if (
    manifest.ownershipRouting?.defaultActiveOwner &&
    readOnlySupportRoles.has(manifest.ownershipRouting.defaultActiveOwner)
  ) {
    issues.push({
      level: "error",
      message: `Default active owner '${manifest.ownershipRouting.defaultActiveOwner}' cannot be declared as read-only support.`,
    });
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
    try {
      getToolset(agent.capabilities.toolset);
    } catch (error) {
      issues.push({
        level: "error",
        message: `Agent '${agent.metadata.id}' references unknown toolset '${agent.capabilities.toolset}'. ${String(error)}`,
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
