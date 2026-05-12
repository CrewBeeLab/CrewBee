# Designing a Custom Agent Team (Best Practices)

Language: [中文](./custom-agent-team.md) | English

Audience: **users and Team authors** defining Agent Team assets. Repository release and CI/CD workflows are covered in the [Release And CI/CD Guide](../developer/release.md).

## 0. The two things to decide first: where to put it, and how to register it

When defining a custom Agent Team, the two operational decisions are:

1. **Put all Team definition files in one Team directory.**
2. **Register that Team directory in either a global or project-level `crewbee.json`.**

### 0.1 Team directory layout

A file-based Team is a directory. The current implementation reads only files at the Team directory root. It does not scan `agents/`, `docs/`, or other subdirectories:

```text
ResearchOpsTeam/
  team.manifest.yaml
  team.policy.yaml
  researchops-leader.agent.md
  evidence-researcher.agent.md
  report-writer.agent.md
  TEAM.md              # optional, human-facing documentation
```

Required files:

- `team.manifest.yaml`
- `team.policy.yaml`
- at least one `*.agent.md`

Optional files:

- `TEAM.md`
- `README.md`

> Key constraint: `*.agent.md` files must be in the same directory as `team.manifest.yaml` and `team.policy.yaml`. CrewBee does not load agents from an `agents/` subdirectory.

### 0.2 Where to configure `crewbee.json`

CrewBee supports two isomorphic configuration sources:

| Scope | Config file | Use case |
| --- | --- | --- |
| global | `crewbee.json` under the OpenCode config root | Teams available by default across projects |
| project | `.crewbee/crewbee.json` under the current worktree | Teams specific to the current project |

The common global location is:

```text
~/.config/opencode/crewbee.json
```

On Windows this usually maps to:

```text
C:\Users\<your-user>\.config\opencode\crewbee.json
```

If OpenCode uses a different config root, use that actual config root.

Project-level configuration lives in the current OpenCode worktree:

```text
<project-worktree>/.crewbee/crewbee.json
```

Project and global config use the same schema, Team directory structure, loader, validator, projection, and OpenCode config patch. The only differences are source path, path resolution base, runtime scope (`project` / `global`), and source precedence.

### 0.3 Minimal `crewbee.json`

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/ResearchOpsTeam", "enabled": true, "priority": 1 }
  ]
}
```

Meaning:

- `{ "id": "coding-team" }`: load the built-in Coding Team.
- `{ "path": "..." }`: load a file-based Team; the path points to the Team directory, not to a specific file.
- `enabled`: optional; defaults to `true`.
- `priority`: optional; lower numbers rank earlier within the same source. Across sources, project source wins before global source. The highest-priority usable Team leader becomes the OpenCode default Agent.
- Each entry must use either `id` or `path`, not both.

Supported `path` forms:

```json
{ "path": "@teams/ResearchOpsTeam" }
{ "path": "teams/ResearchOpsTeam" }
{ "path": "~/CrewBeeTeams/ResearchOpsTeam" }
{ "path": "E:/CrewBeeTeams/ResearchOpsTeam" }
```

Path rules:

- `@teams/ResearchOpsTeam`: remove `@`, then resolve relative to the directory containing the current `crewbee.json`.
- `teams/ResearchOpsTeam`: resolve relative to the directory containing the current `crewbee.json`.
- `~/...`: resolve relative to the user home directory.
- Absolute paths: use as-is.

Global example:

```text
~/.config/opencode/teams/ResearchOpsTeam/
```

Project example:

```text
<project-worktree>/.crewbee/teams/ResearchOpsTeam/
```

### 0.4 Shortest working path

1. Choose the Team scope: global Teams live under the OpenCode config root; project Teams live under the current project's `.crewbee` directory.
2. Create the Team directory:
   - global: `<OpenCodeConfigRoot>/teams/ResearchOpsTeam/`
   - project: `<project-worktree>/.crewbee/teams/ResearchOpsTeam/`
3. Put `team.manifest.yaml`, `team.policy.yaml`, and all `*.agent.md` files at the Team directory root.
4. Add this entry to the matching `crewbee.json`:

```json
{ "path": "@teams/ResearchOpsTeam", "enabled": true, "priority": 1 }
```

5. Restart OpenCode or the OpenCode server so CrewBee reloads the configuration.

---

## 1. Audience and goal

This guide is for:

1. People who want to add a Team to CrewBee.
2. People who want to encode their own workflow as an Agent Team.

The goal is practical:

> Help you design and land a runnable Team that matches CrewBee's current implementation.

---

## 2. What a Team is in CrewBee

A Team is a directory containing four categories of files:

```text
<YourTeamDir>/
  team.manifest.yaml
  team.policy.yaml
  <agent-1>.agent.md
  <agent-2>.agent.md
  <agent-3>.agent.md
  TEAM.md      # optional
