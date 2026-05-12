import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";

import { OpenCodeCrewBeePlugin } from "../../dist/src/adapters/opencode/plugin.js";

function parseJson(text) {
  return JSON.parse(text);
}

function createToolContext(worktree, sessionID = "ses-parent") {
  return {
    sessionID,
    messageID: "msg-parent",
    agent: "coding-leader",
    directory: worktree,
    worktree,
    abort: new AbortController().signal,
    metadata() {},
  };
}

function createPluginInput(options = {}) {
  const worktree = mkdtempSync(path.join(os.tmpdir(), "crewbee-delegate-"));
  const sessions = new Map();
  const promptBodies = [];
  let counter = 0;
  let modelFailureInjected = false;

  const runPrompt = async ({ path: p, body }) => {
    const session = sessions.get(p.id);
    if (!session) {
      throw new Error("missing session");
    }

    promptBodies.push(body);

    if (options.failFirstModelPrompt && body.model && !modelFailureInjected) {
      modelFailureInjected = true;
      const error = new Error("Model not found");
      error.name = "ProviderModelNotFoundError";
      throw error;
    }

    if (body.noReply) {
      session.messages.push({
        info: { role: "user", id: `msg-${++counter}`, time: { created: Date.now() } },
        parts: body.parts,
        _promptText: body.parts?.[0]?.text,
      });
      return { id: `msg-${counter}` };
    }

    session.messages.push({
      info: { role: "assistant", id: `msg-${++counter}`, time: { created: Date.now() } },
      parts: [{ type: "text", text: `done by ${body.agent}` }],
      _promptText: body.parts?.[0]?.text,
    });
    return { id: `msg-${counter}` };
  };

  sessions.set("ses-parent", { messages: [], todos: [{ id: "todo-1", content: "Ship feature", status: "in_progress", priority: "high" }] });

  const client = {
    app: {
      log: async () => {},
    },
    config: options.availableModels
      ? {
        providers: async () => ({
          providers: Object.values(options.availableModels.reduce((acc, model) => {
            const separator = model.indexOf("/");
            const providerID = model.slice(0, separator);
            const modelID = model.slice(separator + 1);
            acc[providerID] ??= { id: providerID, models: {} };
            acc[providerID].models[modelID] = { id: modelID, name: modelID };
            return acc;
          }, {})),
        }),
      }
      : undefined,
    session: {
      create: async ({ body }) => {
        const id = `ses-child-${++counter}`;
        sessions.set(id, { parentID: body.parentID, title: body.title, messages: [], todos: [] });
        return { id };
      },
      get: async ({ path: p }) => {
        const session = sessions.get(p.id);
        if (!session) {
          throw new Error("missing session");
        }
        return { id: p.id, title: session.title ?? p.id };
      },
      messages: async ({ path: p }) => sessions.get(p.id)?.messages ?? [],
      prompt: runPrompt,
      promptAsync: runPrompt,
      abort: async () => true,
      todo: async ({ path: p }) => sessions.get(p.id)?.todos ?? [],
    },
  };

  return {
    worktree,
    sessions,
    promptBodies,
    input: {
      client,
      project: { id: "test-project", directory: worktree, worktree },
      directory: worktree,
      worktree,
      serverUrl: new URL("http://localhost:4096"),
      $() {
        throw new Error("shell unavailable");
      },
    },
  };
}

async function runAfterHook(plugin, output) {
  await plugin["tool.execute.after"]?.(
    { tool: "task", sessionID: "ses-parent", callID: "call-1" },
    output,
  );
  return parseJson(output.output);
}

test("task foreground returns structured result with resume hint", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "coding-leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const raw = await plugin.tool.task.execute(
    { subagent_type: "coding-reviewer", prompt: "Review the current implementation." },
    createToolContext(fixture.worktree),
  );
  const output = { title: "task", output: raw, metadata: {} };
  const result = await runAfterHook(plugin, output);

  assert.equal(result.status, "completed");
  assert.match(result.message, /done by coding-reviewer/);
  assert.match(result.resume_hint, /task\(task_id=/);
  assert.equal(output.metadata.sessionId, result.session_id);
  assert.equal(output.metadata.taskId, result.session_id);
});

