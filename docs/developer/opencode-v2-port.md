# CrewBee → OpenCode V2 — Analysis and Porting Plan

> Working document of the `crewbee-v2` fork.
> Status: **analysis completed, implementation not yet started**.
> Port author: Alessandro Muzzi (local fork `~/Projects/crewbee-v2`, branch `feat/opencode-v2-port`).

---

## 1. Verdict

CrewBee **cannot** be loaded by OpenCode V2. The published package (`crewbee@0.1.24`) implements
the **OpenCode V1** plugin API (entrypoint = V1 plugin *function*), while V2 requires a default
export **object** with `id` + `setup(ctx)`.

The port is feasible: the affected area is limited to `src/adapters/opencode/**` (5,162
lines including delegation), `src/install/**` (config key) and `src/update/refresh.ts`.
No domain logic (Team library, projection, prompt building) has to be rewritten: only the
**contract with the host** changes.

Estimated risk: **medium**. The delicate part is delegation (`task`/`subagent`), because in V2
the tool is called `subagent`, the session event has a different shape and the `todo` API no
longer exists.

---

## 2. Verification environment

| Component | Version | Note |
|---|---|---|
| opencode (installed) | **2.1.3** | `/opt/homebrew/Cellar/opencode-v2/2.1.3/bin/opencode` (homebrew-core `opencode` = 2.1.2) |
| `@opencode/plugin` (V2 SDK) | **2.1.3** | inspected for the real types |
| `@opencode/plugin` latest on npm | 2.2.0 | not aligned with the local binary |
| `@opencode-ai/plugin` (V1 SDK) | 1.19.4 latest / 1.15.10 used by CrewBee | V1 line |
| `crewbee` npm latest | **0.1.24** | depends on `@opencode-ai/plugin@1.14.48` |
| CrewBee upstream `main` | `3efe39b` (2026-07-25) | `package.json` → `@opencode-ai/plugin@1.15.10` |
| node / npm | 20.20.2 / 10.8.2 | `bun` **not** installed (upstream tests use `node --test`) |

Reference documentation used: `https://opencode.ai/v2/docs/build/plugins`,
`.../build/plugins/migrate-v1`, `.../build/plugins/server`, `.../agents`, `.../tools`.

---

## 3. Reproducing the failure (V2)

Isolated install in a temporary `HOME`, `crewbee@0.1.24` downloaded from npm, then:

```
$ opencode plugin add crewbee
Plugin "crewbee" installed and added to .../.config/opencode/opencode.json
$ opencode plugin list
ID  VERSION  SOURCE
-   -        crewbee
```

Server log (`role=server`):

```
msg="loading plugin" id=crewbee entrypoint=file://.../crewbee/dist/opencode-plugin.mjs
level=WARN message="failed to load plugin" target=crewbee
  cause=PluginModule.LoadError: Plugin must export a default definition with an id and an effect or setup function.
        (cause: SchemaError(Expected object at ["default"]))
```

Consequences: no projected agents (`opencode debug agents` lists only `build`, `compaction`, …),
no `task`/`delegate_status`/`delegate_cancel` tools, no session binding.

**V1 counter-proof** (same package, `opencode-ai@1.19.4`): the plugin loads and projects
`coding-coordination-leader`, `coding-executor`, `coding-codebase-explorer`, `coding-reviewer`, …
⇒ the problem is exclusively the plugin contract, not the CrewBee logic.

---

## 4. V1 surface currently used by CrewBee

Summary with files/lines (references to `main` @ `3efe39b`):

