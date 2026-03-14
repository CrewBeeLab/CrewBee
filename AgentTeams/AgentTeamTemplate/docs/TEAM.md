# Agent Team Template

## Purpose

This directory is the canonical file-based Team template for `AgentTeams/`.
It is aligned to the current embedded `coding-team` design language and to the real loader/parser implementation under `src/agent-teams/`.

## Required Disk Layout

```text
AgentTeams/<YourTeam>/
  team.manifest.yaml
  agents/
    <agent-id>.agent.md
  docs/
    TEAM.md            # optional but recommended
```

- `team.manifest.yaml` is required.
- `agents/` is required.
- Every agent file must end with `.agent.md`.
- `docs/TEAM.md`, `TEAM.md`, or `README.md` is optional; the loader discovers them in that order.

## Manifest Rules

`team.manifest.yaml` should use snake_case keys for the file-based form, even though the parser accepts some camelCase aliases.

Required top-level blocks:

- `id`
- `kind`
- `version`
- `name`
- `status`
- `owner`
- `description`
- `mission`
- `scope`
- `leader`
- `members`
- `workflow`
- `governance`

Recommended optional blocks that keep the file-based template aligned with current `coding-team` conventions:

- `agent_runtime`
- `tags`
- `prompt_projection`

`working_mode` and `structure_principles` are no longer part of the Team manifest schema. Put that design-time guidance in `docs/TEAM.md`, `TEAM.md`, or `README.md` instead.

## Agent Profile Rules

Each `agents/*.agent.md` file must start with YAML frontmatter:

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

- `workflow_override`
- `output_contract`
- `operations`
- `templates`
- `guardrails`
- `heuristics`
- `anti_patterns`
- `examples`
- `entry_point`
- `prompt_projection`

## Prompt Projection

Use `prompt_projection` inside `team.manifest.yaml` and `agents/*.agent.md` to control exactly which schema fields are allowed to enter the final prompt.

Example in `team.manifest.yaml`:

```yaml
prompt_projection:
  include:
    - mission
    - workflow
    - governance
```

Example in `*.agent.md` frontmatter:

```yaml
prompt_projection:
  include:
    - persona_core
    - responsibility_core
    - collaboration
    - workflow_override
    - output_contract
  exclude:
    - owner
    - tags
```

`archetype` remains valid in agent profiles as design-time metadata, but it is intentionally hidden from final prompt projection.

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
