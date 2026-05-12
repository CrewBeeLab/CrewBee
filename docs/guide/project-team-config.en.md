# CrewBee Project-Level Team Configuration

Language: [中文](./project-team-config.md) | English

Audience: **users and Team authors** configuring global and project-level Teams. Repository release and CI/CD workflows are covered in the [Release And CI/CD Guide](../developer/release.md).

> Status: implemented and published in `crewbee@0.1.9`. This document describes the current project/global Team configuration model and the architectural constraints that keep both sources on the same assembly path.

## 1. Design conclusion

The P0 goal is to let CrewBee support both **global Teams** and **project Teams**, with project Teams naturally taking priority in the current worktree.

This design does **not** introduce a second project-specific Team system.

> **Project Teams and global Teams are the same kind of Team registration at the framework level.**

They differ only by configuration source metadata:

| Dimension | Global Team | Project Team |
| --- | --- | --- |
| Config file | `crewbee.json` under the OpenCode config root | `.crewbee/crewbee.json` under the project worktree |
| Path base | OpenCode config root | project `.crewbee` directory |
| Scope semantic | `global` | `project` |
| Source precedence | lower than project | higher than global |
| `teams` schema | same | same |
| Team directory structure | same | same |
| Assembly logic | same | same |
| Assembly timing | same | same |

Core rule:

> During OpenCode bootstrap / config, CrewBee collects all `crewbee.json` sources, normalizes their `teams` entries into the same Team Registration model, and then uses one shared Team discovery, parsing, validation, assembly, projection, and default Agent selection pipeline. Project config is not a new flow; it is a higher-precedence source.

---

## 2. Relationship to the template configuration model

CrewBee already ships template configuration assets:

```text
templates/
  crewbee.json
  teams/
    general-team/
    template-team/
    wukong-team/
```

During installation these are copied into the OpenCode config root:

```text
<OpenCodeConfigRoot>/
  crewbee.json
  teams/
    general-team/
    template-team/
    wukong-team/
```

This project-level config design builds on that model:

1. Global config continues to use `<OpenCodeConfigRoot>/crewbee.json`.
2. Project config is added at `<worktree>/.crewbee/crewbee.json`.
3. Both use the same `teams` schema.
4. `@teams/...` means: remove `@`, then resolve relative to the directory containing the current `crewbee.json`.

Examples:

```text
global  @teams/general-team
  -> <OpenCodeConfigRoot>/teams/general-team

project @teams/project-coding-team
  -> <worktree>/.crewbee/teams/project-coding-team
```

Project-level Team support does not require a new directory layout, template format, loader, validator, projection, or prompt builder.

---

## 3. Config file locations

### 3.1 Global config

Global config lives under the OpenCode config root:

```text
~/.config/opencode/crewbee.json
```

Windows commonly uses:

```text
C:\Users\<your-user>\.config\opencode\crewbee.json
```

Example:

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/general-team", "enabled": false, "priority": 1 }
  ]
}
```

### 3.2 Project config

Project config lives under the current OpenCode worktree:

```text
<project-worktree>/.crewbee/crewbee.json
```

Example:

```json
{
  "teams": [
    { "path": "@teams/project-coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/project-research-team", "enabled": true, "priority": 1 }
  ]
}
```

Directory:

```text
<project-worktree>/
  .crewbee/
    crewbee.json
    teams/
      project-coding-team/
        team.manifest.yaml
        team.policy.yaml
        project-leader.agent.md
        project-executor.agent.md
        project-reviewer.agent.md
        TEAM.md
```

---

## 4. Team directory structure stays the same

Both global and project file-based Teams are ordinary Team directories:

```text
ProjectCodingTeam/
  team.manifest.yaml
  team.policy.yaml
  project-leader.agent.md
  project-executor.agent.md
  project-reviewer.agent.md
  TEAM.md
```

Required:

- `team.manifest.yaml`
- `team.policy.yaml`
- at least one `*.agent.md`

Optional:

- `TEAM.md`
- `README.md`

Constraint:

> `*.agent.md` files must be in the same directory as `team.manifest.yaml` and `team.policy.yaml`. P0 does not scan `agents/` or `docs/` subdirectories.

---

## 5. `crewbee.json` schema is shared

Global `crewbee.json` and project `.crewbee/crewbee.json` use the same schema.

Minimal shape:

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/ResearchOpsTeam", "enabled": true, "priority": 1 }
  ]
}
```