| # | V1 surface | CrewBee usage | File |
|---|---|---|---|
| 1 | `PluginInput.client` (V1 SDK) | sessions, providers, log | `plugin.ts`, `logging.ts`, `delegation/*.ts` |
| 2 | `PluginInput.directory` / `.worktree` (string) | project root / delegation state | `plugin.ts:38`, `delegation/store.ts` |
| 3 | `PluginInput.project` | — | unused |
| 4 | `config` hook | agent injection + `default_agent` | `config-hook.ts:73-123` |
| 5 | `tool` hook (map) | `task`, `delegate_status`, `delegate_cancel` | `plugin.ts:50-55`, `delegation/tools.ts` |
| 6 | `event` hook | background delegation completion | `event-hook.ts` |
| 7 | `chat.message` hook | session↔team binding | `chat-message-hook.ts` |
| 8 | `tool.definition` hook | no-op | `tool-hooks.ts:76-78` |
| 9 | `tool.execute.before` hook | alias → config key of `subagent_type` | `tool-hooks.ts:80-99` |
| 10 | `tool.execute.after` hook | task output normalization | `tool-hooks.ts:101-125` |
| 11 | `experimental.chat.system.transform` hook | injects CrewBee runtime context | `system-transform-hook.ts` |
| 12 | `experimental.session.compacting` hook | todo snapshot + continuity context | `compaction-hook.ts` |
| 13 | `client.session.create/prompt/promptAsync/messages/abort/todo` | delegation engine | `delegation/tools.ts`, `output.ts`, `continuity.ts` |
| 14 | `client.config.providers()` | model availability filter | `model-availability.ts:30` |
| 15 | `client.app.log({body})` | structured logging | `logging.ts:14` |
| 16 | `tool()` helper (zod) + string `ToolResult` | tool definition | `delegation/tools.ts:25-33` |
| 17 | V1 agent format (`prompt`, `permission` map, `disable`, `tools`) | agent projection | `projection.ts:254-344` |
| 18 | `plugin: [...]` config key (V1 key) | installation | `install/opencode-config-file.ts:126` |
| 19 | `Plugin` type = function `(input, options) => Hooks` | entrypoint | `plugin.ts:19-86` |

---

## 5. API delta V1 → V2 (verified against `@opencode/plugin@2.1.3` types)

### 5.1 Entrypoint and lifecycle

| V1 | V2 |
|---|---|
| `export const P: Plugin = async (ctx) => ({ ...hooks })` | `export default Plugin.define({ id: "crewbee", async setup(ctx) { ... } })` |
| `ctx` = `PluginInput` | `ctx` = `Context` (domain by domain) |
| `options` (2nd argument) | `ctx.options` |
| `dispose()` returned | `return () => {...}` from `setup` |
| `event` hook | `ctx.event.subscribe({ types, signal })` → `AsyncIterable` |
| — | **`id` required** (storage scoping, diagnostics) |

### 5.2 Context

| V1 | V2 |
|---|---|
| `ctx.client.app.log({body})` | ❌ does not exist → `console.log/warn` (server window) |
| `ctx.directory` | `ctx.location.directory` |
| `ctx.worktree` (string) | ❌ not a string → use `ctx.location.directory` |
| `ctx.project` | `ctx.location.project` |
| `ctx.client.config.providers()` | `ctx.provider.list()` / `ctx.model.list()` |
| `ctx.client.session.*` | `ctx.session.*` (different signatures) |

### 5.3 Hooks → domains

| V1 | V2 | Notes |
|---|---|---|
| `config` (mutating `cfg.agent`, `cfg.default_agent`) | `ctx.agent.transform(editor)` | `editor.add/update/remove/list/get`, `editor.default(id)` |
| `tool` map | `ctx.tool.transform(editor)` | `editor.add({name, description, input: JSONSchema, execute})` |
| `chat.message` | `ctx.session.hook("prompt", cb)` | event: `{sessionID, messageID, prompt:{text,files,agents,skills}, metadata, delivery}` |
| `tool.execute.before` | `ctx.tool.hook("execute.before", cb)` | event: `{tool, sessionID, agent, messageID, id, input}` — `input` is mutable |
| `tool.execute.after` | `ctx.tool.hook("execute.after", cb)` | event: `{..., status, result}` — `result` = `Tool.Result` (`content`, `metadata`) |
| `experimental.chat.system.transform` | `ctx.session.hook("context", cb)` | `event.system` = `SystemPart[]` (not `string[]`) → push `{type:"text", text}` |
| `experimental.session.compacting` | `ctx.session.hook("compaction", cb)` | event extends `SessionContext` (`system`, `messages`, `options`, `tools`) |
| `event` | `ctx.event.subscribe({types, signal})` | V2 events: `session.idle`, `session.status`, `session.deleted`, `session.execution.failed`, `session.compaction.ended` |

### 5.4 Tools

