import type { PluginInput } from "@opencode-ai/plugin";

import { buildCompactionContext, captureTodoSnapshot } from "./delegation/continuity";
import type { DelegateStateStore } from "./delegation/store";

export function createCompactionHook(ctx: PluginInput, store: DelegateStateStore) {
  return async (input: { sessionID: string }, output: { context: string[]; prompt?: string }) => {
    const checkpoint = store.getCheckpoint(input.sessionID);
    if (checkpoint) {
      store.setCheckpoint(input.sessionID, checkpoint);
    }
    await captureTodoSnapshot(ctx, store, input.sessionID);
    output.context.push(buildCompactionContext(store, input.sessionID));
  };
}
