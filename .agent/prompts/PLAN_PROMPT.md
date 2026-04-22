# Plan Prompt

Use this prompt when creating or updating `PLAN.yaml` for CrewBee work.

## Goal
Produce a compact execution plan that is immediately actionable for the current repository state.

## Plan rules

1. Plan by deliverables, not dates.
2. Use 3-6 steps max for a single cycle.
3. Each step must have acceptance criteria that can be verified from files, diagnostics, builds, or tests.
4. Keep one active step at a time.
5. Reflect the aligned Team-first framework, Team template, and defined Team directories.

## Preferred step sequence

1. Understand or confirm target model.
2. Align typed framework contracts.
3. Update framework files, Team directories, and docs.
4. Validate with diagnostics/build/tests.
5. Hand off next implementation entry points.

## Acceptance-writing rules

- Write outcomes, not activities.
- Make each acceptance item observable.
- Mention the exact module or artifact family when possible.
- Prefer "exists / passes / is aligned / is exported / is documented" style checks.

## Example acceptance items

- `Team manifest/policy/profile contracts exist in src/core/`
- `Baseline Teams export aligned definitions from src/agent-teams/`
- `teams/template/ and teams/ directories reflect the current Team model`
- `Typecheck passes`
- `.agent prompts and handoff docs reference the current framework shape`