| V1 | V2 |
|---|---|
| `tool({description, args: zodShape, execute})` | `editor.add({name, description, input: JSONSchema, execute})` |
| zod `args` | JSON Schema `input` |
| returns `string` | returns `{ content: string \| Content[], output?, metadata? }` |
| `ctx.metadata({title, metadata})` | `context.progress({...})` + `result.metadata` |
| `ctx.abort` (AbortSignal) | `context.signal` |
| `ctx.ask(...)` | `ctx.permission.assert(...)` (not used by CrewBee) |
| delegation tool name: **`task`** | V2 native tool: **`subagent`** (permission action `subagent`) |

### 5.5 Sessions

| V1 (`client.session.*`) | V2 (`ctx.session.*`) |
|---|---|
| `create({path:{id}, body:{parentID,title}})` | `create({ parentID, title })` |
| `prompt({path:{id}, body:{agent,model,parts}})` | `prompt({ sessionID, text })` + `switchAgent({sessionID, agent})` + `switchModel({sessionID, model})` |
| `promptAsync` (background) | ❌ does not exist → `prompt()` is already non-blocking (inbox admission); `wait({sessionID})` waits |
| `messages({path:{id}})` → `[{info, parts}]` | `context({sessionID})` → `SessionMessageInfo[]` (union: `type:"assistant"`, `content:[{type:"text",text}]`) |
| `abort({path:{id}})` | `interrupt({sessionID, resume:false})` |
| `todo({path:{id}})` | ❌ **does not exist in V2** → degradation (see §7.4) |

### 5.6 Agent format

| V1 (`projection.ts:254-274`) | V2 |
|---|---|
| `name` | `id` (+ display `name`) |
| `prompt` | **`system`** |
| `permission: {edit:{allow:[…]}, bash:"ask"}` | **`permissions: [{action, resource, effect}]`** (last rule wins) |
| `model: "provider/model"` | `model: "provider/model#variant"` or `{providerID, model, variant}` |
| `temperature` / `top_p` | ⚠️ deprecated in V2; `request.body` **is not yet sent** (2.1.3) → see §7.5 |
| `mode: "primary"\|"subagent"` | `mode: "primary"\|"subagent"\|"all"` |
| `disable: true` | **`disabled: true`** |
| `tools: {…}` | ❌ does not exist → tool filtering via `permissions` (deny per action) |
| `hidden` | `hidden` ✔ |
| `options.crewbee` (ownership marker) | `request.body`? no → use `metadata`/internal marker (see §7.6) |

V2 permission actions (from `docs/agents`): `shell`, `edit`, `subagent`, `read`, `glob`, `grep`,
`webfetch`, `websearch`, `skill`, `question`, `external_directory`, `doom_loop`, `*`.

### 5.7 Events (rename required)

| V1 | V2 |
|---|---|
| `session.idle` | `session.idle` ✔ |
| `session.status` | `session.status` ✔ |
| `session.deleted` | `session.deleted` ✔ |
| `session.error` | ❌ → **`session.execution.failed`** |
| `session.compacted` | ❌ → **`session.compaction.ended`** |

---

## 6. Change plan — file by file

### 6.1 `package.json` + build

- `dependencies`: `@opencode-ai/plugin@1.15.10` → **`@opencode/plugin@2.1.3`** (aligned with the 2.1.3 binary).
- `exports`: kept `{".": "./dist/opencode-plugin.mjs", "./server": …}` ✔ (V2 accepts `.`/`./server`).
- `scripts/build-opencode-plugin.mjs`: unchanged (esbuild bundles `src/adapters/opencode/plugin.ts`).
  Verify that the bundle **no longer** contains residual imports from `@opencode-ai/plugin` (the `import type`
  declarations disappear, but `zod` remains necessary for schemas → in V2 we will use pure JSON Schema for tools).
- `types`: `dist/src/adapters/opencode/plugin.d.ts` → ok.

### 6.2 `src/adapters/opencode/plugin.ts` — main rewrite

New structure:

