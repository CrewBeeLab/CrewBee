# Agent Quickstart

## Goal

Start from the compact `.agent` execution view, then jump into the Team-first V1 framework with minimal discovery cost.

## Read order (strict)

1. `.agent/HANDOFF.md`
2. `.agent/PLAN.yaml`
3. `.agent/ARCHITECTURE.md`
4. `.agent/prompts/FRAMEWORK_PROMPT.md`
5. `.agent/prompts/PLAN_PROMPT.md`
6. `README.md`
7. `docs/architecture.md`

## Execute rules

- Work only on the active step in `PLAN.yaml` until its acceptance is complete
- Keep `PLAN.yaml` and `STATE.yaml` consistent
- Log major choices in `DECISIONS.md`
- Keep `MEMORY_INDEX.md` high-signal only
- Prefer extending the aligned Team asset model over inventing parallel config shapes

## No-time planning rule

- Do not plan by calendar date
- Advance by `cycle`, `step_id`, and `checkpoint`

## Human/Agent doc contract

- Canonical long-form docs are human-facing
- `.agent/` files are compact execution views
- Link to canonical docs instead of duplicating long text
- Current canonical design direction is Team-first V1, not Pack-first scaffolding
- Use `teams/template/` as the default reference shape for file-authored Teams

## Session done checklist

1. Move completed acceptance items to done
2. Update blockers and next actions in `STATE.yaml`
3. Rewrite `HANDOFF.md` with exact next steps
4. Keep `.agent/prompts/*` aligned with any framework changes
