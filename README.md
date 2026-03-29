# CrewBee

[English](README.md) | [简体中文](README.zh-CN.md)

CrewBee is a Team-first agent framework.
It defines agent teams in a host-agnostic way, then projects them into concrete host runtimes such as OpenCode.

Build the package locally. Install it into the OpenCode user-level workspace. Use CrewBee from any OpenCode project.

The repository currently delivers a complete MVP path for OpenCode:

- host-agnostic Team and Agent contracts
- Team library loading from embedded code and `AgentTeams/`
- runtime projection, formal-leader default selection, and session binding
- OpenCode agent projection, config patch generation, collision handling, and delegation tooling
- collaboration prompt enrichment from Team manifest members into runtime-usable projected agent ids
- a real OpenCode plugin entry exported through `opencode-plugin.mjs`
- a user-level installer that writes the canonical CrewBee plugin entry into OpenCode config

## Positioning

CrewBee is not a prompt pack and not a multi-agent runtime engine.
It is the layer that makes these questions explicit and portable:

- What is a Team?
- Which agent roles are user-selectable entry points?
- Which parts stay host-agnostic?
- How does a Team-first definition become a host-native agent entry?

Today, CrewBee implements that path for OpenCode while keeping the core model portable to Codex, Claude Code, and similar hosts.

## What Works Today

### 1. Team-first static model

- `src/core`: Team, Agent, governance, runtime, and host capability contracts
- `src/agent-teams`: Team library loading, parsing, validation, and embedded teams
- `AgentTeams/`: file-based public teams such as `GeneralTeam` and `WukongTeam`

### 2. Host-agnostic runtime projection

- `src/runtime/team-library-projection.ts`: converts `TeamLibrary` into projected teams and projected agents for runtime use, with formal-leader default selection and `selectionPriority`-aware ordering
- `src/runtime/types.ts`: projection and binding types shared by adapters

### 3. OpenCode adapter and plugin runtime

- `src/adapters/opencode/bootstrap.ts`: assembles OpenCode-facing projection results
- `src/adapters/opencode/projection.ts`: maps projected agents to OpenCode agent config objects
- `src/adapters/opencode/config-merge.ts`: safely merges CrewBee agents into host config
- `src/adapters/opencode/plugin.ts`: real OpenCode plugin runtime hooks, delegation tools, event handling, and compaction continuity integration
- `opencode-plugin.mjs`: published OpenCode plugin entry shim

### 4. User-level installation flow

- `src/install/install-root.ts`: resolves the OpenCode config root and CrewBee install root
- `src/install/workspace.ts`: bootstraps the user-level package workspace
- `src/install/package-manager.ts`: installs or removes CrewBee in the user-level workspace
- `src/install/plugin-entry.ts`: canonicalizes the installed plugin entry as `file://`
- `src/install/config-writer.ts`: migrates and rewrites OpenCode plugin config idempotently
- `src/install/doctor.ts`: verifies install state against the canonical user-level entry

## What Is Not Implemented Yet

CrewBee is intentionally narrower than a full multi-agent execution engine.

- no general multi-host runtime yet beyond OpenCode
- no host-agnostic Team-collaboration runtime yet beyond the current OpenCode delegation path
- no standalone Manager product surface yet; `src/manager` is still an internal helper layer
- no online registry install flow yet; `--source registry` is reserved only
- no standalone platform binaries yet; CLI remains JS package-first

## Selection And Ordering Semantics

CrewBee currently distinguishes between three related but different concepts:

- **formal leader**: declared by `team.manifest.leader.agentRef`; when that agent is user-selectable, it is the default entry for the team
- **entry-point priority**: optional `entryPoint.selectionPriority`; lower numbers rank earlier within the same role group during runtime projection
- **host-visible list order**: ultimately owned by the host runtime

For OpenCode specifically, CrewBee controls the projected agents, their default entry, and their visible names, but OpenCode still applies its own final list ordering rules. In practice, CrewBee can reliably set the default projected agent, while final non-default list order remains host-controlled.

## Architecture At A Glance

```text
Team definitions
  -> TeamLibrary
  -> TeamLibrary Projection
  -> OpenCode Bootstrap
  -> OpenCode Config Patch + Session Binding
  -> OpenCode Plugin Hooks

User-level install
  -> local tarball
  -> OpenCode user-level workspace
  -> canonical file:// plugin entry
  -> OpenCode config
```