test("task foreground retries with host default when non-strict delegated model is unavailable", async () => {
  const fixture = createPluginInput({
    availableModels: ["openai/gpt-5.5"],
    failFirstModelPrompt: true,
  });
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "coding-leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const raw = await plugin.tool.task.execute(
    { subagent_type: "coding-reviewer", prompt: "Review the current implementation." },
    createToolContext(fixture.worktree),
  );
  const result = parseJson(raw);
  const delegatedPrompts = fixture.promptBodies.filter((body) => body.agent === "coding-reviewer");

  assert.equal(result.status, "completed");
  assert.ok(delegatedPrompts[0].model, "first delegated prompt should use the resolved model");
  assert.equal(delegatedPrompts[1].model, undefined, "retry should fall back to OpenCode host default");
});

test("task rejects agents outside the active Team member collaboration list", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "coding-leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const raw = await plugin.tool.task.execute(
    { subagent_type: "coding-coordination-leader", prompt: "Coordinate this instead." },
    createToolContext(fixture.worktree),
  );
  const result = parseJson(raw);

  assert.equal(result.status, "failed");
  assert.equal(result.error_code, "unknown_agent");
  assert.match(result.message, /disallowed/);
});

test("task creates a new child session when task_id is unknown", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "coding-leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const result = parseJson(await plugin.tool.task.execute(
    { subagent_type: "coding-codebase-explorer", prompt: "Locate the relevant code path.", task_id: "ses_missing" },
    createToolContext(fixture.worktree),
  ));

  assert.equal(result.status, "completed");
  assert.notEqual(result.session_id, "ses_missing");
  assert.equal(result.task_id, result.session_id);
  assert.ok(fixture.sessions.has(result.session_id));
  assert.match(result.message, /done by coding-codebase-explorer/);
});

test("task creates a replacement child session when stored task_id is stale", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "coding-leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const first = parseJson(await plugin.tool.task.execute(
    { subagent_type: "coding-codebase-explorer", prompt: "Locate the relevant code path." },
    createToolContext(fixture.worktree),
  ));
  fixture.sessions.delete(first.session_id);

  const second = parseJson(await plugin.tool.task.execute(
    { subagent_type: "coding-codebase-explorer", prompt: "Continue locating the relevant code path.", task_id: first.session_id },
    createToolContext(fixture.worktree),
  ));

  assert.equal(second.status, "completed");
  assert.notEqual(second.session_id, first.session_id);
  assert.ok(fixture.sessions.has(second.session_id));
  assert.match(second.message, /done by coding-codebase-explorer/);
});

test("task background is finalized from session events and appears in compaction context", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "coding-leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const raw = await plugin.tool.task.execute(
    { subagent_type: "coding-reviewer", prompt: "Review the current implementation.", run_in_background: true },
    createToolContext(fixture.worktree),
  );
  const output = { title: "task", output: raw, metadata: {} };
  const launched = await runAfterHook(plugin, output);

  assert.equal(launched.status, "running");
  assert.ok(launched.task_ref);
  assert.equal(output.metadata.sessionId, launched.session_id);
  assert.equal(output.metadata.taskId, launched.session_id);
  assert.equal(output.metadata.taskRef, launched.task_ref);

  await plugin.event?.({ event: { type: "session.status", properties: { sessionID: launched.session_id, status: { type: "busy" } } } });
  await plugin.event?.({ event: { type: "session.idle", properties: { sessionID: launched.session_id } } });

  const status = parseJson(await plugin.tool.delegate_status.execute({ task_ref: launched.task_ref }, createToolContext(fixture.worktree)));
  assert.equal(status.status, "completed");
  assert.match(status.message, /done by coding-reviewer/);

  const compacting = { context: [], prompt: undefined };
  await plugin["experimental.session.compacting"]?.({ sessionID: "ses-parent" }, compacting);
  assert.match(compacting.context.join("\n"), /Checkpointed Agent Configuration/);
  assert.match(compacting.context.join("\n"), /agent=coding-leader/);
  assert.match(compacting.context.join("\n"), /Todo Snapshot/);
  assert.match(compacting.context.join("\n"), /Ship feature/);
  assert.match(compacting.context.join("\n"), /Delegated Agent Sessions/);
  assert.match(compacting.context.join("\n"), new RegExp(launched.session_id));
});