```

- `team.manifest.yaml`: identifies the Team, formal leader, members, mission, scope, and workflow.
- `team.policy.yaml`: defines shared governance, safety, and quality rules.
- `*.agent.md`: defines each Agent profile.
- `TEAM.md`: optional human-facing explanation.

Register the Team in `crewbee.json`:

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/ResearchOpsTeam", "enabled": true, "priority": 1 }
  ]
}
```

Notes:

- `coding-team` is built in and does not need a `path`.
- File-based Team paths point to the Team directory.
- `@...` is relative to the current `crewbee.json` directory.
- Project Teams outrank global Teams by source precedence.
- If a project Team and global Team use the same manifest id, the project Team shadows the global Team.

---

## 3. Five questions before writing files

### 3.1 What problem does this Team solve?

Examples:

- software development and bug fixing
- documentation and research
- product analysis
- complex task coordination
- project management

This shapes the Team `mission`, `scope`, Agent responsibilities, and workflow.

### 3.2 Who is the formal leader?

Every Team should have a formal leader. The leader is:

- the default entry point
- the closure owner
- the most natural user-facing Agent

Do not make the leader a symbolic role that users should not normally select.

### 3.3 Which members are needed?

Start small. Usually the minimum useful Team is:

- 1 leader
- 1 to 3 specialist support Agents

Examples:

- Coding Team: `leader`, `executor`, `reviewer`
- General Team: `leader`, `researcher`, `writer`

### 3.4 What are the shared rules?

Shared rules belong in `team.policy.yaml`, not duplicated across Agents:

- instruction precedence
- approval policy
- forbidden actions
- quality floor
- shared working rules

### 3.5 What are the Agent's decision menus?

High-value Agent behavior should be expressed as first-class sections, not hidden inside one large blob:

- `core_principle`
- `scope_control`
- `ambiguity_policy`
- `support_triggers`
- `task_triage`
- `delegation_review`
- `completion_gate`
- `failure_recovery`

---

## 4. Best-practice principles

### 4.1 Start small, then expand

Do not start with ten Agents. Begin with one leader and a few focused support Agents.

### 4.2 Make the Team clear before making it fancy

Prioritize:

- who the leader is
- member boundaries
- default workflow
- Team policy

### 4.3 Agent differences should come from the profile

Do not rely on the framework to infer whether an Agent is a planner, reviewer, or executor. Define:

- who it is
- what it owns
- how it acts by default
- how it collaborates

### 4.4 Prompt Projection only trims; it should not become the design source

`prompt_projection` controls which sections appear and how they are labeled. It should not replace the Team / Agent definitions.

### 4.5 Collaboration should be written for delegation

CrewBee combines Agent collaboration entries with Team Manifest member metadata to generate useful delegation descriptions. Make `members.responsibility`, `delegate_when`, and `delegate_mode` concrete.

---

## 5. Create the Team directory

Global Team:

```text
<OpenCodeConfigRoot>/teams/
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
<project-worktree>/.crewbee/teams/
  ResearchOpsTeam/
    team.manifest.yaml
    team.policy.yaml
    researchops-leader.agent.md
    evidence-researcher.agent.md
    report-writer.agent.md
    TEAM.md
```

Recommendations:

- Use stable directory names, often `PascalCase` or kebab-case depending on the surrounding convention.
- Use `kebab-case.agent.md` for Agent files.
- Use `snake_case` for YAML and frontmatter keys.

---

## 6. Write `team.manifest.yaml`

`team.manifest.yaml` defines the Team's primary structure.

Important fields:

| Field | Purpose |
| --- | --- |
| `id` | Stable Team identifier |
| `version` | Definition version |
| `name` | Human-readable display name |
| `description` | One-line Team description |
| `mission` | Team objective and success definition |
| `scope` | In-scope and out-of-scope work |
| `leader` | Formal leader reference |
| `members` | Member map and delegation metadata |
| `workflow` | Default workflow stages |
| `governance` | Static governance metadata |
| `tags` | Optional labels |

Minimal shape:

```yaml
id: researchops-team
version: 1.0.0
name: ResearchOpsTeam
description: Team for research, evidence synthesis, and structured reports

mission:
  objective: Deliver clear, evidence-backed, directly usable research outputs
  success_definition:
    - conclusions are clear
    - evidence is sufficient
    - output is directly usable

scope:
  in_scope:
    - research
    - analysis
    - writing
  out_of_scope:
    - large-scale coding implementation

leader:
  agent_ref: researchops-leader
  responsibilities:
    - receive user tasks
    - decide the research path
    - delegate specialist work when useful
    - own final closure

members:
  researchops-leader:
    responsibility: Default owner for research and synthesis tasks.
    delegate_when: Most research, analysis, and report tasks.
    delegate_mode: Keeps ownership and delegates only focused support work.

  evidence-researcher:
    responsibility: Finds sources, verifies facts, and extracts evidence.
    delegate_when: External evidence or fact checking is required.
    delegate_mode: Read-only research delegation with evidence and limits.

  report-writer:
    responsibility: Turns established conclusions into structured writing.
    delegate_when: Conclusions are ready and need formatting or prose.
    delegate_mode: Drafting delegation aligned to the required structure.

workflow:
  stages:
    - intake
    - clarification
    - evidence collection
    - synthesis
    - draft output
    - final check

governance:
  instruction_precedence:
    - platform rules
    - repository rules
    - team rules
    - agent rules
    - task rules
  approval_policy:
    required_for:
      - destructive actions
      - external side effects
      - commit
    allow_assume_for:
      - low-risk local decisions
  forbidden_actions:
    - fabricate evidence
    - claim done without verification
  quality_floor:
    required_checks:
      - evidence
      - consistency
    evidence_required: true
  working_rules:
    - leader is the primary interface
    - support agents report back to the active owner

tags:
  - research
  - analysis
  - writing
```

