import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setImmediate as tick } from "node:timers/promises";
import { setupCrewBeeV2 } from "../../dist/src/adapters/opencode/v2/plugin.js";
import { createV2SessionClient } from "../../dist/src/adapters/opencode/v2/session-client.js";

// A deterministic host fixture: admission and execution completion are separate,
// just as they are in V2. These tests exercise the real adapter/delegation engine.
async function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), "crewbee-v2-"));
  const previous = { OPENCODE_CONFIG_DIR: process.env.OPENCODE_CONFIG_DIR, XDG_CACHE_HOME: process.env.XDG_CACHE_HOME, CREWBEE_AUTO_UPDATE: process.env.CREWBEE_AUTO_UPDATE };
  Object.assign(process.env, { OPENCODE_CONFIG_DIR: path.join(root, "config"), XDG_CACHE_HOME: path.join(root, "cache"), CREWBEE_AUTO_UPDATE: "0" });
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const agents = new Map(["build", "plan"].map((id) => [id, { id }]));
  const tools = new Map();
  const hooks = new Map();
  const sessions = new Map([["parent", { id: "parent", agent: "coding-leader", messages: [], model: { providerID: "test", id: "default" } }]]);
  const interrupts = [];
  const admissions = [];
  const events = [];
  let notify;
  let stopped = false;
  let nextID = 0;
  function emit(type, sessionID, extra = {}) {
    events.push({ type, data: { sessionID, ...extra } });
    notify?.();
  }
  const ctx = {
    location: { directory: root }, app: { version: "2.2.0" },
    model: {
      list: async () => ({ data: [{ providerID: "test", id: "default" }] }),
      default: async () => ({ data: { providerID: "test", id: "default" } }),
    },
    agent: { transform: async (fn) => fn({
      list: () => [...agents.values()], get: (id) => agents.get(id), default: (id) => { ctx.defaultAgent = id; },
      update: (id, update) => { const agent = agents.get(id) ?? { id }; update(agent); agents.set(id, agent); },
    }) },
    tool: {
      transform: async (fn) => fn({ add: (tool) => tools.set(tool.name, tool) }),
      hook: async (name, fn) => hooks.set(`tool.${name}`, fn),
    },
    session: {
      hook: async (name, fn) => hooks.set(name, fn),
      create: async ({ parentID, title }) => {
        await tick(); // Deliberate overlap before the cancellation signal is used.
        const id = `child-${++nextID}`;
        sessions.set(id, { id, parentID, title, messages: [] });
        return { id };
      },
      get: async ({ sessionID }) => sessions.get(sessionID),
      context: async ({ sessionID }) => sessions.get(sessionID).messages,
      switchAgent: async ({ sessionID, agent }) => { sessions.get(sessionID).agent = agent; },
      switchModel: async ({ sessionID, model }) => { sessions.get(sessionID).model = model; },
      prompt: async ({ sessionID, text }) => {
        const session = sessions.get(sessionID);
        await hooks.get("prompt")?.({ sessionID });
        session.outcome = undefined;
        session.messages.push({ id: `user-${session.messages.length}`, type: "user", content: [{ type: "text", text }] });
        session.pending = new Promise((resolve) => { session.finish = resolve; });
        admissions.push({ sessionID, text, model: session.model });
        emit("session.status", sessionID, { status: { type: "busy" } });
      },
      wait: async ({ sessionID }) => { await sessions.get(sessionID).pending; },
      interrupt: async ({ sessionID }) => {
        interrupts.push(sessionID);
        const session = sessions.get(sessionID);
        session.outcome = "interrupted";
        session.finish?.();
      },
    },
    event: { subscribe: ({ signal }) => ({
      async *[Symbol.asyncIterator]() {
        signal.addEventListener("abort", () => { stopped = true; notify?.(); }, { once: true });
        while (!stopped) {
          if (!events.length) await new Promise((resolve) => { notify = resolve; });
          while (events.length && !stopped) yield events.shift();
        }
      },
    }) },
  };
  const cleanup = await setupCrewBeeV2(ctx);
  t.after(cleanup);
  await hooks.get("prompt")({ sessionID: "parent" });
  const toolContext = (signal = new AbortController().signal) => ({
    sessionID: "parent", messageID: "message", agent: "coding-leader", id: "call", signal, progress: async () => {},
  });
  function complete(id, error) {
    const session = sessions.get(id);
    session.outcome = error ? "failed" : "completed";
    session.messages.push({ id: `answer-${session.messages.length}`, type: "assistant", content: [{ type: "text", text: "Reviewed successfully" }], ...(error ? { error } : {}) });
    if (error) emit("session.execution.failed", id, { error });
    session.finish?.();
    emit("session.idle", id);
  }
  async function admitted(count) {
    for (let i = 0; i < 100 && admissions.length < count; i++) await tick();
    assert.equal(admissions.length, count, "expected prompt admission");
  }
  return { ctx, agents, tools, hooks, sessions, interrupts, admissions, toolContext, complete, admitted, cleanup, isStopped: () => stopped };
}