```ts
import { Plugin } from "@opencode/plugin";
export default Plugin.define({
  id: "crewbee",
  async setup(ctx) {
    // 1. auto-repair config file (ctx.location.directory instead of ctx.worktree)
    // 2. load + validate TeamLibrary
    // 3. bootstrap (availableModels from ctx.model.list())
    // 4. ctx.agent.transform(...)  → project agents + default agent
    // 5. ctx.tool.transform(...)   → register task/subagent + delegate_status + delegate_cancel
    // 6. ctx.session.hook("prompt") → session binding
    // 7. ctx.session.hook("context")→ runtime context in the system prompt
    // 8. ctx.session.hook("compaction") → continuity
    // 9. ctx.tool.hook("execute.before"/"execute.after") → alias/result
    // 10. ctx.event.subscribe() → background delegation completion
    return () => controller.abort();   // cleanup
  },
});
```

Decision: **a single V2 entrypoint file** + a **legacy V1 adapter** (`plugin.v1.ts`) that
exports the current implementation, so OpenCode 1.x compatibility can be kept in the same
package (dual shape: V2 `default` + V1 `server`, as suggested by the
"Support V1 and V2 from one package" guide). *To decide with the user: keep V1 or cut V1.*

### 6.3 `config-hook.ts` → `agent-transform.ts`

- Remove the `config` hook and the merge logic over `cfg.agent` (`config-merge.ts` remains only for
  collision/ownership logic, no longer for mutating the config).
- New: `ctx.agent.transform((editor) => { for (const agent of projected) editor.add(toV2Agent(agent)); editor.default(defaultKey) })`.
- `editor.update(id, ...)` to update already-present agents (idempotency on reload).
- **Attention**: transforms are replayable and synchronous → load the data (model registry, Team library)
  **before** registering and capture it in the closure; to reload: `ctx.agent.reload()`.

### 6.4 `projection.ts` — V2 agent format

- `createOpenCodeAgentDefinition()` → new `createV2AgentDefinition(agent)` producing:
  `{ id, name, description, mode, hidden, model, system, permissions, color?, steps? }`.
- `prompt` → `system` (same text produced by `createOpenCodeAgentPrompt`).
- `model`: string `"provider/model#variant"` (same content as today).
- Ownership marker: V2 `Agent.Info` has no `options` ⇒ use the `request.body` field? no.
  → use a free field not allowed by the schema ⇒ **decide**: keep the marker in an in-memory
  `Map` in the plugin (ownership = "agent created by CrewBee" can be deduced from the `coding-*`
  prefix / from the fact that it was registered by this plugin) and use `ctx.agent.list()` for the check.

### 6.5 `permission-mapper.ts` — V1 → V2 mapping

Mechanical conversion:
- `{edit: {allow:["*.ts"], deny:[".env"]}}` → `[{action:"edit", resource:"*.ts", effect:"allow"}, {action:"edit", resource:".env", effect:"deny"}]`
- `{bash:"ask"}` → `[{action:"shell", resource:"*", effect:"ask"}]`
- V1 action-only (`doom_loop`, `question`, `todowrite`, `webfetch`, `websearch`) → V2 actions
  (`doom_loop`, `question`, `webfetch`, `websearch`; `todowrite` does not exist in V2 → map to `skill`? no: **drop it**).
- `task` (V1) → **`subagent`** (V2), with `resource` = the allowed CrewBee member agent id.
- `write/patch/multiedit` → `edit`; `lsp_diagnostics` → n/a in V2 (remove); `delegate_task` → `subagent`.

### 6.6 `tool-hooks.ts` + `delegation/tools.ts` — heart of the port

- V2 tool definition: `input` as **JSON Schema** (no zod).
- Tool name: register **`subagent`** (overriding the V2 builtin) while also keeping
  `task` as a deprecated alias, or **only** `task`? *To decide*: I recommend `subagent`
  (consistent with the V2 native tool), accepting both `agent` **and** `subagent_type` as parameters.
