import type { PluginInput } from "@opencode-ai/plugin";

import { extractAssistantText } from "./delegation/output";
import type { DelegateStateStore } from "./delegation/store";

type PluginEvent = { type: string; properties?: unknown };

function resolveSessionID(event: PluginEvent): string | undefined {
  const props = event.properties as { sessionID?: string; info?: { id?: string } } | undefined;
  return props?.sessionID ?? props?.info?.id;
}

async function finalizeBackgroundTask(ctx: PluginInput, store: DelegateStateStore, sessionID: string): Promise<void> {
  const task = store.getTaskBySession(sessionID);
  if (!task || task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
    return;
  }

  const message = await extractAssistantText(ctx.client, task.sessionID, task.anchor).catch((error) => {
    store.setTaskStatus(task.taskRef, "failed", { message: "Failed to read delegated session output.", lastError: String(error) });
    return undefined;
  });
  if (message === undefined) {
    return;
  }

  store.setTaskStatus(task.taskRef, "completed", {
    message: message || "Delegated session completed with no text output.",
  });
}

export function createEventHook(ctx: PluginInput, store: DelegateStateStore) {
  return async (input: { event: PluginEvent }) => {
    const sessionID = resolveSessionID(input.event);
    if (!sessionID) {
      return;
    }

    if (input.event.type === "session.status") {
      const status = (input.event.properties as { status?: { type?: string } }).status;
      const task = store.getTaskBySession(sessionID);
      if (task && status?.type === "busy") {
        store.setTaskStatus(task.taskRef, "running");
      }
      if (status?.type === "idle") {
        await finalizeBackgroundTask(ctx, store, sessionID);
      }
      return;
    }

    if (input.event.type === "session.idle") {
      await finalizeBackgroundTask(ctx, store, sessionID);
      return;
    }

    if (input.event.type === "session.error") {
      const task = store.getTaskBySession(sessionID);
      if (task) {
        store.setTaskStatus(task.taskRef, "failed", { message: "Delegated session failed.", lastError: "session.error" });
      }
      return;
    }

    if (input.event.type === "session.compacted") {
      store.markCompacted(sessionID);
      return;
    }

    if (input.event.type === "session.deleted") {
      const task = store.getTaskBySession(sessionID);
      if (task && task.status !== "completed" && task.status !== "failed") {
        store.setTaskStatus(task.taskRef, "cancelled", { message: "Delegated session deleted." });
      }
      store.clearSession(sessionID);
    }
  };
}
