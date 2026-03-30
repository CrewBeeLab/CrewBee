# Agent Team Template

## Purpose

This directory is the canonical file-based Team template for `AgentTeams/`.
It is aligned to the current embedded `coding-team` design language and to the real loader/parser implementation under `src/agent-teams/`.

## Required Disk Layout

```text
AgentTeams/<YourTeam>/
  team.manifest.yaml
  <agent-id>.agent.md
  TEAM.md            # optional but recommended
```

- `team.manifest.yaml` is required.
- At least one `*.agent.md` file at the team root is required.
- Every agent file must end with `.agent.md`.
- `TEAM.md` or `README.md` is optional; the loader discovers them in that order.

## Manifest Rules

`team.manifest.yaml` should use snake_case keys for the file-based form. `prompt_projection.include` / `exclude` must use canonical field names only.

Required top-level blocks:

- `id`
- `version`
- `name`
- `description`
- `mission`
- `scope`
- `leader`
- `members`
- `workflow`
- `governance`

`members` should be a keyed map by `agent_ref`, not a list. Each member entry should define:

- `responsibility`
- `delegate_when`
- `delegate_mode`

Recommended optional blocks that keep the file-based template aligned with current `coding-team` conventions:

- `agent_runtime`
- `tags`
- `prompt_projection`

`working_mode` and `structure_principles` are no longer part of the Team manifest schema. Put that design-time guidance in `TEAM.md` or `README.md` instead.

## Agent Profile Rules

Each `*.agent.md` file at the team root must start with YAML frontmatter:

```md
---
id: leader
name: Leader
archetype: orchestrator
persona_core: ...
responsibility_core: ...
collaboration: ...
runtime_config: ...
---
```

Required frontmatter blocks:

- `id`
- `name`
- `archetype`
- `persona_core`
- `responsibility_core`
- `collaboration`
- `runtime_config`

Recommended optional blocks for parity with current `coding-team` profiles:

- `execution_policy`
- `output_contract`
- `operations`
- `templates`
- `guardrails`
- `heuristics`
- `anti_patterns`
- `examples`
- `tool_skill_strategy`
- `entry_point`
- `prompt_projection`

## Prompt Projection

Use `prompt_projection` inside `team.policy.yaml` and `*.agent.md` to control which fields enter the final prompt. Dotted paths are supported. Render order is determined by the framework's semantic section plan first, then by source order for extra sections.

Supported Team prompt fields:

- `working_rules`
- `approval_safety`

Supported Agent fields:

- `responsibility_core`
- `responsibility_core.description`
- `responsibility_core.objective`
- `responsibility_core.authority`
- `responsibility_core.output_preference`
- `responsibility_core.use_when`
- `responsibility_core.avoid_when`
- `responsibility_core.success_definition`
- `responsibility_core.non_goals`
- `responsibility_core.in_scope`
- `responsibility_core.out_of_scope`
- `persona_core`
- `ambiguity_policy`
- `task_triage`
- `delegation_review`
- `delegation_review.delegation_policy`
- `delegation_review.review_policy`
- `todo_discipline`
- `completion_gate`
- `collaboration`
- `output_contract`
- `operations`
- `operations.autonomy_level`
- `operations.stop_conditions`
- `operations.core_operation_skeleton`
- `templates`
- `templates.exploration_checklist`
- `templates.execution_plan`
- `templates.final_report`
- `guardrails`
- `guardrails.critical`
- `heuristics`
- `anti_patterns`
- `examples`
- `examples.fit`
- `examples.fit.good_fit`
- `examples.fit.bad_fit`
- `examples.micro`
- `examples.micro.ambiguity_resolution`
- `examples.micro.final_closure`
- `tool_skill_strategy`
- `tool_skill_strategy.principles`
- `tool_skill_strategy.preferred_order`
- `tool_skill_strategy.avoid`
- `tool_skill_strategy.notes`
- `entry_point`
- `id`
- `name`
- `owner`
- `tags`
- `archetype`
- `runtime_config`

Example in `team.policy.yaml`:

```yaml
prompt_projection:
  include:
    - working_rules
    - approval_safety
```

For Team manifests, `kind`, `status`, `owner`, `workflow.id`, and `workflow.name` are no longer part of the schema. Keep only `workflow.stages`. `workflow` remains part of Team config for manager/UI/runtime use, but it is no longer prompt-projectable.