- `execute.before`: rewrite `event.input.subagent_type`/`event.input.agent` (V2 `input` is mutable).
- `execute.after`: the result is a `Tool.Result`; normalize `result.content` (string) and `result.metadata`.
- `ctx.metadata({title})` → `context.progress({...})` and `result.metadata`.
- `ctx.abort` → `context.signal`.
- **Delegation semantics** (V1 → V2):
  - foreground: `session.create({parentID,title})` → `session.switchAgent({sessionID, agent: configKey})`
    → `session.switchModel({sessionID, model})` → `session.prompt({sessionID, text: envelope})`
    → `session.wait({sessionID})` → `session.context({sessionID})` to extract the assistant text.
  - background: same thing **without** `wait` (V2 `prompt` admits and returns) + state tracking
    via `session.idle` / `session.execution.failed` events.
  - `session.abort` → `session.interrupt({sessionID, resume:false})`.
  - text extraction: adapt `delegation/output.ts` to the new `SessionMessageInfo` format
    (`type:"assistant"`, `content:[{type:"text",text}]`); the anchor (message index) must be recomputed
    because the message count changes shape.
  - "model not found" fallback handling: in V2 the error arrives as `SessionError` /
    exception from the prompt → same pattern (retry without `model`).

### 6.7 `chat-message-hook.ts` → `prompt` hook

- V1 received `{sessionID, agent, model}`; the V2 `prompt` hook gives `{sessionID, messageID, prompt, delivery}`.
- **The problem**: the `prompt` hook does not expose the selected agent nor the model ⇒
  the agent must be read from `ctx.session.get({sessionID})` (the session has `agent` and `model`).
  Verify during implementation whether `Session.Info` exposes `agent` (V2 yes: `agent` and `model` in `SessionInfo`).
- More reliable alternative: use the `session.agent.selected` (V2) event for the binding, and
  `ctx.session.hook("prompt")` only as a fallback ⇒ **recommended**.

### 6.8 `system-transform-hook.ts` → `context` hook

- `output.system.push(string)` → `event.system.push({type:"text", text: string})`.
- Apply only to the "primary" flow (the `context` hook runs for the agent loop; for compaction/title
  use separate hooks) — verify `event.kind`/`agent` to avoid polluting auxiliary requests.

### 6.9 `compaction-hook.ts` → `compaction` hook

- `output.context.push(...)` does not exist in V2 → `event.system.push({type:"text", text: continuityContext})`.
- `captureTodoSnapshot` uses `client.session.todo` (nonexistent in V2) → **degrade** (§7.4).

### 6.10 `event-hook.ts` → `ctx.event.subscribe()`

- Replace V1 event names with V2 ones (§5.7).
- `session.error` → `session.execution.failed`; `session.compacted` → `session.compaction.ended`.
- Payload: V2 events have `{type, data}` (not `properties`) → adapt `resolveSessionID`.
- Loop `for await (const event of ctx.event.subscribe({types:[...], signal}))` with an `AbortController`
  aborted in the cleanup returned by `setup`.

### 6.11 `logging.ts`

- `ctx.client.app.log({body})` does not exist in V2 → `console.log`/`console.warn` with a `[crewbee]` prefix.
  Verify that the output ends up in `~/.local/share/opencode/log/opencode.log` (the server captures
  plugin stdout/stderr in-process) → **mandatory empirical verification**.

### 6.12 `model-availability.ts`

- `client.config.providers()` → `ctx.provider.list()` and/or `ctx.model.list()`.
  In V2 `Provider.Info` has `models` as a **Map** (not an object) → adapt the extraction of
  `providerID/modelID` (attention: `Model.Info.id` vs `modelID`).

### 6.13 `delegation/continuity.ts`

- `captureTodoSnapshot` → no todo API in V2 ⇒ empty snapshot + note.
  Alternative: read the `todowrite` tool state from the session transcript
  (`ctx.session.context({sessionID})` → messages with `todowrite` tool parts) — implementable
  if the transcript retains the tool input (verify).

### 6.14 `update/refresh.ts`

- Uses `ctx` only for logging ⇒ adapt the signature to V2 `Context` or accept an injected logger.
- The rest (npm registry, lock, state file) is host-independent ✔.

### 6.15 `install/opencode-config-file.ts` — config key

- Writes `config.plugin = [...]` (**V1** key). In V2 the key is **`plugins`**.
- Handle the migration: read `plugin` (legacy, still accepted by the V2 schema as a deprecated
  field) and `plugins`; write into `plugins`; keep `plugin` intact if it contains other plugins.
- `removeCrewBeePluginEntries` must clean both keys.
- Entry format: V2 accepts `"crewbee"`, `"crewbee@1.2.3"`, `"@scope/pkg"`, absolute paths and `file://`.
  → for the local fork use an **absolute path** to the installed package
  (e.g. `"plugins": ["/Users/…/Projects/crewbee-v2"]`) or publish to npm.

