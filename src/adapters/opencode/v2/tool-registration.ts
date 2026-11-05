import type { SessionRuntimeBinding } from "../../../runtime";
import { createDelegateTools } from "../delegation/tools";
import type { DelegateStateStore } from "../delegation/store";
import type { DelegateTaskArgs } from "../delegation/types";
import type { OpenCodeAgentAliasEntry, OpenCodeAgentConfig } from "../projection";
import { normalizeDelegateTaskOutput } from "../tool-hooks";
import { createFailedResult, stringifyDelegateTaskResult } from "../delegation/tool-result";

import { logCrewBeeV2 } from "./logging";
import type { CrewBeeV2SessionClient } from "./session-client";

/** V2's native delegation tool is named `subagent`; CrewBee keeps `task` as a compatibility alias. */
export const SUBAGENT_TOOL_NAME = "subagent";
export const TASK_TOOL_ALIAS = "task";
export const DELEGATE_STATUS_TOOL_NAME = "delegate_status";
export const DELEGATE_CANCEL_TOOL_NAME = "delegate_cancel";

export interface V2ToolContext {
  readonly sessionID: string;
  readonly messageID: string;
  readonly agent: string;
  readonly id: string;
  readonly signal: AbortSignal;
  readonly progress: (update: Record<string, unknown>) => Promise<void>;
}