test("V2 projects Team agents, runs foreground delegation, and preserves compaction continuity", async (t) => {
  const f = await fixture(t);
  assert.equal(f.ctx.defaultAgent, "coding-leader");
  assert.equal(f.agents.get("build").hidden, true);
  assert.deepEqual([...f.tools.keys()], ["subagent", "task", "delegate_status", "delegate_cancel"]);
  let returned = false;
  const pending = f.tools.get("subagent").execute({ agent: "coding-reviewer", prompt: "Review this change" }, f.toolContext()).then((value) => { returned = true; return value; });
  await f.admitted(1);
  assert.equal(returned, false, "foreground must wait beyond admission");
  f.complete("child-1");
  const result = await pending;
  assert.equal(JSON.parse(result.content).status, "completed");
  assert.match(JSON.parse(result.content).message, /Reviewed successfully/);
  assert.equal(result.metadata.sessionId, "child-1");
  const context = { sessionID: "parent", agent: "coding-leader", model: {}, system: [], options: {} };
  await f.hooks.get("context")(context);
  assert.match(context.system.map((part) => part.text).join("\n"), /coding-team/);
  const compact = { sessionID: "parent", system: [] };
  await f.hooks.get("compaction")(compact);
  assert.match(compact.system[0].text, /child-1/);
  f.cleanup();
  await tick();
  assert.equal(f.isStopped(), true);
});

test("V2 concurrent foreground calls retain independent cancellation signals", async (t) => {
  const f = await fixture(t);
  const a = new AbortController();
  const b = new AbortController();
  const task = f.tools.get("task");
  const first = task.execute({ agent: "coding-reviewer", prompt: "First" }, f.toolContext(a.signal));
  const second = task.execute({ agent: "coding-reviewer", prompt: "Second" }, f.toolContext(b.signal));
  await f.admitted(2);
  a.abort();
  await tick();
  assert.deepEqual(f.interrupts, ["child-1"]);
  f.complete("child-2");
  assert.equal(JSON.parse((await first).content).status, "failed");
  assert.equal(JSON.parse((await second).content).status, "completed");
});

test("V2 background delegation reports completion, failure, and cancellation", async (t) => {
  const f = await fixture(t);
  const task = f.tools.get("task");
  const background = async () => JSON.parse((await task.execute({ agent: "coding-reviewer", prompt: "Background review", background: true }, f.toolContext())).content);
  const readStatus = async (ref) => JSON.parse((await f.tools.get("delegate_status").execute({ task_ref: ref }, f.toolContext())).content);
  const first = await background();
  await f.admitted(1);
  f.complete(first.session_id);
  await tick();
  assert.equal((await readStatus(first.task_ref)).status, "completed");
  const second = await background();
  await f.admitted(2);
  f.complete(second.session_id, { message: "provider unavailable" });
  await tick();
  assert.equal((await readStatus(second.task_ref)).status, "failed");
  const third = await background();
  await f.admitted(3);
  await f.tools.get("delegate_cancel").execute({ task_ref: third.task_ref }, f.toolContext());
  assert.equal((await readStatus(third.task_ref)).status, "cancelled");
  assert.ok(f.interrupts.includes(third.session_id));
});

test("V2 session facade restores host default when a fallback request omits the model", async (t) => {
  const f = await fixture(t);
  const client = createV2SessionClient(f.ctx);
  const child = await client.session.create({ body: { parentID: "parent", title: "fallback" } });
  const input = { path: { id: child.id }, body: { agent: "coding-reviewer", model: { providerID: "bad", modelID: "missing" }, parts: [{ type: "text", text: "Review" }] } };
  const failed = client.session.prompt(input);
  const rejected = assert.rejects(failed, /Model not found/);
  await f.admitted(1);
  f.complete(child.id, { message: "Model not found" });
  await rejected;
  const retry = client.session.prompt({ ...input, body: { ...input.body, model: undefined } });
  await f.admitted(2);
  assert.deepEqual(f.admissions[1].model, { providerID: "test", id: "default" });
  f.complete(child.id);
  await retry;
});
