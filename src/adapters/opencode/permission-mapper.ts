import type { AgentPermissionRule } from "../../core";

import type { CatalogAgentProjection } from "../../runtime";
import { isAvailableTool, type AvailableToolContext } from "../../runtime/registries";

export type OpenCodePermissionAction = "allow" | "deny" | "ask";

export interface OpenCodePermissionRule {
  permission: string;
  action: OpenCodePermissionAction;
  pattern: string;
}

function mapPermissionRulesWithAvailability(
  permissionRules: AgentPermissionRule[],
  availableTools?: AvailableToolContext,
): OpenCodePermissionRule[] {
  return permissionRules.map((rule) => ({
    permission: rule.permission,
    action: rule.action,
    pattern: rule.pattern,
  })).filter((rule) => isAvailableTool(rule.permission, availableTools));
}

export function createOpenCodePermissionRules(
  agent: CatalogAgentProjection,
  availableTools?: AvailableToolContext,
): OpenCodePermissionRule[] {
  return mapPermissionRulesWithAvailability(agent.sourceAgent.capabilities.permission, availableTools);
}