test("task foreground sessions also appear in compaction context", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "coding-leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const raw = await plugin.tool.task.execute(
    { subagent_type: "coding-reviewer", prompt: "Review the current implementation." },
    createToolContext(fixture.worktree),
  );
  const result = parseJson(raw);

  const compacting = { context: [], prompt: undefined };
  await plugin["experimental.session.compacting"]?.({ sessionID: "ses-parent" }, compacting);

  assert.equal(result.status, "completed");
  assert.match(compacting.context.join("\n"), /foreground delegation/);
  assert.match(compacting.context.join("\n"), new RegExp(result.session_id));
});

test("delegate_cancel marks a background delegation as cancelled", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "coding-leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const launched = parseJson(await plugin.tool.task.execute(
    { subagent_type: "coding-reviewer", prompt: "Review the current implementation.", run_in_background: true },
    createToolContext(fixture.worktree),
  ));
  const cancelled = parseJson(await plugin.tool.delegate_cancel.execute({ task_ref: launched.task_ref }, createToolContext(fixture.worktree)));
  const status = parseJson(await plugin.tool.delegate_status.execute({ task_ref: launched.task_ref }, createToolContext(fixture.worktree)));

  assert.equal(cancelled.ok, true);
  assert.equal(status.status, "cancelled");
});

test("background resume updates the latest task for a reused delegated session", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "coding-leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const first = parseJson(await plugin.tool.task.execute(
    { subagent_type: "coding-reviewer", prompt: "First review pass.", run_in_background: true },
    createToolContext(fixture.worktree),
  ));
  await plugin.event?.({ event: { type: "session.idle", properties: { sessionID: first.session_id } } });

  const second = parseJson(await plugin.tool.task.execute(
    { subagent_type: "coding-reviewer", prompt: "Second review pass.", run_in_background: true, task_id: first.session_id },
    createToolContext(fixture.worktree),
  ));
  await plugin.event?.({ event: { type: "session.status", properties: { sessionID: second.session_id, status: { type: "busy" } } } });
  await plugin.event?.({ event: { type: "session.idle", properties: { sessionID: second.session_id } } });

  const status = parseJson(await plugin.tool.delegate_status.execute({ task_ref: second.task_ref }, createToolContext(fixture.worktree)));
  assert.equal(status.status, "completed");
});

test("task failure adds retry guidance", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "coding-leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const raw = await plugin.tool.task.execute(
    { subagent_type: "missing-agent", prompt: "Review the current implementation." },
    createToolContext(fixture.worktree),
  );
  const result = await runAfterHook(plugin, { title: "task", output: raw, metadata: {} });

  assert.equal(result.status, "failed");
  assert.equal(result.error_code, "unknown_agent");
  assert.match(result.message, /RETRY REQUIRED/);
});

test("delegated subagents cannot delegate again", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "coding-leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const first = parseJson(await plugin.tool.task.execute(
    { subagent_type: "coding-reviewer", prompt: "Review the current implementation." },
    createToolContext(fixture.worktree),
  ));

  const nestedRaw = await plugin.tool.task.execute(
    { subagent_type: "coding-principal-advisor", prompt: "Escalate this review." },
    createToolContext(fixture.worktree, first.session_id),
  );
  const nested = parseJson(nestedRaw);

  assert.equal(nested.status, "failed");
  assert.equal(nested.error_code, "nested_delegate_forbidden");
});

test("session.compacted records continuity state without injecting recovery prompts", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "coding-leader", model: { providerID: "openai", modelID: "gpt-5.5" } },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const messagesBefore = fixture.sessions.get("ses-parent").messages.length;
  await plugin.event?.({ event: { type: "session.compacted", properties: { sessionID: "ses-parent" } } });

  const messagesAfter = fixture.sessions.get("ses-parent").messages.length;
  assert.equal(messagesAfter, messagesBefore);
});