Team entry fields:

| Field | Required | Meaning |
| --- | ---: | --- |
| `id` | either `id` or `path` | load a built-in Team |
| `path` | either `id` or `path` | load a file-based Team directory |
| `enabled` | no | defaults to `true` |
| `priority` | no | lower number ranks earlier within the same source |

Constraint:

```text
Each entry must declare exactly one of id or path.
```

P0 does not add user-authored `scope`, `source`, `extends`, or `include` fields. `scope` is derived from the config file source at runtime.

---

## 6. Path resolution

`path` behavior stays the same, but the base directory is always the directory containing the current `crewbee.json`.

Global example:

```text
~/.config/opencode/crewbee.json
{ "path": "@teams/ResearchOpsTeam" }
-> ~/.config/opencode/teams/ResearchOpsTeam
```

Project example:

```text
<project-worktree>/.crewbee/crewbee.json
{ "path": "@teams/ProjectCodingTeam" }
-> <project-worktree>/.crewbee/teams/ProjectCodingTeam
```

Supported forms:

```json
{ "path": "@teams/ProjectCodingTeam" }
{ "path": "teams/ProjectCodingTeam" }
{ "path": "~/CrewBeeTeams/ProjectCodingTeam" }
{ "path": "E:/CrewBeeTeams/ProjectCodingTeam" }
```

| Form | Meaning |
| --- | --- |
| `@teams/xxx` | remove `@`, resolve relative to current `crewbee.json` directory |
| `teams/xxx` | resolve relative to current `crewbee.json` directory |
| `~/xxx` | resolve relative to user home |
| absolute path | use as-is |

---

## 7. Unified assembly flow

Do **not** implement this as:

```text
load global TeamLibrary
load project TeamLibrary
merge two TeamLibraries
```

The required flow is:

```text
collect config sources
  -> normalize into Team Registrations
  -> discover Team directories
  -> parse Team Packages
  -> validate
  -> resolve conflicts
  -> build Effective TeamLibrary
  -> Runtime Projection
  -> OpenCode Config Patch
```

Conceptual model:

```text
crewbee.json
  -> Team Registration Source
  -> Team Registration
  -> Team Package
  -> Effective TeamLibrary
  -> Projected Teams / Projected Agents
  -> OpenCode Agents
```

Global and project config differ only in source metadata.

---

## 8. Source semantics

Each `crewbee.json` is a configuration source.

Global source:

```text
scope: global
baseDir: <OpenCodeConfigRoot>
configPath: <OpenCodeConfigRoot>/crewbee.json
precedence: lower than project
```

Project source:

```text
scope: project
baseDir: <project-worktree>/.crewbee
configPath: <project-worktree>/.crewbee/crewbee.json
precedence: higher than global
```

`scope` is used for:

- path diagnostics
- conflict handling
- default Agent selection
- doctor output
- runtime state display

It must not introduce new Team parsing, Agent parsing, prompt generation, or OpenCode projection logic.

---

## 9. Priority rules

Existing `priority` semantics remain:

> lower number means higher priority.

Within one source:

```json
{
  "teams": [
    { "path": "@teams/A", "priority": 0 },
    { "path": "@teams/B", "priority": 1 }
  ]
}
```

`A` outranks `B`.

Across sources:

```text
1. project source > global source
2. within the same source, lower priority first
3. within the same source and priority, declaration order first
4. stable id ordering only as a final fallback when needed
```

Therefore:

```text
project priority 1
global priority 0
```

still results in the project Team taking precedence, because source precedence is compared first.

---

## 10. Default Agent selection

Default Agent selection is not project-specific logic. It is computed from the Effective TeamLibrary.

Default Team candidate order:

1. enabled project Teams
2. enabled global Teams
3. within the same source, lower priority first
4. within the same priority, config declaration order
5. stable id fallback when needed

Default Agent selection:

1. Prefer the Team formal leader.
2. If the formal leader cannot be an OpenCode entry, use the projected default agent.
3. If still unavailable, use the first user-selectable Agent.
4. If the Team has no usable entry, skip it and try the next Team.

