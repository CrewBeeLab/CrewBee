import type { Plugin } from "@opencode/plugin";

import { ensureCrewBeeConfigFile, loadDefaultTeamLibrary, validateTeamLibrary } from "../../../agent-teams";
import type { TeamValidationIssue } from "../../../agent-teams";
import type { TeamLibrary } from "../../../core";
import { resolveOpenCodeConfigRoot } from "../../../install";
import { createSessionRuntimeBinding, type SessionRuntimeBinding } from "../../../runtime";
import { startBackgroundReleaseRefresh } from "../../../update/refresh";

import { createOpenCodeBootstrap, type OpenCodeBootstrapOutput } from "../bootstrap";
import { buildCompactionContext } from "../delegation/continuity";
import { createCheckpoint } from "../delegation/prompt";
import { DelegateStateStore } from "../delegation/store";
import {
  extractAssistantText,
} from "../delegation/output";
import { DEFAULT_OPENCODE_EXECUTION_MODE } from "../defaults";
import {
  createProjectedAgentAliasIndex,
  resolveProjectedAgentAlias,
  resolveProjectedAgentSelection,
  type OpenCodeAgentAliasEntry,
} from "../projection";
import { createSystemTransformHook } from "../system-transform-hook";
import { normalizeDelegateTaskOutput } from "../tool-hooks";

import {
  applyV2AgentDefinition,
  createV2AgentDefinition,
  OPEN_CODE_HOST_AGENT_KEYS,
  type MutableAgentRecord,
} from "./agent-definition";
import { logCrewBeeV2 } from "./logging";
import { listOpenCodeAvailableModelsV2 } from "./models";
import { createV2SessionClient } from "./session-client";
import {
  createV2DelegateToolDefinitions,
  registerV2DelegateTools,
  SUBAGENT_TOOL_NAME,
  TASK_TOOL_ALIAS,
  type V2ToolEditor,
} from "./tool-registration";

export const CREWBEE_PLUGIN_ID = "crewbee";

const BOOTSTRAP_DEFAULTS = { defaultMode: DEFAULT_OPENCODE_EXECUTION_MODE } as const;

const HANDLED_EVENT_TYPES = new Set([
  "session.status",
  "session.idle",
  "session.execution.failed",
  "session.compaction.ended",
  "session.deleted",
]);

interface V2EventLike {
  type?: string;
  data?: Record<string, unknown>;
}

function resolveEventSessionID(event: V2EventLike): string | undefined {
  const sessionID = event.data?.sessionID;
  return typeof sessionID === "string" ? sessionID : undefined;
}

function createBootstrap(
  teamLibrary: TeamLibrary,
  availableModels: string[] | undefined,
  existingConfigKeys?: string[],
): OpenCodeBootstrapOutput {
  return createOpenCodeBootstrap({
    teamLibrary,
    defaults: BOOTSTRAP_DEFAULTS,
    availableModels,
    ...(existingConfigKeys ? { existingConfigKeys } : {}),
  });
}

async function reportTeamIssues(issues: TeamValidationIssue[]): Promise<void> {
  for (const issue of issues) {
    await logCrewBeeV2(issue.message, {
      ...(issue.filePath ? { filePath: issue.filePath } : {}),
      ...(issue.code ? { code: issue.code } : {}),
      ...(issue.path ? { path: issue.path } : {}),
      ...(issue.sourceScope ? { sourceScope: issue.sourceScope } : {}),
      ...(issue.fixable !== undefined ? { fixable: issue.fixable } : {}),
      ...(issue.suggestion ? { suggestion: issue.suggestion } : {}),
    }, issue.level === "warning" ? "warn" : "error");
  }
}

async function finalizeBackgroundTask(
  client: ReturnType<typeof createV2SessionClient>,
  store: DelegateStateStore,
  sessionID: string,
): Promise<void> {
  const task = store.getTaskBySession(sessionID);
  if (!task || task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
    return;
  }

  const message = await extractAssistantText(client, task.sessionID, task.anchor).catch((error) => {
    store.setTaskStatus(task.taskRef, "failed", {
      message: "Failed to read delegated session output.",
      lastError: String(error),
    });
    return undefined;
  });

  if (message === undefined) {
    return;
  }

  store.setTaskStatus(task.taskRef, "completed", {
    message: message || "Delegated session completed with no text output.",
  });
}

/**
 * OpenCode V2 plugin setup.
 *
 * Mirrors the V1 adapter behaviour (agent projection, delegation tools, session binding, continuity)
 * on top of the V2 plugin API: agent/tool transforms, session hooks and `event.subscribe`.
 */
