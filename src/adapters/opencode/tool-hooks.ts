import type { OpenCodeAgentAliasEntry } from "./projection";
import {
  createProjectedAgentTaskAliasHelpLines,
  resolveProjectedAgentAlias,
  type OpenCodeAgentConfig,
} from "./projection";
import { parseDelegateTaskResult, stringifyDelegateTaskResult } from "./delegation/tool-result";
import type { DelegateTaskResult } from "./delegation/types";

function deduplicateTaskDescription(description: string): string {
  const seen = new Set<string>();
  return description
    .split("\n")
    .filter((line) => {
      if (!line.startsWith("- ")) {
        return true;
      }

      if (seen.has(line)) {
        return false;
      }

      seen.add(line);
      return true;
    })
    .join("\n");
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

export function createToolDefinitionHook(getAgents: () => OpenCodeAgentConfig[]) {
  return async (input: { toolID: string }, output: { description: string; parameters: unknown }) => {
    if (input.toolID !== "task") {
      return;
    }

    const helpLines = createProjectedAgentTaskAliasHelpLines(getAgents());
    if (helpLines.length === 0) {
      return;
    }

    output.description = deduplicateTaskDescription(output.description);
    output.description = [
      output.description,
      "",
      "CrewBee subagent aliases:",
      ...helpLines,
      "",
      "When delegating inside CrewBee, prefer the CrewBee source-agent alias shown on each line.",
    ].join("\n");
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
