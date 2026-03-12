import type { AgentPermissionRule } from "../../core";

import type { ProjectedAgent } from "../../runtime";
import { isAvailableTool, type AvailableToolContext } from "../../runtime/registries";

export type OpenCodePermissionAction = "allow" | "deny" | "ask";

export type OpenCodePermissionConfig = Record<string, OpenCodePermissionAction | Record<string, OpenCodePermissionAction>>;

export interface OpenCodePermissionRule {
  permission: string;
  action: OpenCodePermissionAction;
  pattern: string;
}

const TOOL_MAP: Record<string, string | undefined> = {
  write: "edit",
  patch: "edit",
  multiedit: "edit",
  lsp_diagnostics: "lsp",
  look_at: undefined,
};

export function mapOpenCodeToolName(toolId: string): string | undefined {
  return TOOL_MAP[toolId] ?? toolId;
}

export function mapOpenCodeToolNames(toolIds: readonly string[]): string[] {
  return [...new Set(toolIds.map(mapOpenCodeToolName).filter((toolId): toolId is string => Boolean(toolId)))];
}

function mapPermissionRulesWithAvailability(
  permissionRules: AgentPermissionRule[],
  availableTools?: AvailableToolContext,
): OpenCodePermissionRule[] {
  return permissionRules
    .map((rule) => {
      const permission = mapOpenCodeToolName(rule.permission);

      if (!permission) {
        return undefined;
      }

      return {
        permission,
        action: rule.action,
        pattern: rule.pattern,
      };
    })
    .filter((rule): rule is OpenCodePermissionRule => Boolean(rule))
    .filter((rule) => isAvailableTool(rule.permission, availableTools));
}

export function createOpenCodePermissionRules(
  agent: ProjectedAgent,
  availableTools?: AvailableToolContext,
): OpenCodePermissionRule[] {
  return mapPermissionRulesWithAvailability(agent.sourceAgent.capabilities.permission, availableTools);
}

export function createOpenCodePermissionConfig(permissionRules: OpenCodePermissionRule[]): OpenCodePermissionConfig {
  const permission: OpenCodePermissionConfig = {};

  for (const rule of permissionRules) {
    const current = permission[rule.permission];

    if (!current) {
      permission[rule.permission] = { [rule.pattern]: rule.action };
      continue;
    }

    if (typeof current === "string") {
      permission[rule.permission] = {
        "*": current,
        [rule.pattern]: rule.action,
      };
      continue;
    }

    current[rule.pattern] = rule.action;
  }

  return permission;
}
