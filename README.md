# AgentScroll

AgentScroll is a portable Agent Team system for OpenCode, Codex, ClaudeCode, and other Agent-driven hosts.

## V1 positioning

AgentScroll V1 is built around a simplified model:

- `Agent Team` is the primary user-facing object.
- Each Team includes its own Leader, members, and default workflow.
- Users choose `Team + Mode`, not `Scene + Team + Playbook`.
- `Manager` handles Team selection, configuration, and basic runtime visibility.
- `Adapter` maps Team definitions into specific host runtimes.

This repository is a scaffold for that V1 direction, not a finished runtime implementation.

## What this repository contains

- `src/core`: shared contracts and Team-oriented spec definitions.
- `src/teams`: baseline Team library assets and Team-first exports.
- `src/adapters`: host integration module directory.
- `src/manager`: management and observability module directory.
- `scaffold/agent-team-starter`: file-based Team starter aligned to the V1 manifest/policy/agent-profile model.
- `docs`: architecture and planning notes.
- `.agent`: compact execution and project context docs for agent sessions.

## Initial scope

The scaffold now includes:

- typed Team manifests, policies, shared capabilities, and agent profiles in `src/`
- a baseline Team library for Coding, General, and Wukong teams
- a file-based starter scaffold under `scaffold/agent-team-starter`
- `.agent` planning and prompt docs that are ready for the next implementation cycle

It still stops short of full host adapters, runtime orchestration, automatic routing, and end-to-end execution behavior.

## Quick start

```bash
npm install
npm run typecheck
```
