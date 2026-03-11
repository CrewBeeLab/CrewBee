# CrewBee

CrewBee is a Team-first Agent System for choosing, running, and managing agent teams. This repository implements the OpenCode path today and keeps the framework portable to Codex, Claude Code, and similar agent-driven hosts.

Start with one. Bring the crew when it counts.

## Positioning

CrewBee is not about piling up more agents.
It turns agents into crews that can actually get work done.

- Team is the primary user-facing object.
- Users choose which Team to send and whether to run it in `single-executor` or `team-collaboration` mode.
- Every Team keeps a clear leader or active owner on the main execution path.
- The manager handles Team selection, configuration, and runtime visibility.
- The adapter projects Team definitions into specific host runtimes.

In short: one when you need focus, a crew when you need force.

## What this repository contains

- `src/core`: shared contracts for Team-first definitions and runtime bindings.
- `src/agent-teams`: Team library assembly and loading, including the embedded `CodingTeam` and file-loaded public teams.
- `src/adapters`: host integration modules.
- `src/manager`: Team selection and observability helpers.
- `AgentTeams`: file-based Team definitions such as `GeneralTeam` and `WukongTeam`.
- `AgentTeams/AgentTeamTemplate`: reusable Team template aligned to the current manifest-governance-agent-profile model.
- `docs`: architecture and planning notes.
- `.agent`: compact execution context for future agent sessions.

## Current scope

The framework currently includes:

- typed Team manifests, governance rules, and agent profiles in `src/`
- an embedded default `CodingTeam` in `src/agent-teams`
- file-based Team definitions for `GeneralTeam` and `WukongTeam` under `AgentTeams`
- concrete agent profile assets under `AgentTeams/*/agents/*.agent.md`
- a reusable Team template under `AgentTeams/AgentTeamTemplate`
- `.agent` planning and prompt docs for the next implementation cycle

It still stops short of full host adapters, runtime orchestration, automatic routing, and end-to-end execution behavior.

## Quick start

```bash
npm install
npm run typecheck
```
