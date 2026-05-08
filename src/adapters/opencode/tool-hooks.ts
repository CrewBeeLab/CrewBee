import type { OpenCodeAgentAliasEntry } from "./projection";
import {
  resolveProjectedAgentAlias,
  type OpenCodeAgentConfig,
} from "./projection";
import { parseDelegateTaskResult, stringifyDelegateTaskResult } from "./delegation/tool-result";
import type { DelegateTaskResult } from "./delegation/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeNativeTaskParameters(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeNativeTaskParameters(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  const next = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, sanitizeNativeTaskParameters(entry)]),
  );
  const properties = next.properties;

  if (isRecord(properties) && isRecord(properties.subagent_type)) {
    properties.subagent_type = {
      type: "string",
      description: "Disabled for CrewBee Agent Team sessions. Use delegate_task with an agent listed in the current Agent Profile collaboration section.",
    };
  }

  return next;
}

function buildRetryGuidance(result: DelegateTaskResult): string | undefined {
  if (!result.error_code) {
    return undefined;
  }

  const fixes: Record<string, string> = {
    missing_agent: 'Fix: include `agent="reviewer"` or another CrewBee member id.',
    unknown_agent: 'Fix: use a valid CrewBee member id or projected alias.',
    invalid_session_id: 'Fix: use a delegated `session_id` previously returned by `delegate_task`.',
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
    "[delegate_task CALL FAILED - RETRY REQUIRED]",
    `Error: ${result.error_code}`,
    fix,
    'Example: delegate_task(agent="reviewer", prompt="continue review")',
  ].join("\n");
}

function withResumeHint(result: DelegateTaskResult): DelegateTaskResult {
  if (result.status === "failed" || !result.session_id || result.resume_hint) {
    return result;
  }

  const hint = `to continue: delegate_task(session_id="${result.session_id}", agent="${result.session_id ? "..." : "reviewer"}", prompt="...")`;
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
  return async (input: { toolID: string }, output: { description: string; parameters: unknown }) => {
    if (input.toolID !== "task") {
      return;
    }

    output.description = [
      "CrewBee Agent Team boundary: this native task tool is disabled for CrewBee Team agents. Use delegate_task, and only target agents listed in the current Agent Profile collaboration section.",
    ].join("\n");
    output.parameters = sanitizeNativeTaskParameters(output.parameters);
  };
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
    if (input.tool !== "delegate_task") {
      return;
    }

    const parsed = parseDelegateTaskResult(output.output);
    if (!parsed) {
      return;
    }

    output.output = stringifyDelegateTaskResult(withResumeHint(withRetryGuidance(withEmptyWarning(parsed))));
  };
}
