import type { AgentTeamDefinition, TeamLibrary } from "../core";

import { EMBEDDED_TEAM_IDS } from "./constants";
import type { TeamValidationIssue } from "./types";

export function validateTeamDefinition(team: AgentTeamDefinition): TeamValidationIssue[] {
  const issues: TeamValidationIssue[] = [];
  const agentIds = new Set(team.agents.map((agent) => agent.metadata.id));
  const { manifest, policy } = team;

  if (manifest.defaultWorkflow.length > 0) {
    const workflowMatches =
      manifest.defaultWorkflow.length === manifest.workflow.stages.length &&
      manifest.defaultWorkflow.every((stage, index) => stage === manifest.workflow.stages[index]);

    if (!workflowMatches) {
      issues.push({
        level: "error",
        message: `Team '${manifest.id}' has inconsistent defaultWorkflow and workflow.stages definitions.`,
      });
    }
  }

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

  if (
    team.sharedCapabilities &&
    manifest.sharedRefs?.capabilityRef &&
    manifest.sharedRefs.capabilityRef !== team.sharedCapabilities.id
  ) {
    issues.push({
      level: "error",
      message: `Shared capabilities id '${team.sharedCapabilities.id}' does not match manifest ref '${manifest.sharedRefs.capabilityRef}'.`,
    });
  }

  if (manifest.sharedRefs?.policyRef && manifest.sharedRefs.policyRef !== policy.id) {
    issues.push({
      level: "error",
      message: `Policy id '${policy.id}' does not match manifest ref '${manifest.sharedRefs.policyRef}'.`,
    });
  }

  if (manifest.governance) {
    const governance = manifest.governance;
    const approvalMatches =
      governance.approvalPolicy.requiredFor.length === policy.approvalPolicy.requiredFor.length &&
      governance.approvalPolicy.requiredFor.every((entry, index) => entry === policy.approvalPolicy.requiredFor[index]) &&
      governance.approvalPolicy.allowAssumeFor.length === policy.approvalPolicy.allowAssumeFor.length &&
      governance.approvalPolicy.allowAssumeFor.every(
        (entry, index) => entry === policy.approvalPolicy.allowAssumeFor[index],
      );
    const instructionMatches =
      governance.instructionPrecedence.length === policy.instructionPrecedence.length &&
      governance.instructionPrecedence.every((entry, index) => entry === policy.instructionPrecedence[index]);
    const forbiddenMatches =
      governance.forbiddenActions.length === policy.forbiddenActions.length &&
      governance.forbiddenActions.every((entry, index) => entry === policy.forbiddenActions[index]);
    const qualityMatches =
      governance.qualityFloor.evidenceRequired === policy.qualityFloor.evidenceRequired &&
      governance.qualityFloor.requiredChecks.length === policy.qualityFloor.requiredChecks.length &&
      governance.qualityFloor.requiredChecks.every((entry, index) => entry === policy.qualityFloor.requiredChecks[index]);
    const workingRuleMatches =
      governance.workingRules.length === policy.workingRules.length &&
      governance.workingRules.every((entry, index) => entry === policy.workingRules[index]);

    if (!(approvalMatches && instructionMatches && forbiddenMatches && qualityMatches && workingRuleMatches)) {
      issues.push({
        level: "error",
        message: `Team '${manifest.id}' has governance in manifest that does not match its team policy.`,
      });
    }
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