### 6.16 `install/doctor.ts` + `uninstall.ts`

- `findCrewBeePluginEntries` must read `plugins` (and legacy `plugin`).
- Add to the doctor a check of the **OpenCode version** (`opencode --version` → major 2 ⇒
  V2 plugin) and of the loaded **SDK version**.

### 6.17 `src/runtime/registries/plugin-tools.ts`

- The tools CrewBee registers are `task`/`delegate_status`/`delegate_cancel` ⇒ in V2 the first becomes
  `subagent` (`task` accepted as alias). Update the registry and tests.

### 6.18 Existing tests to update

`tests/opencode/*` and `tests/install/*` assume the V1 contract (`cfg.agent` shapes, `permission` map,
`tool.execute.before(input, output)`, `chat.message`). List:

- `tests/opencode/agent-ordering.test.mjs` — agent shape: adapt to V2 expectations.
- `tests/opencode/delegate-task.test.mjs` — `createDelegateTools` with a fake V1 client → adapt.
- `tests/opencode/plugin-task-alias.test.mjs` — `subagent_type` alias → new format.
- `tests/opencode/model-availability.test.mjs` — `client.config.providers()` → `ctx.model.list()`.
- `tests/opencode/partial-team-load.test.mjs`
- `tests/install/plugin-entry.test.mjs` — `plugin` key → `plugins`.
- `tests/install/config-writer.test.mjs`, `doctor.test.mjs`, `install-user.test.mjs`, `uninstall.test.mjs`.

New tests to add:
- `tests/opencode/v2-agent-transform.test.mjs` — `Plugin.define` + `setup` with a fake ctx ⇒ verify
  that `ctx.agent.transform` is called with the correct V2 definitions.
- `tests/opencode/v2-tool-registration.test.mjs` — verify `editor.add` with JSON Schema and `execute`.
- `tests/opencode/v2-hook-mapping.test.mjs` — hook mapping (prompt/context/compaction/tool).

---

## 7. Design decisions (points that do not map 1:1)

### 7.1 Delegation tool: `task` vs `subagent`
V2 calls the native tool `subagent` with permission action `subagent`. CrewBee redefines its
behavior (delegation to Team members). **Proposal**: register `subagent` (overriding the
builtin) accepting `agent` | `subagent_type`, `description`, `prompt`, `background`, `task_id`;
keep `task` as a secondary alias for compatibility with existing prompts.
*Alternative*: do not override the builtin and delegate to the native `subagent`, but CrewBee's
control over alias/permissions/nesting would be lost.

### 7.2 Session → agent binding
In V1 `chat.message` provided `agent` and `model`. In V2 the `prompt` hook does not.
**Proposal**: listen to the `session.agent.selected` (+ `session.model.selected`) event for the
binding, and use `ctx.session.get({sessionID})` as a fallback.

### 7.3 Waiting for the delegated result
V1 `session.prompt` was blocking (waited for the reply). In V2 `prompt` admits and returns immediately.
**Proposal**: foreground = `prompt` + `session.wait({sessionID})`; background = `prompt` without wait.

### 7.4 Todo snapshot in compaction
No todo API in V2. **Proposal**: empty snapshot with an explicit note in the continuity context;
optionally derive the todos from the transcript (`todowrite` tool parts).

### 7.5 Temperature / top_p per agent
In V2 `request.body` **is not yet sent** with model requests (2.1.3, official warning).
**Proposal**: do not set per-agent `temperature`; if essential, use the hook
`ctx.session.hook("context", e => e.options.temperature = ...)` filtered by `event.agent`.

### 7.6 Agent ownership marker
V2 `Agent.Info` has no `options.crewbee`. **Proposal**: keep an in-memory `Set<string>` with the
configKeys projected by CrewBee and use `ctx.agent.list()` for the "do not mutate other people's agents" check.

### 7.7 Tool availability (`tools` map)
V2 has no per-agent `tools`. **Proposal**: translate `requestedTools` into permission rules
(`deny` on the corresponding action) + a prompt listing the allowed tools.

### 7.8 V1 compatibility
Keep the V1 implementation in the same package (`default` = V2, `server` = V1) so OpenCode 1.x
users are not broken, or release V2 only (simpler, but breaks the 1.x line).
*To decide with the user.*