Manual user selection is not overwritten. Project default Agent only affects OpenCode initialization and new session defaults; CrewBee should not switch back during `chat.message` after a user explicitly chooses another Agent.

---

## 11. Team id conflicts

### 11.1 Same Team id in global and project

If both sources define the same manifest id:

```text
project coding-team wins
```

OpenCode sees only one effective `coding-team`.

Diagnostic message should explain:

```text
project team "coding-team" shadows global team "coding-team"
```

### 11.2 Duplicate Team id within the same source

The higher-priority entry wins. If priority is equal, the earlier declaration wins. The skipped Team emits a warning.

### 11.3 Projected agent id conflicts

Agent id conflict handling continues to use the existing canonical id normalization and validation mechanism. Project sources do not get a separate collision system. If an invalid project Team mutates canonical id tracking during normalization but later fails validation, that mutation must be rolled back so fallback global Teams are not polluted.

---

## 12. Built-in Teams

This remains valid:

```json
{ "id": "coding-team", "enabled": true, "priority": 0 }
```

Global config can enable the built-in Coding Team globally.

Project config can also reference the built-in Coding Team:

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 }
  ]
}
```

This does not copy the Team definition and does not add project-specific assembly. The same built-in Team definition enters the unified assembly path with project source metadata, so it outranks the global source.

---

## 13. Recommended layouts

Global Team:

```text
~/.config/opencode/
  crewbee.json
  teams/
    ResearchOpsTeam/
      team.manifest.yaml
      team.policy.yaml
      researchops-leader.agent.md
      evidence-researcher.agent.md
      report-writer.agent.md
      TEAM.md
```

Project Team:

```text
MyProject/
  .crewbee/
    crewbee.json
    teams/
      ProjectCodingTeam/
        team.manifest.yaml
        team.policy.yaml
        project-leader.agent.md
        project-executor.agent.md
        project-reviewer.agent.md
        TEAM.md
```

When both are present, effective order is:

```text
project:
  ProjectCodingTeam

global:
  coding-team
  ResearchOpsTeam
```

Default Agent:

```text
ProjectCodingTeam formal leader
```

---

## 14. OpenCode plugin lifecycle

Project Teams participate during OpenCode plugin config / bootstrap:

```text
OpenCode plugin config/bootstrap
  -> read ctx.worktree
  -> collect global crewbee.json
  -> collect project .crewbee/crewbee.json
  -> assemble one TeamLibrary
  -> generate one OpenCode agent config
```

Do not defer project Team injection to `chat.message`, because agent list, default Agent, aliases, projected ids, delegation binding, and session binding all depend on one projection result.

`ctx.worktree` is used only to locate:

```text
<ctx.worktree>/.crewbee/crewbee.json
```

It should not leak into Team parsing, prompt generation, or OpenCode projection.

Caching, if added later, must be keyed by:

```text
OpenCode config root + worktree
```

P0 does not require hot reload. Users should restart OpenCode after changing `.crewbee/crewbee.json`, `team.manifest.yaml`, `team.policy.yaml`, or `*.agent.md`.

---

## 15. Error handling and fallback

### 15.1 Missing project config

Load only global `crewbee.json`. Keep existing behavior.

### 15.2 Invalid project JSON

Skip project config, emit a warning, continue with global Teams. OpenCode should still start.

Project config errors must not trigger global config self-repair and must not auto-create project files.

### 15.3 Missing project Team path

Skip that Team entry, emit a warning, and continue.

### 15.4 Invalid project Team package

Examples:

- missing `team.manifest.yaml`
- missing `team.policy.yaml`
- no `*.agent.md`
- leader reference does not exist

Behavior: skip that Team, emit validation warnings, and continue.

### 15.5 All project Teams fail

Fall back to global Teams. OpenCode remains usable.

### 15.6 Missing or invalid global config

Global config keeps the existing install / startup self-repair behavior:

```text
use packaged templates/crewbee.json to create or repair <OpenCodeConfigRoot>/crewbee.json
copy templates/teams to <OpenCodeConfigRoot>/teams when needed
```

Project config is not auto-created to avoid hidden side effects in user projects.

---

## 16. Diagnostics and doctor output

Doctor / debug output should eventually show the effective configuration:

```text
CrewBee Effective Team Configuration

