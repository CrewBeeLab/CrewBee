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

const ACTION_ONLY_PERMISSIONS = new Set([
  "doom_loop",
  "question",
  "todowrite",
  "webfetch",
  "websearch",
]);

const TOOL_MAP: Record<string, string | undefined> = {
  write: "edit",
  patch: "edit",
  multiedit: "edit",
  lsp_diagnostics: "lsp",
  delegate_task: "task",
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
  allowedTaskTargets: readonly string[] = [],
): OpenCodePermissionRule[] {
  const mappedRules = mapPermissionRulesWithAvailability(agent.sourceAgent.runtimeConfig.permission, availableTools);
  const rules = mappedRules.filter((rule) => rule.permission !== "task");
  const taskAllowed = mappedRules.some((rule) => rule.permission === "task" && rule.action !== "deny");

  rules.push({ permission: "task", action: "deny", pattern: "*" });
  if (taskAllowed) {
    for (const target of allowedTaskTargets) {
      rules.push({ permission: "task", action: "allow", pattern: target });
    }
  }

  return rules;
}

export function createOpenCodePermissionConfig(permissionRules: OpenCodePermissionRule[]): OpenCodePermissionConfig {
  const permission: OpenCodePermissionConfig = {};

  for (const rule of permissionRules) {
    if (ACTION_ONLY_PERMISSIONS.has(rule.permission)) {
      permission[rule.permission] = rule.action;
      continue;
    }

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
