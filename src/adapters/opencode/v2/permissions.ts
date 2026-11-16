import type { AgentPermissionRule } from "../../../core";

export type V2PermissionEffect = "allow" | "deny" | "ask";

export interface V2PermissionRule {
  action: string;
  resource: string;
  effect: V2PermissionEffect;
}

/**
 * V1 permission names that are either renamed or no longer exist in V2.
 *
 * Verified against OpenCode 2.1.3: `edit`, `write` and `patch` all assert the `edit` action, the
 * shell tool asserts `shell`, and the native subagent tool asserts `subagent`. V2 has no LSP and no
 * TodoWrite tool, so their rules are dropped.
 */
const PERMISSION_ACTION_MAP: Record<string, string | undefined> = {
  bash: "shell",
  write: "edit",
  patch: "edit",
  multiedit: "edit",
  task: "subagent",
  delegate_task: "subagent",
  lsp_diagnostics: undefined,
  look_at: undefined,
};

const DROPPED_ACTIONS = new Set(["lsp_diagnostics", "look_at"]);

/**
 * V2 evaluates permission rules in order and the last matching rule wins. V1 defaulted to allow
 * for tools without an explicit rule, so a catch-all allow rule is prepended to preserve that.
 */
const DEFAULT_ALLOW_RULE: V2PermissionRule = { action: "*", resource: "*", effect: "allow" };

export function mapPermissionAction(permission: string): string | undefined {
  if (DROPPED_ACTIONS.has(permission)) {
    return undefined;
  }

  return PERMISSION_ACTION_MAP[permission] ?? permission;
}

export function toV2PermissionRules(rules: readonly AgentPermissionRule[]): V2PermissionRule[] {
  const mapped: V2PermissionRule[] = [DEFAULT_ALLOW_RULE];

  for (const rule of rules) {
    const action = mapPermissionAction(rule.permission);
    if (!action) {
      continue;
    }

    mapped.push({
      action,
      resource: rule.pattern || "*",
      effect: rule.action,
    });
  }

  return mapped;
}
