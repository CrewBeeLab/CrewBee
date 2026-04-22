# CrewBee

[English](README.md) | [简体中文](README.zh-CN.md)

<p align="center">
  <img src="assets/crewbee-intro.png" alt="Turn scattered agents into real teams" width="100%" />
</p>

<p align="center"><strong>Team-first agent engineering for real host runtimes.</strong></p>

CrewBee is a **Team-first** Agent Team framework.

It provides a Team-oriented way to define, project, and adapt agent systems to host runtimes, turning scattered prompts, rules, and collaboration conventions into maintainable, portable, and runnable Team assets.

**Current focus:** make Team-based agent systems portable, composable, and actually runnable inside OpenCode.

## Why CrewBee

- **Team-first, not prompt-first** — model leaders, members, workflow, and policy as durable engineering assets.
- **Host-agnostic core** — keep Team definitions independent from any single runtime.
- **Projection-based runtime model** — map one Team definition into a concrete host safely and repeatably.
- **OpenCode-ready today** — includes the full plugin, agent projection, install, doctor, and release path.

The current version already delivers a complete **CrewBee → OpenCode** MVP path:

* host-agnostic Team / Agent definitions
* Team Library assembly and validation
* Runtime Projection with formal leader default entry selection
* OpenCode agent projection, aliases, config patching, and session binding
* OpenCode plugin entry, delegation tools, event wiring, and system prompt injection
* local build, user-level install, doctor checks, and uninstall flow

> In short:
>
> **CrewBee = Agent Team definition framework + Runtime Projection layer + host adapter layer (currently OpenCode)**

## Quick Links

- [Installation Guide](docs/guide/installation.md)
- [Release Guide](docs/guide/release.md)
- [Architecture](docs/architecture.md)

---

## Table of Contents

