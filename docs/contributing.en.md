# Development Conventions

Language: [中文](./contributing.md) | English

## Basic Workflow

1. Confirm that the change fits CrewBee's Team-first direction.
2. Keep changes focused and clearly scoped.
3. Run type checks or build verification after changes.
4. Keep documentation, contract models, and directory naming in sync to avoid framework drift.

## Principles

- Team-related rules should be explicit and versionable.
- Prefer small, composable contract structures over large monolithic interfaces.
- Keep `src/core` host-agnostic; do not hard-code OpenCode-specific behavior there prematurely.
- File-based Team templates live under `templates/teams/`. During installation they are copied into the OpenCode config root `teams/` directory and used as global Team sources. Runtime Team registrations come from both the global `crewbee.json` under the OpenCode config root and the project `.crewbee/crewbee.json` under the current worktree. Both sources must use the same loader / validator / projection / OpenCode config patch path; project sources gain priority only through higher source precedence.
- Documentation under `docs/` should have both Chinese and English versions for human understanding and project continuity.
