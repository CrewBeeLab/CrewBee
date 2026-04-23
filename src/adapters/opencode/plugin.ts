import type { Plugin } from "@opencode-ai/plugin";

import { ensureCrewBeeConfigFile, loadDefaultTeamLibrary } from "../../agent-teams";
import { resolveOpenCodeConfigRoot } from "../../install";
import { createSessionRuntimeBinding, type SessionRuntimeBinding } from "../../runtime";

import { createChatMessageHook } from "./chat-message-hook";
import { createCompactionHook } from "./compaction-hook";
import { createConfigHook, createInitialBootstrap, validateAndLogTeamLibrary } from "./config-hook";
import { createEventHook } from "./event-hook";
import { DelegateStateStore } from "./delegation/store";
import { createDelegateTools } from "./delegation/tools";
import { logCrewBee } from "./logging";
import { createSystemTransformHook } from "./system-transform-hook";
import { createToolDefinitionHook, createToolExecuteAfterHook, createToolExecuteBeforeHook } from "./tool-hooks";
import { startBackgroundReleaseRefresh } from "../../update/refresh";

export const OpenCodeCrewBeePlugin: Plugin = async (ctx) => {
  const crewbeeConfigUpdate = ensureCrewBeeConfigFile({
    configRoot: resolveOpenCodeConfigRoot(),
    mode: "startup",
  });
  if (crewbeeConfigUpdate.changed) {
    await logCrewBee(ctx, "CrewBee auto-repaired Team config", {
      backupPath: crewbeeConfigUpdate.backupPath,
      configPath: crewbeeConfigUpdate.configPath,
      reason: crewbeeConfigUpdate.reason,
    }, "warn");
  }

  const teamLibrary = loadDefaultTeamLibrary(ctx.worktree);
  await validateAndLogTeamLibrary(ctx, teamLibrary);

  const initial = createInitialBootstrap(teamLibrary);
  await logCrewBee(ctx, "CrewBee plugin initialized", {
    worktree: ctx.worktree,
    projectedAgentCount: initial.boot.projectedAgents.length,
    visibleAgentCount: initial.boot.projectedAgents.filter((agent) => !agent.hidden).length,
    defaultAgent: initial.boot.configPatch.defaultAgent,
  });
  startBackgroundReleaseRefresh(ctx);

  let boot = initial.boot;
  let aliasIndex = initial.aliasIndex;
  const bindings = new Map<string, SessionRuntimeBinding>();
  const store = new DelegateStateStore(ctx.worktree);

  return {
    config: createConfigHook({
      ctx,
      teamLibrary,
      getBoot: () => boot,
      setBoot: (next) => {
        boot = next;
      },
      setAliasIndex: (next) => {
        aliasIndex = next;
      },
    }),
    tool: createDelegateTools({
      client: ctx.client,
      store,
      getProjectedAgents: () => boot.projectedAgents,
      getAliasIndex: () => aliasIndex,
      bindings,
    }),
    event: createEventHook(ctx, store),
    "chat.message": createChatMessageHook({
      bindings,
      store,
      getBoot: () => boot,
    }),
    "tool.definition": createToolDefinitionHook(() => boot.projectedAgents),
    "tool.execute.before": createToolExecuteBeforeHook({
      bindings,
      getAliasIndex: () => aliasIndex,
    }),
    "tool.execute.after": createToolExecuteAfterHook(),
    "experimental.chat.system.transform": createSystemTransformHook(bindings),
    "experimental.session.compacting": createCompactionHook(ctx, store),
  };
};

export default OpenCodeCrewBeePlugin;