export interface V2ToolResult {
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface V2ToolDefinition {
  name: string;
  description: string;
  input: unknown;
  options?: {
    codemode?: boolean;
    namespace?: string;
    permission?: string;
  };
  execute(input: Record<string, unknown>, context: V2ToolContext): Promise<V2ToolResult>;
}

export interface V2ToolEditor {
  list(): readonly { id: string }[];
  get(id: string): { id: string } | undefined;
  add(tool: V2ToolDefinition): void;
  update(id: string, update: (tool: { id: string; description: string }) => void): void;
  remove(id: string): void;
}

const SUBAGENT_INPUT_SCHEMA = {
  type: "object",
  properties: {
    description: {
      type: "string",
      description: "A short (3-5 words) description of the task",
    },
    prompt: {
      type: "string",
      description: "The task for the CrewBee agent to perform",
    },
    agent: {
      type: "string",
      description: "CrewBee agent id or alias listed in the current Agent Profile collaboration section",
    },
    subagent_type: {
      type: "string",
      description: "Alias of `agent`, kept for CrewBee and OpenCode V1 compatibility",
    },
    task_id: {
      type: "string",
      description: "Existing delegated session to continue",
    },
    session_id: {
      type: "string",
      description: "Alias of `task_id`",
    },
    run_in_background: {
      type: "boolean",
      description: "Launch the delegated task in background mode",
    },
    background: {
      type: "boolean",
      description: "Alias of `run_in_background`",
    },
    mode: {
      type: "string",
      enum: ["foreground", "background"],
      description: "Delegation mode; defaults to foreground",
    },
  },
  required: ["prompt"],
  anyOf: [{ required: ["agent"] }, { required: ["subagent_type"] }],
  additionalProperties: false,
} as const;

const TASK_REF_INPUT_SCHEMA = {
  type: "object",
  properties: {
    task_ref: {
      type: "string",
      description: "CrewBee background task reference",
    },
  },
  required: ["task_ref"],
  additionalProperties: false,
} as const;

function readString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function normalizeTaskArgs(input: Record<string, unknown>): DelegateTaskArgs {
  const subagentType = readString(input, "agent") ?? readString(input, "subagent_type");
  const taskId = readString(input, "task_id") ?? readString(input, "session_id");
  const runInBackground = input.run_in_background === true
    || input.background === true
    || input.mode === "background";

  const args: DelegateTaskArgs = {
    prompt: typeof input.prompt === "string" ? input.prompt : "",
  };

  if (typeof input.description === "string") {
    args.description = input.description;
  }

  if (subagentType) {
    args.subagent_type = subagentType;
  }

  if (taskId) {
    args.task_id = taskId;
  }

  if (runInBackground) {
    args.run_in_background = true;
  }

  if (input.mode === "background" || input.mode === "foreground") {
    args.mode = input.mode;
  }

  return args;
}

function createToolContext(input: {
  context: V2ToolContext;
  directory: string;
  metadata: Record<string, unknown>;
}) {
  return {
    sessionID: input.context.sessionID,
    messageID: input.context.messageID,
    agent: input.context.agent,
    directory: input.directory,
    worktree: input.directory,
    abort: input.context.signal,
    metadata(update: { title?: string; metadata?: Record<string, unknown> }) {
      if (update.metadata) {
        Object.assign(input.metadata, update.metadata);
      }
    },
  };
}

export interface CreateV2DelegateToolsInput {
  client: CrewBeeV2SessionClient;
  store: DelegateStateStore;
  getProjectedAgents(): OpenCodeAgentConfig[];
  getAliasIndex(): Map<string, OpenCodeAgentAliasEntry>;
  bindings: Map<string, SessionRuntimeBinding>;
  directory: string;
  /** Lets the session facade observe the tool abort signal for the lifetime of one call. */
  onExecuteStart?(context: V2ToolContext): void;
}

type DelegateToolBundle = ReturnType<typeof createDelegateTools>;

export function createV2DelegateToolDefinitions(input: CreateV2DelegateToolsInput): V2ToolDefinition[] {
  const tools: DelegateToolBundle = createDelegateTools({
    client: input.client,
    store: input.store,
    getProjectedAgents: input.getProjectedAgents,
    getAliasIndex: input.getAliasIndex,
    bindings: input.bindings,
  });

  const taskTool: V2ToolDefinition = {
    name: SUBAGENT_TOOL_NAME,
    description: [
      "Delegate work to a CrewBee team member. This overrides OpenCode's native subagent tool with CrewBee's",
      "delegation engine; use `agent` (or `subagent_type`) to select an allowed Team member.",
    ].join(" "),
    input: SUBAGENT_INPUT_SCHEMA,
    options: { codemode: false, permission: "subagent" },
    async execute(rawInput, context) {
      input.onExecuteStart?.(context);
      const metadata: Record<string, unknown> = {};
      try {
        const args = normalizeTaskArgs(rawInput) as Parameters<typeof tools.task.execute>[0];
        const output = await tools.task.execute(args, createToolContext({
          context,
          directory: input.directory,
          metadata,
        }));
        const normalized = normalizeDelegateTaskOutput(output);
        return {
          content: normalized?.output ?? output,
          metadata: { ...metadata, ...(normalized?.metadata ?? {}) },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logCrewBeeV2("Delegated task failed", { sessionID: context.sessionID, error: message }, "error");
        return {
          content: stringifyDelegateTaskResult(createFailedResult(context.sessionID, "delegate_error", message)),
          metadata,
        };
      }
    },
  };

  // Compatibility alias for prompts written against CrewBee's V1 `task` tool.
  const taskAliasTool: V2ToolDefinition = {
    ...taskTool,
    name: TASK_TOOL_ALIAS,
    description: taskTool.description,
  };

  const delegateStatusTool: V2ToolDefinition = {
    name: DELEGATE_STATUS_TOOL_NAME,
    description: "Get the status of a CrewBee background delegation.",
    input: TASK_REF_INPUT_SCHEMA,
    options: { codemode: false, permission: DELEGATE_STATUS_TOOL_NAME },
    async execute(rawInput, context) {
      const taskRef = readString(rawInput, "task_ref") ?? "";
      return {
        content: await tools.delegate_status.execute(
          { task_ref: taskRef },
          createToolContext({ context, directory: input.directory, metadata: {} }),
        ),
      };
    },
  };

  const delegateCancelTool: V2ToolDefinition = {
    name: DELEGATE_CANCEL_TOOL_NAME,
    description: "Cancel a CrewBee background delegation.",
    input: TASK_REF_INPUT_SCHEMA,
    options: { codemode: false, permission: DELEGATE_CANCEL_TOOL_NAME },
    async execute(rawInput, context) {
      const taskRef = readString(rawInput, "task_ref") ?? "";
      return {
        content: await tools.delegate_cancel.execute(
          { task_ref: taskRef },
          createToolContext({ context, directory: input.directory, metadata: {} }),
        ),
      };
    },
  };

  return [taskTool, taskAliasTool, delegateStatusTool, delegateCancelTool];
}

export function registerV2DelegateTools(editor: V2ToolEditor, tools: readonly V2ToolDefinition[]): void {
  for (const tool of tools) {
    // `add` is required here: V2's `update` ignores unknown ids.
    editor.add(tool as never);
  }
}