---

## 8. Installation strategy in V2

V2 installs npm plugins in `~/.cache/opencode/npm/<pkg>@<ver>/<ts>/node_modules/<pkg>` and
enables them with the `plugins` key in the global config.

Options for the fork:
1. **Local path** (immediate, no publish): `"plugins": ["/Users/alessandro.muzzi/Projects/crewbee-v2"]`
   in `~/.config/opencode/opencode.json`. V2 accepts local directories with `package.json` + `exports`.
2. **Private npm / personal registry** (`npm login` + publish under your own scope): the cleanest path
   for distribution; requires `npm publish` and a name like `crewbee-v2`.
3. **Local tarball** installed into `~/.cache/opencode/npm/…` by hand: fragile.

*To decide with the user.* For development → option 1; for real use → option 2.

---

## 9. Test plan

1. **Unit** — `npm test` (the repo uses `node --test`; `build` requires `tsc`): extend the existing tests
   to the new V2 modules.
2. **Typecheck** — `npm run typecheck` with `@opencode/plugin@2.1.3`.
3. **Simulator** — `npm run simulate:opencode` and `simulate:compact`: adapt them (they simulate the V1 runtime).
4. **Real integration on opencode 2.1.3** (automated script in `scripts/`):
   - isolated `HOME` + `opencode service set port <port>` (avoids conflicts with the real service)
   - `opencode plugin add <path>` / config with `plugins`
   - `opencode plugin list` → must show **active**
   - `opencode debug agents` → CrewBee agents (`coding-*`) must appear
   - `opencode debug config` → `plugins` key present
   - server log: no `failed to load plugin`; presence of `[crewbee]` logs
   - functional test: start a session, `task` a Team member, verify the result and the
     `delegate_status` state.
5. **V1 non-regression** (if compatibility is kept): same test with `opencode-ai@1.19.4`.

---

## 10. Fork & release strategy

- Upstream: `https://github.com/CrewBeeLab/CrewBee` (MIT).
- Personal fork: created on the user's GitHub account (no `gh` CLI was present at the time nor
  a valid personal GitHub SSH key: `ssh -T git@github.com` → *Permission denied*).
  → required `gh auth login` or a PAT, or a fork created manually in the browser.
- Recommended workflow: branch `feat/opencode-v2-port` on the fork → PR towards upstream (or keep
  private if preferred).
- Versioning: `0.2.0-v2.0.0` or `1.0.0`? Proposal: **0.2.0** with the `plugins` key and V2 support,
  deprecating V1.

---

## 11. Ordered checklist (to follow)

- [ ] **F1** — Preparation: GitHub fork (credentials), working copy `~/Projects/crewbee-v2`, branch `feat/opencode-v2-port` ✔ (done)
- [ ] **F2** — Update `package.json`: `@opencode/plugin@2.1.3`, remove `@opencode-ai/plugin`; align `exports`
- [ ] **F3** — New `src/adapters/opencode/plugin-v2.ts` with `Plugin.define({id:"crewbee", setup})`
- [ ] **F4** — `agent-transform.ts`: `ctx.agent.transform` + `editor.default` (replaces `config-hook.ts`)
- [ ] **F5** — `projection.ts`: new V2 agent formatter (`system`, `permissions`, `model`, `disabled`)
- [ ] **F6** — `permission-mapper.ts`: map V1 → V2 `permissions` array (`task` → `subagent`)
- [ ] **F7** — `delegation/tools.ts`: V2 tools (`subagent`/`task` + `delegate_status` + `delegate_cancel`), JSON Schema, `result.content`
- [ ] **F8** — `tool-hooks.ts`: `execute.before` (mutable input) / `execute.after` (`Tool.Result`)
- [ ] **F9** — `chat-message-hook.ts` → binding via `session.agent.selected` + `session.get` fallback
- [ ] **F10** — `system-transform-hook.ts` → `ctx.session.hook("context")` with `SystemPart`
- [ ] **F11** — `compaction-hook.ts` → `ctx.session.hook("compaction")` + todo degradation
- [ ] **F12** — `event-hook.ts` → `ctx.event.subscribe()` + V2 event renames
- [ ] **F13** — `logging.ts` → console with `[crewbee]` prefix; verify flush into the server log
- [ ] **F14** — `model-availability.ts` → `ctx.model.list()` / `ctx.provider.list()`
- [ ] **F15** — `update/refresh.ts` → V2 `Context` signature
- [ ] **F16** — `install/opencode-config-file.ts` → `plugins` key + migration from `plugin`
- [ ] **F17** — `install/doctor.ts` / `uninstall.ts` → new key + OpenCode version check
- [ ] **F18** — Update `src/runtime/registries/plugin-tools.ts` (task → subagent)
- [ ] **F19** — Update existing tests + add V2 tests
- [ ] **F20** — Update simulators (`simulators/opencode-*.mjs`) to the V2 runtime
- [ ] **F21** — `npm run typecheck && npm test && npm run build`
- [ ] **F22** — End-to-end verification script on real opencode 2.1.3 (isolated HOME, dedicated port)
- [ ] **F23** — Documentation: `docs/guide/installation.md` (V2), README, `docs/developer/release.md`
- [ ] **F24** — Publish (npm) or local setup with path; verify `opencode plugin list` → active

