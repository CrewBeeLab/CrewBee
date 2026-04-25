# General Task Team

## Purpose

`teams/template` is a ready-to-use general-purpose CrewBee Team. It is not only a skeleton for authors: a user can select this Team without modifying any files and use it for real work such as assistance, summarization, note organization, question research, information retrieval, comparison, drafting, lightweight data analysis, and structured extraction.

The Team is intentionally broad but not careless: it defaults to useful direct answers for simple tasks, uses research when evidence matters, uses production support when an artifact must be organized or transformed, and reports assumptions or source limits when they affect trust.

## Team Roles

- `leader` (`General Task Leader`): user-selectable entry point and final context owner. It decides whether to answer directly, consult research, hand off production work, ask one precise clarification question, or stop for approval.
- `researcher` (`General Task Researcher`): read-only evidence specialist for local files, supplied material, accessible external sources, fact checking, source comparison, and context discovery.
- `executor` (`General Task Executor`): production specialist for summaries, notes, tables, drafts, extraction, classification, calculations, formatting, and lightweight analysis.

## Good Fits

- Summarize meeting notes into decisions, action items, risks, and open questions.
- Organize messy notes into a clean outline, brief, table, or checklist.
- Research a topic and synthesize source-backed findings with confidence limits.
- Compare tools, options, documents, arguments, or tradeoffs.
- Extract structured fields from text or files.
- Inspect small datasets, logs, lists, or tables for patterns, anomalies, counts, and caveats.
- Draft, rewrite, polish, or restructure content while preserving user intent.
- Answer general questions with appropriate caveats and evidence status.

## Safety and Evidence Defaults

- The Team must not fabricate evidence, citations, files, source access, data, or tool results.
- The Team must not claim it read material that was unavailable.
- Destructive actions, external side effects, publishing, sending, purchasing, deleting, committing, or accessing sensitive/private sources require explicit approval.
- If the task is open-ended, the leader chooses a useful default format and only asks for clarification when ambiguity materially changes the result, cost, risk, or safety.
- Factual claims should be supported, qualified, or marked as assumptions when evidence matters.

## Default Workflow

1. Intake the user's real deliverable.
2. Choose one of the main paths:
   - direct answer
   - summarize / organize
   - research / retrieve
   - produce / transform
   - data / analysis
3. Use `researcher` or `executor` only when that improves quality.
4. Check scope fit, factual consistency, completeness, and evidence status.
5. Deliver the final answer or artifact in the most useful format.

## File Layout

```text
teams/template/
  team.manifest.yaml
  team.policy.yaml
  leader.agent.md
  researcher.agent.md
  executor.agent.md
  TEAM.md
```

## Loader Compatibility Notes

This Team uses the current file-based CrewBee schema:

- `team.manifest.yaml` contains `id`, `version`, `name`, `description`, `mission`, `scope`, `leader`, `members`, `workflow`, `governance`, `agent_runtime`, `tags`, and `prompt_projection`.
- `team.policy.yaml` is required and defines instruction precedence, approval policy, forbidden actions, quality floor, working rules, and prompt projection.
- Each `*.agent.md` file uses YAML frontmatter with first-class fields such as `core_principle`, `scope_control`, `ambiguity_policy`, `support_triggers`, `repository_assessment`, `task_triage`, `delegation_review`, `todo_discipline`, `completion_gate`, `failure_recovery`, `operations`, `templates`, `guardrails`, `heuristics`, `anti_patterns`, `examples`, `tool_skill_strategy`, `entry_point`, and `prompt_projection`.
- Legacy nested `execution_policy.*` is intentionally not used; execution-directing rules are represented as first-class profile fields.
- Prompt rendering is controlled by `prompt_projection` and produces the normal `## Team Contract` and `## Agent Contract` sections.

## Customization

No customization is required for real use. If copied as a starting point for a specialized Team, keep the same schema shape and adjust only mission, scope, roles, tools, and examples that are genuinely domain-specific.