Example in `*.agent.md` frontmatter:

```yaml
prompt_projection:
  include:
    - persona_core
    - responsibility_core.description
    - responsibility_core.objective
    - responsibility_core.authority
    - responsibility_core.output_preference
    - ambiguity_policy
    - task_triage
    - delegation_review.delegation_policy
    - delegation_review.review_policy
    - todo_discipline
    - completion_gate
    - collaboration
    - operations.autonomy_level
    - operations.stop_conditions
    - operations.core_operation_skeleton
    - guardrails.critical
    - heuristics
    - anti_patterns
    - output_contract
    - templates.final_report
    - examples.micro
    - tool_skill_strategy.principles
    - tool_skill_strategy.preferred_order
    - tool_skill_strategy.avoid
  exclude:
    - archetype
    - tags
    - entry_point
    - runtime_config
    - responsibility_core.use_when
    - responsibility_core.avoid_when
    - responsibility_core.success_definition
    - responsibility_core.non_goals
    - responsibility_core.in_scope
    - responsibility_core.out_of_scope
    - templates.exploration_checklist
    - templates.execution_plan
    - examples.fit
    - tool_skill_strategy.notes
```

`archetype` remains valid in agent profiles as design-time metadata, but it is intentionally hidden from final prompt projection.

OpenCode prompt rendering no longer dumps raw YAML-style config. The final prompt is rendered as semi-structured markdown with exactly two parts: `## Team Contract` and `## Agent Contract`.

`workflow_override` has been removed from the Agent profile schema. Put `autonomy_level`, `stop_conditions`, and `core_operation_skeleton` under `operations` instead.

`tool_skill_strategy` is prompt-only guidance about how the agent should prioritize direct tools, skills, and delegation. It does not register capabilities. The real runtime capability set still comes from `runtime_config.requested_tools` and `runtime_config.skills`.

`execution_policy` is the preferred home for execution-directing rules such as ambiguity handling, task triage, delegation, review, todo discipline, completion gates, and failure recovery. Keep `operations` focused on autonomy, stop conditions, and the executable procedure skeleton.

`examples` should use the richer two-layer structure below. Keep broad fit guidance for authoring/reference and project only `micro` when you want compact, high-density execution examples in the final prompt.

```yaml
examples:
  fit:
    good_fit: []
    bad_fit: []
  micro:
    ambiguity_resolution: []
    final_closure: []
```

Current semantics are intentionally narrow:

- `include` = explicit allowlist when present
- `exclude` = explicit denylist applied after `include`
- the projection layer decides ordering, rendering, and final prompt assembly
- this block only decides whether a field participates at all

## Markdown Section Names

If you put optional data in the markdown body instead of frontmatter, use the exact parser-recognized headings below:

- `## Minimal Operations`
- `## Minimal Templates`
- `## Critical Guardrails`
- `## Unique Heuristics`
- `## Agent-Specific Anti-patterns`
- `## Examples`

Any other heading names are documentation-only and will not be parsed into structured agent data.

## Template Intent

- Keep one active owner on the main context chain.
- Prefer responsibility-first naming and routing.
- Separate research/support roles from write-execution roles unless a single owner can safely absorb both.
- Make verification, evidence, and closure expectations explicit in both Team and agent files.

## Suggested Design Notes

Document team-shaping guidance here instead of encoding it in `team.manifest.yaml`.

### Working Mode

- Human requests normally enter through the leader.
- Coordination stays leader-driven unless the Team explicitly documents another practice.
- Session Context is the default collaboration channel.
- Explicit routing or contract files should be documented here only when the Team intentionally adopts them.

### Structure Principles

- Keep one active owner on the main context chain at a time.
- Explain how specialists support the main owner without fragmenting execution.
- Record stable team-structure rules here instead of adding more manifest fields.

## Usage

- Copy this directory to create a new Team under `AgentTeams/`.
- Rename agent IDs and role descriptions to fit the new Team.
- Keep file-based teams in snake_case YAML / frontmatter form.
- Use the embedded `coding-team` as the behavioral exemplar, but convert that behavior into `team.manifest.yaml` + `.agent.md` files for loader compatibility.
