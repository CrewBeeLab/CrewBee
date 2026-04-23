import z from "zod";

import type { SessionRuntimeBinding } from "../../../runtime";
import type { OpenCodeAgentAliasEntry, OpenCodeAgentConfig } from "../projection";

import { captureTodoSnapshot } from "./continuity";
import { getSessionAnchor, extractAssistantText } from "./output";
import { createCheckpoint, createDelegatedTitle, createDelegationEnvelope, resolveDelegateModel } from "./prompt";
import { resolveDelegateAgent, isSelfDelegate } from "./resolve-agent";
import { unwrapSdkResponse } from "./sdk-response";
import { DelegateStateStore } from "./store";
import { createFailedResult, stringifyDelegateCancelResult, stringifyDelegateStatusResult, stringifyDelegateTaskResult } from "./tool-result";
import type { DelegateCancelArgs, DelegateStatusArgs, DelegateTaskArgs, DelegateTaskRecord, DelegateTaskResult } from "./types";

interface CrewBeeToolContext {
  sessionID: string;
  messageID: string;
  agent: string;
  directory: string;
  worktree: string;
  abort: AbortSignal;
  metadata(input: { title?: string; metadata?: Record<string, unknown> }): void;
}

interface CrewBeeToolDefinition<Args extends z.ZodRawShape> {
  description: string;
  args: Args;
  execute(args: z.infer<z.ZodObject<Args>>, context: CrewBeeToolContext): Promise<string>;
}

function createToolDefinition<Args extends z.ZodRawShape>(input: CrewBeeToolDefinition<Args>): CrewBeeToolDefinition<Args> {
  return input;
}

interface ClientLike {
  session: {
    abort(input: { path: { id: string } }): Promise<unknown>;
    create(input: { body: { parentID: string; title: string } }): Promise<unknown>;
    get(input: { path: { id: string } }): Promise<unknown>;
    messages(input: { path: { id: string } }): Promise<unknown>;
    prompt(input: { path: { id: string }; body: { agent?: string; model?: { providerID: string; modelID: string }; noReply?: boolean; parts: Array<{ type: "text"; text: string }> } }): Promise<unknown>;
    promptAsync?(input: { path: { id: string }; body: { agent?: string; model?: { providerID: string; modelID: string }; noReply?: boolean; parts: Array<{ type: "text"; text: string }> } }): Promise<unknown>;
    todo(input: { path: { id: string } }): Promise<unknown>;
  };
}

interface CreateDelegateToolsInput {
  client: ClientLike;
  store: DelegateStateStore;
  getProjectedAgents(): OpenCodeAgentConfig[];
  getAliasIndex(): Map<string, OpenCodeAgentAliasEntry>;
  bindings: Map<string, SessionRuntimeBinding>;
}

