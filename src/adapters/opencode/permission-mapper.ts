import type { AgentTeamDefinition } from "../../core";

import type { CatalogAgentProjection } from "../../runtime";
import { getToolset, isAvailableTool } from "../../runtime/registries";

export type OpenCodePermissionAction = "allow" | "deny" | "ask";

export interface OpenCodePermissionRule {
  permission: string;
  action: OpenCodePermissionAction;
  pattern: string;
}

function deny(permission: string, pattern = "*"): OpenCodePermissionRule {
  return { permission, action: "deny", pattern };
}

function isWriteExecutionRole(team: AgentTeamDefinition, sourceAgentId: string): boolean {
  return team.manifest.roleBoundaries?.writeExecutionRoles.includes(sourceAgentId) ?? false;
}

function createWriteRules(): OpenCodePermissionRule[] {
  return [];
}

function createReadOnlySupportRules(): OpenCodePermissionRule[] {
  return [
    deny("edit"),
    deny("write"),
    deny("bash"),
  ];
}

function createCoordinationRules(): OpenCodePermissionRule[] {
  return [
    deny("write"),
    deny("edit"),
  ];
}

function mapToolsetRules(toolsetId: string): OpenCodePermissionRule[] {
  return getToolset(toolsetId).permissionRules.map((rule) => ({
    permission: rule.permission,
    action: rule.action,
    pattern: rule.pattern ?? "*",
  })).filter((rule) => isAvailableTool(rule.permission));
}

function mergePermissionRules(
  baseRules: OpenCodePermissionRule[],
  overlayRules: OpenCodePermissionRule[],
): OpenCodePermissionRule[] {
  const merged = [...baseRules];

  for (const overlay of overlayRules) {
    const existingIndex = merged.findIndex(
      (rule) => rule.permission === overlay.permission && rule.pattern === overlay.pattern,
    );

    if (existingIndex >= 0) {
      merged[existingIndex] = overlay;
      continue;
    }

    merged.push(overlay);
  }

  return merged.filter((rule) => isAvailableTool(rule.permission));
}

export function createOpenCodePermissionRules(agent: CatalogAgentProjection): OpenCodePermissionRule[] {
  const baseRules = mapToolsetRules(agent.sourceAgent.capabilities.toolset);

  if (isWriteExecutionRole(agent.sourceTeam, agent.sourceAgentId)) {
    return mergePermissionRules(baseRules, createWriteRules());
  }

  if (agent.exposure === "user-selectable") {
    return mergePermissionRules(baseRules, createCoordinationRules());
  }

  return mergePermissionRules(baseRules, createReadOnlySupportRules());
}
