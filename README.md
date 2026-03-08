# AgentScroll

AgentScroll is a portable Agent Team system for OpenCode, Codex, ClaudeCode, and other Agent-driven hosts.

## V1 positioning

AgentScroll V1 is built around a simplified model:

- `Agent Team` is the primary user-facing object.
- Each Team includes its own Leader, members, and default workflow.
- Users choose `Team + Mode`, not `Scene + Team + Playbook`.
- `Manager` handles Team selection, configuration, and basic runtime visibility.
- `Adapter` maps Team definitions into specific host runtimes.

This repository is an implementation-oriented V1 framework baseline for that direction, not a finished runtime implementation.

## What this repository contains

- `src/core`: shared contracts and Team-oriented spec definitions.
- `src/AgentTeams`: Team library assembly and loading; keeps the embedded `CodingTeam` plus file-loaded public teams.
- `src/adapters`: host integration module directory.
- `src/manager`: management and observability module directory.
- `AgentTeams`: file-based definitions for configurable teams such as `GeneralTeam` and `WukongTeam`.
- `AgentTeamTemplate`: reusable Agent Team template aligned to the V1 manifest/policy/agent-profile model.
- `docs`: architecture and planning notes.
- `.agent`: compact execution and project context docs for agent sessions.

## Initial scope

The framework now includes:

- typed Team manifests, policies, shared capabilities, and agent profiles in `src/`
- an embedded default `CodingTeam` in `src/AgentTeams`
- file-based Team definitions for `GeneralTeam` and `WukongTeam` under `AgentTeams`
- concrete agent profile assets under `AgentTeams/*/agents/*.agent.md`
- a reusable Team template under `AgentTeamTemplate`
- `.agent` planning and prompt docs that are ready for the next implementation cycle

It still stops short of full host adapters, runtime orchestration, automatic routing, and end-to-end execution behavior.

## Quick start

```bash
npm install
npm run typecheck
```