More detail:

1. `src/agent-teams/library.ts` loads the default Team library
2. `src/runtime/team-library-projection.ts` converts Team-first data into projected teams and projected agents
3. `src/adapters/opencode/bootstrap.ts` builds OpenCode-facing config patches and binding results
4. `src/adapters/opencode/plugin.ts` wires CrewBee into real OpenCode hooks
5. `src/install/*` installs CrewBee into the OpenCode user-level workspace and rewrites config
6. `opencode-plugin.mjs` exposes the plugin entry that OpenCode loads

## Repository Map

- `src/core`: host-agnostic contracts
- `src/agent-teams`: Team discovery, parsing, validation, embedded teams
- `src/runtime`: host-agnostic projection and session binding
- `src/adapters`: host adapter contracts and implementations
- `src/adapters/opencode`: current OpenCode adapter and plugin runtime
- `src/install`: user-level install root, workspace, package manager, plugin entry, config writer, doctor
- `src/cli`: CLI command parsing and command adapters
- `src/manager`: internal Team selection and runtime snapshot helpers
- `docs/architecture.md`: current architecture and implementation overview
- `docs/opencode-runtime-flow.md`: OpenCode plugin runtime flow, step by step
- `docs/guide/installation.md`: user-level install and migration guide

## Installation

### For Humans

Copy this into your agent:

```text
Install CrewBee by following the instructions in docs/guide/installation.md.
Use the OpenCode user-level workspace flow, not the old project-local install flow.
```

Or read the [Installation Guide](docs/guide/installation.md) yourself.

### For LLM Agents

Read and follow:

```text
docs/guide/installation.md
```

## Quick Start

```bash
npm install
npm run typecheck
npm run build
```

## Scripts

```bash
npm run pack:local
npm run install:local:user
npm run doctor
npm run uninstall:user
```

## User-Level Local Install Flow

CrewBee now installs into an OpenCode user-level workspace instead of a business project's `node_modules`.

### Recommended path from the repo root

```bash
npm install
npm run install:local:user
```

That does the following:

1. builds CrewBee
2. packs a stable local tarball at `.artifacts/local/crewbee-local.tgz`
3. installs that tarball into the OpenCode user-level workspace
4. rewrites OpenCode config to point at the canonical user-level plugin entry

### Manual path

```bash
npm run pack:local
node ./bin/crewbee.js install --source local --local-tarball ./.artifacts/local/crewbee-local.tgz
```

## User-Level Workspace Layout

By default, CrewBee uses two user-level locations:

```text
Config root:  ~/.config/opencode
Install root: ~/.cache/opencode/crewbee
```

The install root becomes a minimal package workspace:

```text
~/.cache/opencode/crewbee/
  package.json
  package-lock.json
  node_modules/
    crewbee/
      opencode-plugin.mjs
      dist/
      bin/
```

OpenCode config is then updated to point at:

```text
file://<install-root>/node_modules/crewbee/opencode-plugin.mjs
```

## New vs Old Flow

### Old project-local flow

```text
pack tarball -> install into target project node_modules -> run npx crewbee install there
```

### Current user-level flow

```text
pack local tarball -> install into OpenCode user-level workspace -> update OpenCode config -> use CrewBee from any OpenCode project
```

## Migration From Project-Local Installs

If your OpenCode config still points at an old project-local CrewBee plugin entry such as:

```text
file:///some/project/node_modules/crewbee/opencode-plugin.mjs
```

running the new installer will automatically migrate that entry to the canonical user-level workspace entry.

Use:

```bash
npm run doctor
```

to verify that the configured plugin entry matches the installed user-level path.

## OpenCode Plugin Entry

The package root currently targets the OpenCode path.

- `package.json` exports `./opencode-plugin.mjs`
- `opencode-plugin.mjs` re-exports the built plugin from `dist/src/adapters/opencode/plugin.js`

## Future Online Install

CrewBee already reserves the install source surface for future online publish and remote package installation.

- Current: `crewbee install --source local`
- Reserved: `crewbee install --source registry`

The registry flow is intentionally not implemented yet. This repository remains local-package-first for now.

## Recommended Reading Order

1. `README.md`
2. `docs/guide/installation.md`
3. `docs/architecture.md`
4. `docs/opencode-runtime-flow.md`
5. `docs/internal/OpenCode适配设计.md` for the original adapter design rationale