---

## 7. Write `team.policy.yaml`

This file defines Team-wide shared rules and directly affects the Team Contract rendered into prompts.

Minimal shape:

```yaml
kind: team-policy
version: 1.0.0

instruction_precedence:
  - platform rules
  - repository rules
  - team rules
  - agent rules
  - task rules

approval_policy:
  required_for:
    - destructive actions
    - external side effects
    - commit
  allow_assume_for:
    - low-risk local decisions

forbidden_actions:
  - fabricate evidence
  - claim done without verification
  - ignore hard constraints

quality_floor:
  required_checks:
    - evidence
    - consistency
  evidence_required: true

working_rules:
  - leader is the primary interface
  - support agents report back to the active owner
  - final user-facing summary comes from the role holding closure responsibility

prompt_projection:
  include:
    - working_rules
    - approval_safety
```

Write shared bottom lines here; do not encode one Agent's personal style in Team policy.

---

## 8. Design the leader Agent first

The leader should answer six questions:

1. Who am I?
2. What do I own?
3. How do I act by default?
4. When do I delegate, review, ask, or stop?
5. What counts as completion?
6. How do I recover from failure?

Recommended sections:

- `metadata`
- `persona_core`
- `responsibility_core`
- first-class behavior sections such as `core_principle`, `ambiguity_policy`, `support_triggers`, `task_triage`, `completion_gate`, and `failure_recovery`
- `collaboration`
- `runtime_config`
- `output_contract`
- `entry_point`
- `prompt_projection`

Set `entry_point.exposure: user-selectable` for the leader if users should be able to select it directly.

---

## 9. Add support Agents

After the leader is clear, add support Agents one at a time.

Principles:

- Each support Agent should own one clear class of work.
- Avoid vague support roles that can do everything.
- Do not create too many Agents early.
- Give each support Agent concrete `use_when`, `avoid_when`, and output expectations.

---

## 10. Write `TEAM.md`

`TEAM.md` is for humans, not for the parser. It is recommended but not required.

Template:

```md
# ResearchOpsTeam

## Mission
Research, evidence synthesis, report writing, and lightweight coordination.

## Leader
- researchops-leader: default entry point and owner

## Members
- evidence-researcher: source search and evidence extraction
- report-writer: structured final writing

## Default Workflow
1. User gives a task to the leader
2. Leader clarifies and chooses the path
3. Leader decides whether to self-execute, consult, or delegate
4. Support Agents report back to leader
5. Leader synthesizes and returns the final result

## Design Notes
- Team Contract uses Working Rules / Approval & Safety
- Agent Profiles use top-level semantic sections
- Collaboration produces directly delegable Agent descriptions
```

---

## 11. Validate the Team

Minimum checklist:

- `team.manifest.yaml` exists
- `team.policy.yaml` exists
- at least one `*.agent.md` exists
- `leader.agent_ref` points to a real Agent id
- all `members` entries refer to real Agents
- YAML keys use `snake_case`
- no legacy `projection_schema`

Recommended self-check:

- Is the Team mission clear?
- Is the formal leader obvious?
- Are member responsibilities concrete?
- Can the leader own the main path?
- Are support Agents focused?
- Is `prompt_projection` only trimming, not replacing the source definitions?

---

## 12. Common mistakes

1. Designing a flat group of Agents with no clear leader.
2. Hiding important behavior in one large generic field.
3. Listing members without responsibilities and delegation timing.
4. Creating too many vague support Agents.
5. Treating `README.md` or `TEAM.md` as the runtime source of truth.

Runtime source files are:

- `team.manifest.yaml`
- `team.policy.yaml`
- `*.agent.md`

---

## 13. Summary

Recommended process:

1. Decide what problem the Team solves.
2. Choose the formal leader.
3. Write `team.manifest.yaml`.
4. Write `team.policy.yaml`.
5. Design the leader Agent first.
6. Add support Agents gradually.
7. Make `members.responsibility / delegate_when / delegate_mode` specific.
8. Add `TEAM.md` for humans.
9. Start with a small working Team, then expand.

Most important rule:

> Design the Team structure, leader, member boundaries, and key execution semantics before tuning prompt wording.
