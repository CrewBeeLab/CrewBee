import type { PluginInput } from "@opencode-ai/plugin";

import { unwrapSdkResponse } from "./sdk-response";
import { hasNoTextTail } from "./output";
import type { DelegateStateStore } from "./store";
import type { DelegateCheckpoint, TodoSnapshot } from "./types";

function formatDelegatedSessions(store: DelegateStateStore, sessionID: string): string {
  const tasks = store.getTasksByParent(sessionID);
  if (tasks.length === 0) {
    return "- None";
  }

  return tasks
    .map((task) => `- ${task.sourceAgentId} | ${task.status} | ${task.description} | session_id=${task.sessionID} | resume, don't restart`)
    .join("\n");
}

function formatTodoRestorePrompt(todos: TodoSnapshot[]): string {
  const lines = todos.map((t) => `- [${t.status}][${t.priority ?? "medium"}] ${t.content}`).join("\n");
  return [
    "[CrewBee internal] Session compaction cleared your todo list.",
    "Please restore it immediately using the TodoWrite tool. Todos to restore:",
    "",
    lines,
    "",
    "Restore all todos now. Do not reply with text — only call TodoWrite.",
  ].join("\n");
}

export async function captureTodoSnapshot(ctx: PluginInput, store: DelegateStateStore, sessionID: string): Promise<void> {
  const result = unwrapSdkResponse(await ctx.client.session.todo({ path: { id: sessionID } }).catch(() => []));
  store.setTodos(sessionID, Array.isArray(result) ? (result as TodoSnapshot[]) : []);
}

export function buildCompactionContext(store: DelegateStateStore, sessionID: string): string {
  return [
    "[CrewBee Continuity Context]",
    "",
    "1. User Requests / Final Goal",
    "2. Work Completed",
    "3. Remaining Tasks",
    "4. Active Working Context",
    "5. Explicit Constraints",
    "6. Agent Verification State",
    "7. Delegated Agent Sessions",
    "   - include agent, status, description, session_id",
    "   - instruction: resume, don't restart",
    "",
    "[Runtime-carried delegated sessions]",
    formatDelegatedSessions(store, sessionID),
  ].join("\n");
}

export async function recoverPromptCheckpoint(ctx: PluginInput, sessionID: string, checkpoint?: DelegateCheckpoint): Promise<void> {
  if (!checkpoint) {
    return;
  }

  await ctx.client.session.prompt({
    path: { id: sessionID },
    body: {
      agent: checkpoint.agent,
      model: checkpoint.model,
      noReply: true,
      tools: Object.fromEntries(checkpoint.tools.map((tool) => [tool, true])),
      parts: [{ type: "text", text: "[CrewBee internal prompt checkpoint refresh]" }],
    },
  }).catch(() => undefined);
}

export async function restoreTodoSnapshot(ctx: PluginInput, store: DelegateStateStore, sessionID: string, checkpoint?: DelegateCheckpoint): Promise<void> {
  const snapshot = store.getTodos(sessionID);
  if (snapshot.length === 0) {
    return;
  }

  const current = unwrapSdkResponse(await ctx.client.session.todo({ path: { id: sessionID } }).catch(() => []));
  if (Array.isArray(current) && current.length > 0) {
    return;
  }

  // The SDK has no todo write endpoint — todos are owned by the host and written
  // by the model's TodoWrite tool. Inject a noReply prompt so the model restores
  // its own todo list using the tool it already has.
  await ctx.client.session.prompt({
    path: { id: sessionID },
    body: {
      agent: checkpoint?.agent,
      model: checkpoint?.model,
      noReply: false,
      tools: checkpoint ? Object.fromEntries(checkpoint.tools.map((tool) => [tool, true])) : {},
      parts: [{ type: "text", text: formatTodoRestorePrompt(snapshot) }],
    },
  }).catch(() => undefined);
}

export async function recoverNoTextTail(ctx: PluginInput, store: DelegateStateStore, sessionID: string): Promise<void> {
  const continuity = store.getContinuity(sessionID);
  if (!continuity.compactedAt) {
    return;
  }

  const noText = await hasNoTextTail(ctx.client, sessionID, continuity.compactedAt).catch(() => false);
  if (!noText) {
    store.setNoTextTailCount(sessionID, 0);
    return;
  }

  const count = (continuity.noTextTailCount ?? 0) + 1;
  store.setNoTextTailCount(sessionID, count);
  if (count >= 2) {
    await recoverPromptCheckpoint(ctx, sessionID, continuity.checkpoint);
  }
}