export async function setupCrewBeeV2(ctx: Plugin.Context): Promise<() => void> {
  const directory = ctx.location.directory;

  const crewbeeConfigUpdate = ensureCrewBeeConfigFile({
    configRoot: resolveOpenCodeConfigRoot(),
    mode: "startup",
  });
  if (crewbeeConfigUpdate.changed) {
    await logCrewBeeV2("CrewBee auto-repaired Team config", {
      backupPath: crewbeeConfigUpdate.backupPath,
      configPath: crewbeeConfigUpdate.configPath,
      reason: crewbeeConfigUpdate.reason,
    }, "warn");
  }

  const teamLibrary = loadDefaultTeamLibrary(directory);
  const issues = validateTeamLibrary(teamLibrary);
  const blocking = issues.filter((issue) => issue.level === "error" && issue.blocking !== false);
  if (blocking.length > 0) {
    throw new Error(blocking.map((issue) => issue.message).join("\n"));
  }
  await reportTeamIssues(issues);

  const availableModels = await listOpenCodeAvailableModelsV2(ctx);
  let boot = createBootstrap(teamLibrary, availableModels);
  let aliasIndex: Map<string, OpenCodeAgentAliasEntry> = createProjectedAgentAliasIndex(boot.projectedAgents);

  const managedAgentKeys = new Set<string>();
  const bindings = new Map<string, SessionRuntimeBinding>();
  const store = new DelegateStateStore(directory);
  const abortController = new AbortController();
  const execution = { signal: undefined as AbortSignal | undefined };
  const client = createV2SessionClient(ctx, { getAbortSignal: () => execution.signal });

  await logCrewBeeV2("CrewBee plugin initialized", {
    directory,
    projectedAgentCount: boot.projectedAgents.length,
    visibleAgentCount: boot.projectedAgents.filter((agent) => !agent.hidden).length,
    defaultAgent: boot.configPatch.defaultAgent,
    openCodeVersion: ctx.app.version,
  });

  await ctx.agent.transform((editor) => {
    const existingConfigKeys = editor.list()
      .map((agent) => String(agent.id))
      .filter((id) => !managedAgentKeys.has(id));

    const next = createBootstrap(teamLibrary, availableModels, existingConfigKeys);
    boot = next;
    aliasIndex = createProjectedAgentAliasIndex(next.projectedAgents);

    for (const agent of next.projectedAgents) {
      const definition = createV2AgentDefinition(agent);
      const isNew = !managedAgentKeys.has(agent.configKey);

      // V2 has no `add` on the agent editor: `update` upserts, including unknown ids.
      editor.update(agent.configKey, (target) => {
        applyV2AgentDefinition(target as unknown as MutableAgentRecord, definition);
      });

      managedAgentKeys.add(agent.configKey);

      if (isNew) {
        void logCrewBeeV2("Projected CrewBee agent", {
          configKey: agent.configKey,
          canonicalAgentId: agent.canonicalAgentId,
          mode: agent.mode,
          hidden: agent.hidden,
          model: definition.model ? `${definition.model.providerID}/${definition.model.id}` : undefined,
        }, "debug");
      }
    }

    for (const key of OPEN_CODE_HOST_AGENT_KEYS) {
      if (!editor.get(key)) {
        continue;
      }

      editor.update(key, (target) => {
        target.hidden = true;
        target.mode = "subagent";
      });
    }

    const defaultAgent = next.configPatch.defaultAgent;
    if (defaultAgent && editor.get(defaultAgent)) {
      editor.default(defaultAgent);
    }
  });

  await ctx.tool.transform((editor) => {
    const tools = createV2DelegateToolDefinitions({
      client,
      store,
      getProjectedAgents: () => boot.projectedAgents,
      getAliasIndex: () => aliasIndex,
      bindings,
      directory,
      onExecuteStart: (context) => {
        execution.signal = context.signal;
      },
    });

    registerV2DelegateTools(editor as unknown as V2ToolEditor, tools);
  });

  const systemTransformHook = createSystemTransformHook(bindings, () => teamLibrary.loadIssues ?? []);

  await ctx.session.hook("prompt", async (event) => {
    const session = await ctx.session.get({ sessionID: event.sessionID }).catch(() => undefined);
    const selectedAgent = typeof session?.agent === "string" ? session.agent : boot.configPatch.defaultAgent;
    if (!selectedAgent) {
      return;
    }

    const agent = resolveProjectedAgentSelection(boot.projectedAgents, { configKey: selectedAgent });
    if (!agent) {
      return;
    }

    const binding = createSessionRuntimeBinding({
      projection: boot.projection,
      sessionID: event.sessionID,
      teamId: agent.teamId,
      canonicalAgentId: agent.canonicalAgentId,
      mode: DEFAULT_OPENCODE_EXECUTION_MODE,
      source: typeof session?.agent === "string" ? "host-agent-selection" : "plugin-default",
    });
    bindings.set(event.sessionID, binding);

    const model = session?.model;
    store.setCheckpoint(
      event.sessionID,
      createCheckpoint(
        agent,
        model ? { providerID: model.providerID, modelID: model.id } : undefined,
      ),
    );
  });

  await ctx.session.hook("context", async (event) => {
    const agent = boot.projectedAgents.find((candidate) => candidate.configKey === event.agent);
    const resolved = agent?.resolvedModel;
    if (resolved?.temperature !== undefined) {
      event.options.temperature = resolved.temperature;
    }
    if (resolved?.topP !== undefined) {
      event.options.topP = resolved.topP;
    }

    const output = { system: [] as string[] };
    await systemTransformHook({ sessionID: event.sessionID, model: event.model }, output);

    for (const text of output.system) {
      event.system.push({ type: "text", text });
    }
  });

  await ctx.session.hook("compaction", (event) => {
    event.system.push({ type: "text", text: buildCompactionContext(store, event.sessionID) });
  });

  await ctx.tool.hook("execute.before", (event) => {
    if (event.tool !== SUBAGENT_TOOL_NAME && event.tool !== TASK_TOOL_ALIAS) {
      return;
    }
    if (!bindings.has(event.sessionID)) {
      return;
    }

    const input = event.input;
    if (!input || typeof input !== "object") {
      return;
    }

    const args = input as Record<string, unknown>;
    for (const key of ["agent", "subagent_type"]) {
      const value = args[key];
      if (typeof value !== "string") {
        continue;
      }

      const resolved = resolveProjectedAgentAlias(aliasIndex, value);
      if (resolved) {
        args[key] = resolved.agent.configKey;
      }
    }
  });

  await ctx.tool.hook("execute.after", (event) => {
    if (event.tool !== SUBAGENT_TOOL_NAME && event.tool !== TASK_TOOL_ALIAS) {
      return;
    }
    if (event.status !== "completed") {
      return;
    }

    const result = event.result as { content?: string | readonly unknown[]; metadata?: Record<string, unknown> };
    if (typeof result.content !== "string") {
      return;
    }

    const normalized = normalizeDelegateTaskOutput(result.content);
    if (!normalized) {
      return;
    }

    result.content = normalized.output;
    result.metadata = { ...(result.metadata ?? {}), ...normalized.metadata };
  });

  // `event.subscribe` filters are advisory: every event type is delivered, so filter explicitly.
  const subscription = ctx.event.subscribe({ signal: abortController.signal });
  void (async () => {
    for await (const raw of subscription) {
      if (abortController.signal.aborted) {
        break;
      }

      const event = raw as unknown as V2EventLike;
      const type = event.type;
      if (!type || !HANDLED_EVENT_TYPES.has(type)) {
        continue;
      }

      const sessionID = resolveEventSessionID(event);
      if (!sessionID) {
        continue;
      }

      if (type === "session.status") {
        const status = event.data?.status as { type?: string } | undefined;
        const task = store.getTaskBySession(sessionID);
        if (task && status?.type === "busy") {
          store.setTaskStatus(task.taskRef, "running");
        }
        if (status?.type === "idle") {
          await finalizeBackgroundTask(client, store, sessionID);
        }
        continue;
      }

      if (type === "session.idle") {
        await finalizeBackgroundTask(client, store, sessionID);
        continue;
      }

      if (type === "session.execution.failed") {
        const task = store.getTaskBySession(sessionID);
        if (task) {
          store.setTaskStatus(task.taskRef, "failed", {
            message: "Delegated session failed.",
            lastError: JSON.stringify(event.data?.error ?? "session.execution.failed"),
          });
        }
        continue;
      }

      if (type === "session.compaction.ended") {
        store.markCompacted(sessionID);
        continue;
      }

      if (type === "session.deleted") {
        const task = store.getTaskBySession(sessionID);
        if (task && task.status !== "completed" && task.status !== "failed") {
          store.setTaskStatus(task.taskRef, "cancelled", { message: "Delegated session deleted." });
        }
        store.clearSession(sessionID);
        bindings.delete(sessionID);
      }
    }
  })().catch((error) => {
    void logCrewBeeV2("CrewBee event subscription stopped", { error: String(error) }, "warn");
  });

  startBackgroundReleaseRefresh(undefined, undefined, logCrewBeeV2);

  return () => {
    abortController.abort();
  };
}

/**
 * V2 plugin definition.
 *
 * A plain object rather than `Plugin.define` keeps this adapter type-only against `@opencode/plugin`:
 * that package is ESM-only, while CrewBee still emits a CommonJS `dist` for its tests and V1 hosts.
 */
export const crewBeePluginV2 = {
  id: CREWBEE_PLUGIN_ID,
  setup: setupCrewBeeV2,
};
