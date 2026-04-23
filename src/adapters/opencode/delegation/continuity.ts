import type { PluginInput } from "@opencode-ai/plugin";

import { unwrapSdkResponse } from "./sdk-response";
import type { DelegateStateStore } from "./store";
import type { TodoSnapshot } from "./types";

function formatDelegatedSessions(store: DelegateStateStore, sessionID: string): string {
  const sessions = store.getSessionsByParent(sessionID);
  if (sessions.length === 0) {
    return "- None";
  }

  return sessions
    .map((session) => {
      const task = store.getTaskBySession(session.sessionID);
      return [
        `- ${session.canonicalAgentId}`,
        task?.status ?? "completed",
        task?.description ?? "foreground delegation",
        `session_id=${session.sessionID}`,
        "resume, don't restart",
      ].join(" | ");
    })
    .join("\n");
}

function formatTodoSnapshot(store: DelegateStateStore, sessionID: string): string {
  const todos = store.getTodos(sessionID);
  if (todos.length === 0) {
    return "- None";
  }

  return todos
    .map((todo) => `- [${todo.status}][${todo.priority ?? "medium"}] ${todo.content}`)
    .join("\n");
}

function formatCheckpointSummary(store: DelegateStateStore, sessionID: string): string {
  const checkpoint = store.getCheckpoint(sessionID);
  if (!checkpoint) {
    return "- None";
  }

  return [
    `- agent=${checkpoint.agent}`,
    checkpoint.model ? `- model=${checkpoint.model.providerID}/${checkpoint.model.modelID}` : undefined,
    checkpoint.tools.length > 0 ? `- tools=${checkpoint.tools.join(", ")}` : "- tools=None",
  ].filter(Boolean).join("\n");
}

export async function captureTodoSnapshot(ctx: PluginInput, store: DelegateStateStore, sessionID: string): Promise<void> {
  const result = unwrapSdkResponse(await ctx.client.session.todo({ path: { id: sessionID } }).catch(() => []));
  store.setTodos(sessionID, Array.isArray(result) ? (result as TodoSnapshot[]) : []);
}

export function buildCompactionContext(store: DelegateStateStore, sessionID: string): string {
  return [
    "[CrewBee Continuity Context]",
    "",
    "When summarizing this session, preserve the sections below in the compacted summary.",
    "",
    "1. User Requests / Final Goal",
    "2. Work Completed",
    "3. Remaining Tasks",
    "4. Active Working Context",
    "5. Explicit Constraints",
    "6. Agent Verification State",
    "7. Checkpointed Agent Configuration",
    "   - include current agent / source agent / model / enabled tools when known",
    "8. Todo Snapshot",
    "   - preserve outstanding todos and their status/priority",
    "9. Delegated Agent Sessions",
    "   - include agent, status, description, session_id",
    "   - instruction: resume, don't restart",
    "",
    "[Checkpointed agent configuration]",
    formatCheckpointSummary(store, sessionID),
    "",
    "[Todo snapshot]",
    formatTodoSnapshot(store, sessionID),
    "",
    "[Runtime-carried delegated sessions]",
    formatDelegatedSessions(store, sessionID),
  ].join("\n");
}