* [What CrewBee Is](#what-crewbee-is)
* [What Problems CrewBee Solves](#what-problems-crewbee-solves)
* [Core Features](#core-features)
* [Installation](#installation)
* [Quick Start](#quick-start)
* [Architecture at a Glance](#architecture-at-a-glance)
* [How Agent Teams and Agent Profiles Are Defined](#how-agent-teams-and-agent-profiles-are-defined)
* [How the OpenCode Runtime Works](#how-the-opencode-runtime-works)
* [Built-in Coding Team Design](#built-in-coding-team-design)
* [Configuration, Install, and Operations Scripts](#configuration-install-and-operations-scripts)
* [Uninstall](#uninstall)

---

## What CrewBee Is

In CrewBee, the real first-class object is not a single Agent, but a **Team**.
A Team is not just a collection of prompts; it is a structured definition unit that includes at least:

* Team identity and positioning
* formal leader
* members
* workflow
* Team shared rules
* Agent Profiles
* Prompt Projection
* host runtime mapping

CrewBee does not currently try to auto-select a Team for you, nor does it try to auto-decide the right organizational structure for every task.
At the current stage, the basic usage model is:

* the user selects a Team entry Agent in the host
* CrewBee projects the Team definition into the host runtime
* runtime semantics are maintained through session binding, delegation, and system prompt injection

---

## What Problems CrewBee Solves

CrewBee primarily solves three kinds of problems:

### 1. Turning scattered Agent practices into maintainable Team assets

Many Agent workflows still live in prompts, host configs, and informal conventions. That makes them hard to reuse, migrate, and maintain over time. CrewBee turns them into stable Team definitions.

### 2. Using different Teams for different task types instead of one prompt for everything

Coding, research, writing, analysis, and operational work do not share the same optimal working style. CrewBee’s core idea is to define different Teams for different scenarios instead of reusing one generic prompt stack everywhere.

### 3. Making execution style selectable and manageable

Many systems focus on whether agents can execute. CrewBee puts more emphasis on how they should execute: which entry point to use, when to involve support agents, and how to keep the execution path understandable and controllable.

---

## Core Features

### 1. Team-first static model

CrewBee treats Teams as first-class objects rather than isolated agent prompts.
That means:

* Teams have a formal leader
* Teams have policy
* Teams have members and workflow
* Teams have a host-agnostic structural model

### 2. Host-agnostic Runtime Projection

CrewBee first converts Team-first structures into a unified intermediate model, then maps that model into specific hosts.
This keeps Team / Agent definitions as host-agnostic as possible and makes long-term maintenance and future expansion easier.

### 3. OpenCode adapter and plugin runtime

CrewBee already supports the full path from Team / Agent definitions to runnable OpenCode agents, including:

* projected agent → OpenCode agent config
* Team / Agent prompt construction
* config patch generation
* host event integration
* delegation tool wiring

### 4. Prompts stay low-coupling while preserving execution semantics

CrewBee does not fall back to “one renderer per field”, nor does it dump every top-level block transparently.

Instead, it uses:

> **a small shared semantic skeleton + general structural handling + structured rendering**

For example, the Agent prompt skeleton is organized around execution thinking:

* Persona Core
* Responsibility Core
* Core Principle
* Scope Control
* Ambiguity Policy
* Support Triggers
* Collaboration
* Task Triage
* Delegation & Review
* Todo Discipline
* Completion Gate
* Failure Recovery
* Operations
* Output Contract
* Templates
* Guardrails
* Heuristics
* Anti Patterns
* Tool Skill Strategy

This helps the model quickly establish:

* who I am
* what I am responsible for
* how I normally act
* when to delegate / review / ask / stop
* what counts as done
* how to recover from failure

### 5. Collaboration produces directly usable delegation targets

Generated `Collaboration` output is not just a plain list of profile bindings. It combines:

* collaboration targets declared in Agent Profiles
* `members` descriptions from the Team Manifest
* projected ids that OpenCode can resolve

This lets the runtime surface delegation-ready agent entries.

### 6. Team Contract is compressed into an executable handbook

Instead of mechanically rendering the whole governance block, CrewBee compresses Team prompt output into:

* `Working Rules`
* `Approval & Safety`

This makes Team contracts much easier for models to consume.

### 7. User-level install and operations flow

CrewBee already includes a complete local build, user-level install, doctor, and uninstall flow, so it can be used as a stable OpenCode user-level plugin.

---

## Installation

### Shortest path for humans

If you are using an LLM Agent, just send it this:

```text
Please install CrewBee by following docs/guide/installation.md.
Use the OpenCode user-level installation flow only, not the old project-local flow.
```

Or read the guide yourself:

* [Installation Guide](docs/guide/installation.md)

### Shortest path for LLM Agents

Read and follow:

```text
docs/guide/installation.md
docs/guide/release.md
```

### One-click local install script for Windows

The repository already provides:

```bat
scripts\install-local-user.bat
```

It runs:

1. `npm install`
2. `npm run install:local:user`
3. `npm run doctor`

---

## Quick Start

### Development build

```bash
npm install
npm run typecheck
npm run build
```

### Local user-level install

Recommended from the repository root:

```bash
npm install
npm run install:local:user
```

This does four things:

1. builds CrewBee
2. packs a stable local tarball to `.artifacts/local/crewbee-local.tgz`
3. installs it into the OpenCode user-level package workspace at `~/.cache/opencode`
4. rewrites OpenCode config to the canonical plugin entry `crewbee`

### Published registry install

After `crewbee` is published to npm:

```bash
npm run install:registry:user
```

OpenCode config can also reference the plugin directly by package name:

```json
{
  "plugin": ["crewbee"]
}
```

### Verify installation

```bash
npm run doctor
npm run version
```

`npm run version` (or `crewbee version`) reads the package version directly from `package.json` for both the current package and the installed package copy.

### Use in OpenCode

After installation:

1. open any project
2. select a CrewBee projected agent (for example `[CodingTeam]leader`)
3. send requests normally

---

## Architecture at a Glance

```text
Team Definitions
  -> TeamLibrary
  -> TeamLibrary Projection
  -> OpenCode Bootstrap
  -> OpenCode Config Patch + Session Binding
  -> OpenCode Plugin Hooks

User-level install
  -> local tarball
  -> ~/.cache/opencode
  -> node_modules/crewbee
  -> canonical package-name entry (crewbee)
  -> OpenCode config
```

---

## How Agent Teams and Agent Profiles Are Defined

### Actual file-based Team structure

The real runnable file-based Team structure is currently:

```text
<ConfiguredTeamDir>/
  team.manifest.yaml
  team.policy.yaml
  <agent>.agent.md
  <agent>.agent.md
  TEAM.md            # optional
```

The current implementation uses a **flat sibling layout**; it does not require `agents/` or `docs/` subdirectories.

Which file-based Teams are loaded is now controlled by:

```text
~/.config/opencode/crewbee.json
```

Example:

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 },
    { "path": "@tmp/oh-my-opencode", "enabled": true, "priority": 1 }
  ]
}
```

Notes:

* built-in `coding-team` has no `path`
* file-based Teams use `path` to point at the folder that contains `team.manifest.yaml`
* `@...` paths are resolved relative to the OpenCode config root
* lower `priority` values rank earlier; the highest-priority Team's default leader becomes CrewBee's default OpenCode agent

### `team.manifest.yaml`

It defines:

* Team identity
* mission / scope
* formal leader
* members
* workflow
* agent runtime overrides
* tags

`members` is not just descriptive. It affects:

* Team structure validation
* Team runtime description
* Collaboration prompt output

That makes `members.<agent>.responsibility / delegate_when / delegate_mode` important fields rather than decorative metadata.

### `team.policy.yaml`

It defines:

* instruction precedence
* approval policy
* forbidden actions
* quality floor
* working rules

And it is eventually compressed into two Team Contract sections:

* `Working Rules`
* `Approval & Safety`

### `*.agent.md`

Each file defines the static image of a single Agent, including:

* what kind of worker the Agent is
* what the Agent is responsible for
* what the Agent’s boundaries are
* how the Agent collaborates by default
* which runtime tools and permissions the Agent needs
* how the Agent normally outputs results

CrewBee recommends expressing key execution semantics as top-level sections, such as:

* `persona_core`
* `responsibility_core`
* `core_principle`
* `scope_control`
* `ambiguity_policy`
* `support_triggers`
* `collaboration`
* `task_triage`
* `delegation_review`
* `todo_discipline`
* `completion_gate`
* `failure_recovery`
* `operations`
* `output_contract`
* `templates`
* `guardrails`
* `heuristics`
* `anti_patterns`
* `tool_skill_strategy`

### Current capability definition path

The main capability definition path today is:

* **Agent-level capability**: `runtime_config` inside `*.agent.md`
* **Team-level runtime override**: `agent_runtime` inside `team.manifest.yaml`
* **Host-available capability set**: adapter / host capability contract

### `TEAM.md`

`TEAM.md` is a human-facing Team document.
It helps explain:

* what the Team does
* who the Leader is
* what each member does
* what the default workflow is

But it is not the source of truth.
The real logic source remains:

* `team.manifest.yaml`
* `team.policy.yaml`
* `*.agent.md`

### Prompt Projection

Current supported shape:

```yaml
prompt_projection:
  include:
    - persona_core
    - responsibility_core.description
  exclude:
    - metadata.tags
  labels:
    delegation_review: Delegation & Review
```

Constraints:

* only `snake_case` paths are allowed
* `projection_schema` is not supported
* camelCase paths are not supported

---

## How the OpenCode Runtime Works

The current OpenCode plugin chain is roughly:

```text
package.json
  -> opencode-plugin.mjs
  -> dist/opencode-plugin.mjs
```

### What happens during plugin initialization

1. load the default Team Library
2. validate the Team Library
3. generate bootstrap results
4. build the alias index
5. initialize the session binding store
6. initialize the delegation state store

### Key hooks

#### `config`

Injects CrewBee projected agents into OpenCode config.

#### `chat.message`

Reads the currently selected agent and establishes CrewBee-side session binding.

#### `tool` / delegation tools

Registers:

* `delegate_task`
* `delegate_status`
* `delegate_cancel`

#### `tool.execute.before`

Rewrites `task.subagent_type` from aliases into projected config keys.

#### `experimental.chat.system.transform`

Injects minimal CrewBee runtime context into the system prompt:

* Team
* Entry Agent
* Active Owner
* Mode

---

## Built-in Coding Team Design

The most important methodological example in CrewBee right now is the built-in Coding Team.

Its core judgments include:

### 1. Leader is not the same as Planner, nor a pure Orchestrator

The Leader is the default entry, the main-path owner, and the final closure owner.
But the Leader is not assumed to be “coordination only”.

### 2. The role most worth separating is usually not Planner, but Reviewer

In coding work, planning, execution, and verification are tightly coupled loops.
What matters most is:

* context continuity
* end-to-end responsibility closure
* an independent quality perspective

So the more stable structure is usually:

* main execution owner
* research
* reviewer
* advisor when needed

rather than equal O / P / E splitting.

### 3. Simple tasks should not force heavy collaboration, and hard tasks should not default to heavy ceremony either

CrewBee’s position is:

* **simple tasks** should stay light
* **extremely hard problems** should keep context concentrated, iteration fast, and human guidance clear
* **complex but normal engineering work** is where structured Team collaboration is most useful

### 4. main execution owner + research + review is the more important current pattern

For coding tasks, CrewBee currently emphasizes:

* formal leader is not equal to pure manager
* the main execution owner can hold the main context for a long time
* research, review, and advisor roles are inserted only as needed
* reviewer remains independent from the main execution path

---

## Configuration, Install, and Operations Scripts

### Common scripts

```bash
npm run build
npm run typecheck
npm run test
npm run pack:local
npm run pack:release
npm run release:registry:dry-run
npm run install:local:user
npm run install:registry:user
npm run doctor
npm run uninstall:user
npm run simulate:opencode
npm run simulate:compact
```

### What they do

* `build`: build artifacts
* `typecheck`: run TypeScript type checks
* `test`: run tests
* `pack:local`: pack a local tarball
* `pack:release`: pack a versioned release tarball
* `release:registry:dry-run`: run the registry release preflight locally without publishing
* `install:local:user`: run the full user-level install
* `install:registry:user`: install the published npm package into the user-level workspace
* `doctor`: verify OpenCode config and install state
* `version`: show the current package version and installed package version
* `uninstall:user`: uninstall the user-level install
* `simulate:opencode`: run the local OpenCode runtime simulator
* `simulate:compact`: run the compact scenario verification simulator

### Default user-level workspace paths

```text
Config root:  ~/.config/opencode
Install root: ~/.cache/opencode
```

Canonical plugin entry:

```text
crewbee
```

Release handbook:

```text
docs/guide/release.md
```

On Windows, the default still prefers:

```text
~/.config/opencode
```

If an existing OpenCode configuration is already located at `%APPDATA%/opencode`, CrewBee falls back to that existing config location for compatibility.

---

## Uninstall

Recommended:

```bash
npm run uninstall:user
```

This will:

* remove the CrewBee plugin entry from OpenCode config
* remove the installed package from the user-level workspace

If you want to verify the uninstall state afterward, run:

```bash
npm run doctor
```