function createDescription(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 57)}...`;
}

async function resolveChildSession(input: {
  args: DelegateTaskArgs;
  client: ClientLike;
  parentSessionID: string;
  title: string;
  store: DelegateStateStore;
  canonicalAgentId: string;
  configKey: string;
}): Promise<{ sessionID: string; existing: boolean } | DelegateTaskResult> {
  if (!input.args.session_id) {
    const created = unwrapSdkResponse(await input.client.session.create({
      body: { parentID: input.parentSessionID, title: input.title },
    }));
    const sessionID = (created as { id: string }).id;
    input.store.putSession({
      sessionID,
      parentSessionID: input.parentSessionID,
      canonicalAgentId: input.canonicalAgentId,
      configKey: input.configKey,
    });
    return { sessionID, existing: false };
  }

  const known = input.store.getSession(input.args.session_id);
  if (!known) {
    return createFailedResult(input.args.session_id, "invalid_session_id", "Use an existing delegated session_id returned by delegate_task.");
  }

  if (known.parentSessionID !== input.parentSessionID) {
    return createFailedResult(input.args.session_id, "invalid_session_id", "Use a delegated session_id created from the current parent session.");
  }

  if (known.canonicalAgentId !== input.canonicalAgentId) {
    return createFailedResult(input.args.session_id, "agent_session_mismatch", "The delegated session is already bound to a different agent.");
  }

  await input.client.session.get({ path: { id: input.args.session_id } }).catch(() => {
    throw createFailedResult(input.args.session_id!, "invalid_session_id", "Use an existing delegated session_id returned by delegate_task.");
  });
  return { sessionID: input.args.session_id, existing: true };
}

async function runForeground(input: {
  args: DelegateTaskArgs;
  client: ClientLike;
  ctx: CrewBeeToolContext;
  store: DelegateStateStore;
  target: OpenCodeAgentConfig;
  sessionID: string;
  parentSessionID: string;
  title: string;
}): Promise<DelegateTaskResult> {
  const anchor = await getSessionAnchor(input.client, input.sessionID);
  const model = resolveDelegateModel(input.target, input.store.getCheckpoint(input.ctx.sessionID)?.model);
  const envelope = createDelegationEnvelope({
    agent: input.target.canonicalAgentId,
    parentSessionID: input.parentSessionID,
    sessionID: input.sessionID,
    prompt: input.args.prompt,
  });
  input.store.setCheckpoint(input.sessionID, createCheckpoint(input.target, model));
  await input.client.session.prompt({
    path: { id: input.sessionID },
    body: {
      agent: input.target.configKey,
      model,
      parts: [{ type: "text", text: envelope }],
    },
  });
  const message = await extractAssistantText(input.client, input.sessionID, anchor);
  const result: DelegateTaskResult = {
    status: "completed",
    session_id: input.sessionID,
    message,
    resume_supported: true,
  };
  input.ctx.metadata({ title: input.title, metadata: { sessionId: input.sessionID, agent: input.target.canonicalAgentId } });
  return result;
}

function createBackgroundRecord(input: {
  ctx: CrewBeeToolContext;
  store: DelegateStateStore;
  target: OpenCodeAgentConfig;
  sessionID: string;
  description: string;
  anchor: number;
}): DelegateTaskRecord {
  return {
    taskRef: input.store.createTaskRef(),
    sessionID: input.sessionID,
    parentSessionID: input.ctx.sessionID,
    parentMessageID: input.ctx.messageID,
    canonicalAgentId: input.target.canonicalAgentId,
    configKey: input.target.configKey,
    description: input.description,
    status: "queued",
    startedAt: Date.now(),
    lastUpdateAt: Date.now(),
    anchor: input.anchor,
  };
}

function launchBackground(input: {
  args: DelegateTaskArgs;
  client: ClientLike;
  ctx: CrewBeeToolContext;
  store: DelegateStateStore;
  target: OpenCodeAgentConfig;
  sessionID: string;
  taskRef: string;
}): void {
  const model = resolveDelegateModel(input.target, input.store.getCheckpoint(input.ctx.sessionID)?.model);
  const envelope = createDelegationEnvelope({
    agent: input.target.canonicalAgentId,
    parentSessionID: input.ctx.sessionID,
    sessionID: input.sessionID,
    prompt: input.args.prompt,
  });
  input.store.setCheckpoint(input.sessionID, createCheckpoint(input.target, model));
  const launcher = input.client.session.promptAsync?.bind(input.client.session) ?? input.client.session.prompt.bind(input.client.session);
  void launcher({
    path: { id: input.sessionID },
    body: {
      agent: input.target.configKey,
      model,
      parts: [{ type: "text", text: envelope }],
    },
  }).catch((error) => {
    input.store.setTaskStatus(input.taskRef, "failed", { lastError: String(error), message: String(error) });
  });
}

export function createDelegateTools(input: CreateDelegateToolsInput) {
  const delegate_task = createToolDefinition({
    description: "Delegate work to a CrewBee team member.",
    args: {
      agent: z.string().optional().describe("CrewBee agent id or alias"),
      prompt: z.string().describe("Delegated objective"),
      session_id: z.string().optional().describe("Existing delegated session to continue"),
      mode: z.enum(["foreground", "background"]).optional().describe("Execution mode, defaults to foreground"),
    },
    async execute(args: DelegateTaskArgs, ctx: CrewBeeToolContext) {
      if (!args.agent) {
        return stringifyDelegateTaskResult(createFailedResult(ctx.sessionID, "missing_agent", "Provide the CrewBee agent field when delegating work."));
      }

      if (input.store.getSession(ctx.sessionID)) {
        return stringifyDelegateTaskResult(
          createFailedResult(ctx.sessionID, "nested_delegate_forbidden", "Nested CrewBee delegation is disabled for delegated subagent sessions."),
        );
      }

      const mode = args.mode ?? "foreground";
      if (mode !== "foreground" && mode !== "background") {
        return stringifyDelegateTaskResult(createFailedResult(ctx.sessionID, "unsupported_mode", "Use mode=foreground or mode=background."));
      }

      const target = resolveDelegateAgent({
        agents: input.getProjectedAgents(),
        aliasIndex: input.getAliasIndex(),
        agent: args.agent,
      });
      if (!target) {
        return stringifyDelegateTaskResult(createFailedResult(ctx.sessionID, "unknown_agent", `Unknown CrewBee agent: ${args.agent}`));
      }

      const binding = input.bindings.get(ctx.sessionID);
      if (isSelfDelegate(binding, target.canonicalAgentId)) {
        return stringifyDelegateTaskResult(createFailedResult(ctx.sessionID, "self_delegate_forbidden", "Do not delegate a CrewBee session back to the same active agent."));
      }

      const title = createDelegatedTitle(target.canonicalAgentId, args.prompt);
      const child = await resolveChildSession({
        args,
        client: input.client,
        parentSessionID: ctx.sessionID,
        title,
        store: input.store,
        canonicalAgentId: target.canonicalAgentId,
        configKey: target.configKey,
      }).catch((error: DelegateTaskResult) => error);
      if (typeof child === "object" && "status" in child && child.status === "failed") {
        return stringifyDelegateTaskResult(child);
      }

      if ("status" in child) {
        return stringifyDelegateTaskResult(child);
      }

      const sessionID = child.sessionID;

      if (mode === "foreground") {
        const result = await runForeground({
          args,
          client: input.client,
          ctx,
          store: input.store,
          target: target.agent,
          sessionID,
          parentSessionID: ctx.sessionID,
          title,
        });
        return stringifyDelegateTaskResult(result);
      }

      const anchor = await getSessionAnchor(input.client, sessionID);
      const record = createBackgroundRecord({
        ctx,
        store: input.store,
        target: target.agent,
        sessionID,
        description: createDescription(args.prompt),
        anchor,
      });
      input.store.putTask(record);
      launchBackground({
        args,
        client: input.client,
        ctx,
        store: input.store,
        target: target.agent,
        sessionID,
        taskRef: record.taskRef,
      });
      ctx.metadata({ title, metadata: { sessionId: sessionID, taskRef: record.taskRef, agent: target.canonicalAgentId } });
      return stringifyDelegateTaskResult({
        status: "running",
        session_id: sessionID,
        task_ref: record.taskRef,
        message: "Delegated session launched in background.",
        resume_supported: true,
      });
    },
  });

  const delegate_status = createToolDefinition({
    description: "Get the status of a CrewBee background delegation.",
    args: {
      task_ref: z.string().describe("CrewBee background task reference"),
    },
    async execute(args: DelegateStatusArgs) {
      const task = input.store.getTask(args.task_ref);
      if (!task) {
        return stringifyDelegateStatusResult({ status: "failed", task_ref: args.task_ref, message: "Unknown background task reference." });
      }

      return stringifyDelegateStatusResult({
        status: task.status,
        session_id: task.sessionID,
        task_ref: task.taskRef,
        message: task.message,
      });
    },
  });

  const delegate_cancel = createToolDefinition({
    description: "Cancel a CrewBee background delegation.",
    args: {
      task_ref: z.string().describe("CrewBee background task reference"),
    },
    async execute(args: DelegateCancelArgs) {
      const task = input.store.getTask(args.task_ref);
      if (!task) {
        return stringifyDelegateCancelResult({ ok: false, task_ref: args.task_ref, message: "Unknown background task reference." });
      }

      if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
        return stringifyDelegateCancelResult({
          ok: false,
          task_ref: task.taskRef,
          session_id: task.sessionID,
          message: `Task is already ${task.status}.`,
        });
      }

      const aborted = await input.client.session.abort({ path: { id: task.sessionID } }).then(() => true).catch(() => false);
      if (!aborted) {
        return stringifyDelegateCancelResult({
          ok: false,
          task_ref: task.taskRef,
          session_id: task.sessionID,
          message: "Failed to cancel the delegated session.",
        });
      }

      input.store.setTaskStatus(task.taskRef, "cancelled", { message: "Delegated session cancelled." });
      return stringifyDelegateCancelResult({
        ok: true,
        task_ref: task.taskRef,
        session_id: task.sessionID,
        message: "Delegated session cancelled.",
      });
    },
  });

  return { delegate_task, delegate_status, delegate_cancel };
}
