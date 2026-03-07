# Agent Quickstart

## Goal

Start from the compact `.agent` execution view, then jump into the Team-first V1 scaffold with minimal discovery cost.

## Read order (strict)

1. `.agent/HANDOFF.md`
2. `.agent/PLAN.yaml`
3. `.agent/ARCHITECTURE.md`
4. `README.md`
5. `docs/architecture.md`

## Execute rules

- Work only on the active step in `PLAN.yaml` (`doing`)
- Keep `PLAN.yaml` and `STATE.yaml` consistent
- Log major choices in `DECISIONS.md`
- Keep `MEMORY_INDEX.md` high-signal only

## No-time planning rule

- Do not plan by calendar date
- Advance by `cycle`, `step_id`, and `checkpoint`

## Human/Agent doc contract

- Canonical long-form docs are human-facing
- `.agent/` files are compact execution views
- Link to canonical docs instead of duplicating long text
- Current canonical design direction is Team-first V1, not Pack-first scaffolding

## Session done checklist

1. Move completed acceptance items to done
2. Update blockers and next actions in `STATE.yaml`
3. Rewrite `HANDOFF.md` with exact next steps
