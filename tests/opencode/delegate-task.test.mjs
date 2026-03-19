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
    agent: "crewbee.coding-team.leader",
    directory: worktree,
    worktree,
    abort: new AbortController().signal,
    metadata() {},
  };
}

function createPluginInput() {
  const worktree = mkdtempSync(path.join(os.tmpdir(), "crewbee-delegate-"));
  const sessions = new Map();
  let counter = 0;

  const runPrompt = async ({ path: p, body }) => {
    const session = sessions.get(p.id);
    if (!session) {
      throw new Error("missing session");
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
    { tool: "delegate_task", sessionID: "ses-parent", callID: "call-1" },
    output,
  );
  return parseJson(output.output);
}

test("delegate_task foreground returns structured result with resume hint", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "crewbee.coding-team.leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const raw = await plugin.tool.delegate_task.execute(
    { agent: "reviewer", prompt: "Review the current implementation.", mode: "foreground" },
    createToolContext(fixture.worktree),
  );
  const result = await runAfterHook(plugin, { title: "delegate_task", output: raw, metadata: {} });

  assert.equal(result.status, "completed");
  assert.match(result.message, /done by crewbee\.coding-team\.reviewer/);
  assert.match(result.resume_hint, /delegate_task\(session_id=/);
});

test("delegate_task background is finalized from session events and appears in compaction context", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "crewbee.coding-team.leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const raw = await plugin.tool.delegate_task.execute(
    { agent: "reviewer", prompt: "Review the current implementation.", mode: "background" },
    createToolContext(fixture.worktree),
  );
  const launched = parseJson(raw);

  assert.equal(launched.status, "running");
  assert.ok(launched.task_ref);

  await plugin.event?.({ event: { type: "session.status", properties: { sessionID: launched.session_id, status: { type: "busy" } } } });
  await plugin.event?.({ event: { type: "session.idle", properties: { sessionID: launched.session_id } } });

  const status = parseJson(await plugin.tool.delegate_status.execute({ task_ref: launched.task_ref }, createToolContext(fixture.worktree)));
  assert.equal(status.status, "completed");
  assert.match(status.message, /done by crewbee\.coding-team\.reviewer/);

  const compacting = { context: [], prompt: undefined };
  await plugin["experimental.session.compacting"]?.({ sessionID: "ses-parent" }, compacting);
  assert.match(compacting.context.join("\n"), /Delegated Agent Sessions/);
  assert.match(compacting.context.join("\n"), new RegExp(launched.session_id));
});

test("delegate_cancel marks a background delegation as cancelled", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "crewbee.coding-team.leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const launched = parseJson(await plugin.tool.delegate_task.execute(
    { agent: "reviewer", prompt: "Review the current implementation.", mode: "background" },
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
    { sessionID: "ses-parent", agent: "crewbee.coding-team.leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const first = parseJson(await plugin.tool.delegate_task.execute(
    { agent: "reviewer", prompt: "First review pass.", mode: "background" },
    createToolContext(fixture.worktree),
  ));
  await plugin.event?.({ event: { type: "session.idle", properties: { sessionID: first.session_id } } });

  const second = parseJson(await plugin.tool.delegate_task.execute(
    { agent: "reviewer", prompt: "Second review pass.", mode: "background", session_id: first.session_id },
    createToolContext(fixture.worktree),
  ));
  await plugin.event?.({ event: { type: "session.status", properties: { sessionID: second.session_id, status: { type: "busy" } } } });
  await plugin.event?.({ event: { type: "session.idle", properties: { sessionID: second.session_id } } });

  const status = parseJson(await plugin.tool.delegate_status.execute({ task_ref: second.task_ref }, createToolContext(fixture.worktree)));
  assert.equal(status.status, "completed");
});

test("delegate_task failure adds retry guidance", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "crewbee.coding-team.leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  const raw = await plugin.tool.delegate_task.execute(
    { agent: "missing-agent", prompt: "Review the current implementation.", mode: "foreground" },
    createToolContext(fixture.worktree),
  );
  const result = await runAfterHook(plugin, { title: "delegate_task", output: raw, metadata: {} });

  assert.equal(result.status, "failed");
  assert.equal(result.error_code, "unknown_agent");
  assert.match(result.message, /RETRY REQUIRED/);
});

test("session.compacted triggers prompt checkpoint recovery", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "crewbee.coding-team.leader", model: { providerID: "openai", modelID: "gpt-5.4" } },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  await plugin.event?.({ event: { type: "session.compacted", properties: { sessionID: "ses-parent" } } });

  const parts = fixture.sessions.get("ses-parent").messages.at(-1)?.parts ?? [];
  assert.match(parts[0]?.text ?? "", /prompt checkpoint refresh/);
});

test("session.compacted triggers todo restore prompt when todos were captured and current list is empty", async () => {
  const fixture = createPluginInput();
  const plugin = await OpenCodeCrewBeePlugin(fixture.input);
  const config = { agent: {} };

  await plugin.config?.(config);
  await plugin["chat.message"]?.(
    { sessionID: "ses-parent", agent: "crewbee.coding-team.leader" },
    { message: { role: "user", parts: [] }, parts: [] },
  );

  // Step 1: Trigger compacting hook — captures current todos (["Ship feature"]) into store.
  const compacting = { context: [], prompt: undefined };
  await plugin["experimental.session.compacting"]?.({ sessionID: "ses-parent" }, compacting);

  // Step 2: Now simulate compaction having wiped the todo list.
  fixture.sessions.get("ses-parent").todos = [];

  // Step 3: Fire session.compacted event — should call restoreTodoSnapshot,
  //         find current list empty, and send a prompt to restore the todos.
  const messagesBefore = fixture.sessions.get("ses-parent").messages.length;
  await plugin.event?.({ event: { type: "session.compacted", properties: { sessionID: "ses-parent" } } });

  const messagesAfter = fixture.sessions.get("ses-parent").messages;
  // Find the todo restore prompt among messages added after compaction fired
  const newMessages = messagesAfter.slice(messagesBefore);
  const todoRestoreMsg = newMessages.find((m) => {
    const text = m._promptText ?? "";
    return text.includes("todo list") && text.includes("Ship feature");
  });
  assert.ok(todoRestoreMsg, "todo restore prompt was sent after compaction");
  assert.match(todoRestoreMsg._promptText, /TodoWrite/);
});
