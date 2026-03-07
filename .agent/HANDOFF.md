# Session Handoff

## Current snapshot

- Active step: `S2`
- Run status: `running`
- Last checkpoint: `CP-0002`

## What changed this session

- Reframed the scaffold docs around the V1 Team-first model: `Agent Team + Manager + Adapter`.
- Added baseline Team-first TypeScript contracts and a starter Team library under `src/teams`.
- Marked `src/packs` as a transitional compatibility entrypoint instead of the primary model.

## Open blockers

- None

## Next session start checklist

1. Confirm `PLAN.yaml` active step and acceptance criteria.
2. Confirm `STATE.yaml` blockers and next actions.
3. Continue from first incomplete acceptance criterion.

## Exact next actions

1. Decide whether to rename `src/packs` to `src/teams` in code, not just in docs.
2. Expand `TeamSpec` into a fuller configuration model with role definitions and verification expectations.
3. Add the first adapter-facing and manager-facing tests once runtime behavior is implemented.

## References

- `.agent/PLAN.yaml`
- `.agent/STATE.yaml`
- `.agent/MEMORY_INDEX.md`
