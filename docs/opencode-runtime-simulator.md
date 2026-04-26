# OpenCode Runtime Simulator

Language: English | [中文](./opencode-runtime-simulator.zh-CN.md)

## 1. Purpose

This simulator exists only for local testing and understanding.

It is used to emulate the current OpenCode runtime path of CrewBee:

- plugin module loading
- plugin initialization
- config hook execution
- message-stage session binding
- system prompt transform injection

It is not part of the production runtime and is not included in published package files.

Important: the simulator records only the OpenCode-visible side of the run.
It does not expose CrewBee-internal structures such as projected TeamLibrary data or bootstrap internals.

---

## 2. File Location

- simulator entry: `simulators/opencode-runtime.mjs`
- npm script: `npm run simulate:opencode`
- one-click batch script: `simulators/run-opencode-runtime.bat`

The simulator is outside `src/`, so it does not participate in TypeScript build output.

The published package still only includes project runtime files from:

- `dist/`
- `opencode-plugin.mjs`

The simulator is not in `src/` and not in the `files` allowlist, so it is excluded from published artifacts.

---

## 3. What It Simulates

The simulator follows the current implementation boundary, not the full OpenCode product.

It simulates:

1. loading `opencode-plugin.mjs`
2. enumerating exported plugin functions similar to OpenCode plugin loading
3. initializing plugin hooks with a mocked plugin input
4. running the `config` hook against a local config object
5. choosing an agent for the session
6. running `chat.message`
7. running `experimental.chat.system.transform`
8. printing the resulting config, binding, logs, and injected system lines

It behaves from the host side only:

- load plugin exports
- initialize hooks
- pass an OpenCode-like config object to the `config` hook
- pass an OpenCode-like message event to `chat.message`
- pass an OpenCode-like system transform event to `experimental.chat.system.transform`

---

## 4. What It Does Not Simulate

It does not simulate:

- the full OpenCode event bus
- tool execution hooks
- real LLM requests
- session persistence
- a full host runloop beyond the currently implemented CrewBee hooks

This is intentional. The goal is to test and understand CrewBee's current implementation surface, not to rebuild OpenCode.

---

## 5. Usage

Basic run:

```bash
npm run simulate:opencode
```

The command performs a fresh build first, then runs the simulator against the current compiled output.

Each run writes artifacts to a timestamped directory:

```text
simulators/runs/<timestamp>/
```

If the same timestamp directory already exists, the simulator automatically appends a numeric suffix.

Select a specific agent:

```bash
npm run simulate:opencode -- --agent coding-leader
```

Print JSON instead of human-readable text:

```bash
npm run simulate:opencode -- --json
```

Use a different worktree root:

```bash
npm run simulate:opencode -- --worktree E:/path/to/worktree
```

Use a custom output root:

```bash
npm run simulate:opencode -- --outdir E:/tmp/crewbee-sim-runs
```

Windows one-click run:

```bat
simulators\run-opencode-runtime.bat
```

---

## 6. Output Structure

Each run writes these files:

- `plugin-load.json`: which plugin exports were loaded and which hooks each export returned
- `config.before.json`: the host config before plugin mutation
- `config.after.json`: the host config after plugin mutation
- `agents/index.json`: index of per-agent output directories
- `agents/<agent-key>/agent.json`: one OpenCode-visible agent config per agent, with prompt extracted out
- `agents/<agent-key>/prompt.md`: the original prompt text with headings and line breaks preserved
- `chat.message.input.json`: the simulated message hook input
- `chat.message.output.json`: the resulting message hook output object
- `system.input.json`: the simulated system transform input
- `system.output.json`: the resulting system output seen by OpenCode
- `logs.json`: plugin logs emitted through `client.app.log`
- `summary.json`: compact host-side summary
- `summary.txt`: human-readable summary

This makes it useful for both:

- testing whether the current implementation behaves as expected from the host side
- understanding how OpenCode sees plugin loading, config injection, and runloop-stage effects
