import type { OpenCodeAgentAliasEntry } from "./projection";
import {
  resolveProjectedAgentAlias,
  type OpenCodeAgentConfig,
} from "./projection";
import { parseDelegateTaskResult, stringifyDelegateTaskResult } from "./delegation/tool-result";
import type { DelegateTaskResult } from "./delegation/types";

function buildRetryGuidance(result: DelegateTaskResult): string | undefined {
  if (!result.error_code) {
    return undefined;
  }

  const fixes: Record<string, string> = {
    missing_agent: 'Fix: include `subagent_type="reviewer"` or another CrewBee member id.',
    unknown_agent: 'Fix: use a valid CrewBee member id or projected alias as `subagent_type`.',
    invalid_session_id: 'Fix: use a delegated `task_id` previously returned by `task`.',
    agent_session_mismatch: 'Fix: resume with the same agent that created the delegated session.',
    unsupported_mode: 'Fix: use `mode="foreground"` or `mode="background"`.',
    nested_delegate_forbidden: 'Fix: return the result to the parent session instead of delegating again from a delegated subagent.',
    self_delegate_forbidden: 'Fix: delegate to another CrewBee member instead of the current active agent.',
  };
  const fix = fixes[result.error_code];
  if (!fix) {
    return undefined;
  }

  return [
    "[task CALL FAILED - RETRY REQUIRED]",
    `Error: ${result.error_code}`,
    fix,
    'Example: task(subagent_type="reviewer", prompt="continue review")',
  ].join("\n");
}

function withResumeHint(result: DelegateTaskResult): DelegateTaskResult {
  if (result.status === "failed" || !result.session_id || result.resume_hint) {
    return result;
  }

  const hint = `to continue: task(task_id="${result.session_id}", subagent_type="${result.session_id ? "..." : "reviewer"}", prompt="...")`;
  return {
    ...result,
    resume_hint: hint,
    message: result.message ? `${result.message}\n\n${hint}` : hint,
  };
}

function withEmptyWarning(result: DelegateTaskResult): DelegateTaskResult {
  if (result.status !== "completed" || result.message?.trim()) {
    return result;
  }

  return {
    ...result,
    message: "Delegated session completed, but no text output was returned. Inspect the delegated session via `session_id` or `task_ref` if needed.",
  };
}

function withRetryGuidance(result: DelegateTaskResult): DelegateTaskResult {
  if (result.status !== "failed") {
    return result;
  }

  const guidance = buildRetryGuidance(result);
  if (!guidance) {
    return result;
  }

  return {
    ...result,
    message: result.message ? `${result.message}\n\n${guidance}` : guidance,
  };
}

export function createToolDefinitionHook(_getAgents: () => OpenCodeAgentConfig[]) {
  return async () => {};
}

export function createToolExecuteBeforeHook(input: {
  bindings: Map<string, { selectedAgentId: string }>;
  getAliasIndex(): Map<string, OpenCodeAgentAliasEntry>;
}) {
  return async (event: { tool: string; sessionID: string; callID: string }, output: { args: Record<string, unknown> }) => {
    if (event.tool !== "task" || !input.bindings.has(event.sessionID)) {
      return;
    }

    const subagentType = output.args.subagent_type;
    if (typeof subagentType !== "string") {
      return;
    }

    const resolved = resolveProjectedAgentAlias(input.getAliasIndex(), subagentType);
    if (resolved) {
      output.args.subagent_type = resolved.agent.configKey;
    }
  };
}

export function createToolExecuteAfterHook() {
  return async (input: { tool: string; sessionID: string; callID: string }, output: { title: string; output: string; metadata: Record<string, unknown> }) => {
    if (input.tool !== "task") {
      return;
    }

    const parsed = parseDelegateTaskResult(output.output);
    if (!parsed) {
      return;
    }

    const result = withResumeHint(withRetryGuidance(withEmptyWarning(parsed)));
    output.output = stringifyDelegateTaskResult(result);

    if (result.status !== "failed" && result.session_id) {
      output.title = output.title || "CrewBee task";
      output.metadata = {
        ...output.metadata,
        sessionId: result.session_id,
        taskId: result.task_id ?? result.session_id,
        taskRef: result.task_ref,
      };
    }
  };
}