---

## 12. Risks and rollback

| Risk | Impact | Mitigation |
|---|---|---|
| `subagent` tool not overridable | CrewBee delegation unusable | verify in F7 with a real test; otherwise do not override and use the native `subagent` |
| Non-blocking `prompt` in V2 | foreground delegation returns immediately | `session.wait({sessionID})` |
| `temperature` not applicable | less deterministic agents | use the `context` hook (`options.temperature`) |
| Ownership marker lost | overwriting other people's agents | in-memory `Set` + `editor.list()` |
| `todowrite` tool absent in V2 | poorer continuity context | empty snapshot + note; optional transcript parsing |
| Divergence from upstream | merge difficulty | atomic commits per area, changelog in the PR |
| Rollback | — | the fork does not touch `main`; uninstall = remove the entry from `plugins` + `opencode plugin remove` |

---

## 13. Open questions (to decide before F2)

1. **GitHub fork**: create the fork on the user's account? Which username? Requires `gh auth login`
   (interactive) or a PAT, or the fork is created manually and I push to the remote?
2. **V1 support**: keep the dual implementation (V1 + V2) in the same package, or cut V1?
   (Recommendation: keep V1 for a few releases, with `default` = V2 and `server` = V1.)
3. **Package name**: `crewbee` (local fork) or `crewbee-v2` / `@scope/crewbee`?
4. **Distribution**: publish to npm (public or private scope) vs local path only?
5. **Tool**: override the builtin `subagent` (recommended) or register only `task` as a new tool?
6. **Per-agent temperature**: give up (recommended, given the V2 warning) or implement via the `context` hook?

---

## Implementation result (port completed)

- **Local branch**: `feat/opencode-v2-port` (committed on explicit user request only).
- **Build**: `npm run build` OK; bundle `dist/opencode-plugin.mjs` 1.9MB, only Node builtins as external dependencies.
- **Tests**: `npm test` → 107/107 pass.
- **Empirical verification on OpenCode 2.1.3** (isolated HOME): the plugin loads, `ctx.agent.transform`
  projects the 8 CrewBee agents (primary leader visible, host agents `build/plan/general/explore`
  hidden+demoted to subagent), `ctx.tool.transform` registers `subagent` (builtin override) +
  `task` (alias) + `delegate_status` + `delegate_cancel`, `ctx.session.hook("prompt"/"context"/"compaction")`
  registered, `event.subscribe` manually filtered.
- **Local install (dev)**: use the form `{ "package": "file:/Users/alessandro.muzzi/Projects/crewbee-v2" }`
  in the `plugins` array of `~/.config/opencode/opencode.json`. The loader installs the package into
  `~/.cache/opencode/npm/file:/...` and resolves the `dist/opencode-plugin.mjs` entrypoint.
- **Production install (after the fork)**: `opencode plugin add github:<user>/crewbee-v2` (Git package specifier).
- **Dependencies**: `@opencode/plugin@2.1.3` and `@opencode-ai/plugin@1.15.10` as devDeps (types only);
  `zod@^4.1.8` + `yaml` as runtime deps.