OpenCode config root:
  ~/.config/opencode

Worktree:
  /Users/yong/work/MyProject

Global config:
  ~/.config/opencode/crewbee.json

Project config:
  /Users/yong/work/MyProject/.crewbee/crewbee.json

Loaded sources:
  [project] /Users/yong/work/MyProject/.crewbee/crewbee.json
  [global]  ~/.config/opencode/crewbee.json

Effective teams:
  1. [project] project-coding-team priority=0
  2. [global]  coding-team priority=0
  3. [global]  researchops-team priority=1

Default agent:
  [project-coding-team] project-leader

Warnings:
  none
```

Potential future command:

```text
crewbee doctor --project .
```

It should report worktree, project config validity, Team path validity, Team package validation, effective TeamLibrary inclusion, default Agent, shadows, collisions, and fallbacks.

---

## 17. Scenarios

### 17.1 Only global config

Project has no `.crewbee/crewbee.json`. Result: only global Teams load; default Agent comes from the highest-priority global Team leader.

### 17.2 Project config has one project Team

```json
{
  "teams": [
    { "path": "@teams/ProjectCodingTeam", "enabled": true, "priority": 0 }
  ]
}
```

Result: global Teams remain available, `ProjectCodingTeam` outranks them, and its formal leader becomes the default Agent.

### 17.3 Project config references built-in Coding Team

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 }
  ]
}
```

Result: the built-in `coding-team` enters as a project source and outranks global sources.

### 17.4 Project Team overrides same-id global Team

If both global and project Team manifests use `id: coding-team`, the project Team wins and the global Team is shadowed.

---

## 18. Compatibility requirements

- Existing global `crewbee.json` files continue to work unchanged.
- If project `.crewbee/crewbee.json` is absent, behavior remains compatible with previous versions.
- Team file structure stays unchanged.
- No `agents/`, `docs/`, `routing-map.yaml`, or `handoff.contract.yaml` directories are introduced in P0.
- `priority` still means lower number is higher priority; only source precedence is added above it.

---

## 19. Implementation order

Minimal implementation order:

1. Keep the existing `crewbee.json` `teams` schema.
2. Read `ctx.worktree` during OpenCode bootstrap.
3. Add project config candidate `<worktree>/.crewbee/crewbee.json`.
4. Parse global and project `crewbee.json` into the same Team Registration model.
5. Attach source scope, source baseDir, source precedence, and declaration order.
6. Use the same package loader for `id` and `path` entries.
7. Use the same validator.
8. Resolve conflicts by source precedence and priority.
9. Generate one Effective TeamLibrary.
10. Reuse Runtime Projection.
11. Reuse OpenCode Config Patch.
12. Select default Agent from the effective ordering.
13. Add diagnostics / doctor output.

Critical constraints:

```text
no project-only loader
no project-only projection
no project-only prompt builder
no project-only OpenCode patch
```

---

## 20. Acceptance criteria

Configuration compatibility:

- old global `crewbee.json` still works
- no project config means unchanged behavior
- project config uses the same `teams` schema

Unified assembly:

- global and project Teams use the same parser
- global and project Teams use the same validator
- both enter the same Effective TeamLibrary
- both use the same Runtime Projection
- both use the same OpenCode Config Patch

Priority correctness:

- project Teams outrank global Teams
- within a source, lower priority wins
- same-id project Team shadows global Team
- highest-priority project Team leader becomes default Agent when usable

Reliable fallback:

- missing project config is not an error
- invalid project config falls back to global Teams
- invalid project Team is skipped
- OpenCode remains usable

User experience:

- users learn one `crewbee.json` schema
- project and global Team directory structures are identical
- doctor can explain effective Team order and default Agent

---

## 21. Final positioning

This design implements project-level Team support as a second same-schema `crewbee.json` source, not as a separate project-specific Team subsystem.

Final flow:

```text
global crewbee.json
project .crewbee/crewbee.json
        ↓
unified Team Registration
        ↓
unified Team assembly
        ↓
unified Runtime Projection
        ↓
unified OpenCode Agent injection
```

Project Teams differ only by:

```text
different path source
higher source precedence
```

Everything else is the same as global Teams.
