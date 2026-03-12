# CrewBee

CrewBee is a Team-first agent framework.
It defines agent teams in a host-agnostic way, then projects them into concrete host runtimes such as OpenCode.

The repository currently delivers a complete MVP path for OpenCode:

- host-agnostic Team and Agent contracts
- Team library loading from embedded code and `AgentTeams/`
- runtime projection and session binding
- OpenCode agent projection, config patch generation, and collision handling
- a real OpenCode plugin entry exported through `opencode-plugin.mjs`

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

- `src/runtime/team-library-projection.ts`: converts `TeamLibrary` into projected teams and projected agents for runtime use
- `src/runtime/types.ts`: projection and binding types shared by adapters

### 3. OpenCode adapter and plugin runtime

- `src/adapters/opencode/bootstrap.ts`: assembles OpenCode-facing projection results
- `src/adapters/opencode/projection.ts`: maps projected agents to OpenCode agent config objects
- `src/adapters/opencode/config-merge.ts`: safely merges CrewBee agents into host config
- `src/adapters/opencode/plugin.ts`: real OpenCode plugin runtime hooks
- `opencode-plugin.mjs`: published OpenCode plugin entry shim

## What Is Not Implemented Yet

CrewBee is intentionally narrower than a full multi-agent execution engine.

- no general multi-host runtime yet beyond OpenCode
- no full Team-collaboration execution loop in the host runtime
- no custom CrewBee plugin tools injected into OpenCode yet
- no standalone Manager product surface yet; `src/manager` is still an internal helper layer

## Architecture At A Glance

```text
Team definitions
  -> TeamLibrary
  -> TeamLibrary Projection
  -> OpenCode Bootstrap
  -> OpenCode Config Patch + Session Binding
  -> OpenCode Plugin Hooks
```

More detail:

1. `src/agent-teams/library.ts` loads the default Team library
2. `src/runtime/team-library-projection.ts` converts Team-first data into projected teams and projected agents
3. `src/adapters/opencode/bootstrap.ts` builds OpenCode-facing config patches and binding results
4. `src/adapters/opencode/plugin.ts` wires CrewBee into real OpenCode hooks
5. `opencode-plugin.mjs` exposes the plugin entry that OpenCode loads

## Repository Map

- `src/core`: host-agnostic contracts
- `src/agent-teams`: Team discovery, parsing, validation, embedded teams
- `src/runtime`: host-agnostic projection and session binding
- `src/adapters`: host adapter contracts and implementations
- `src/adapters/opencode`: current OpenCode adapter and plugin runtime
- `src/manager`: internal Team selection and runtime snapshot helpers
- `docs/architecture.md`: current architecture and implementation overview
- `docs/opencode-runtime-flow.md`: OpenCode plugin runtime flow, step by step

## Quick Start

```bash
npm install
npm run typecheck
npm run build
```

## OpenCode Plugin Entry

The package root currently targets the OpenCode path.

- `package.json` exports `./opencode-plugin.mjs`
- `opencode-plugin.mjs` re-exports the built plugin from `dist/src/adapters/opencode/plugin.js`

Example local OpenCode plugin reference:

```json
{
  "plugin": ["file:///absolute/path/to/CrewBee/opencode-plugin.mjs"]
}
```

## Recommended Reading Order

1. `README.md`
2. `docs/architecture.md`
3. `docs/opencode-runtime-flow.md`
4. `docs/internal/OpenCode适配设计.md` for the original adapter design rationale
