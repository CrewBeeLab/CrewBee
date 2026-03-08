# Session Handoff

## Current snapshot

- Active step: `S4`
- Run status: `success`
- Last checkpoint: `CP-0004`

## What changed this session

- Expanded the TypeScript scaffold to model Team manifests, Team policy, shared capabilities, and agent profiles.
- Rebuilt the baseline Coding, General, and Wukong teams on the aligned composed Team definition.
- Added `AgentTeamTemplate/` as the reusable Team template directory.
- Moved defined Team assets into `AgentTeams/`.
- Added `.agent/prompts/FRAMEWORK_PROMPT.md` and `.agent/prompts/PLAN_PROMPT.md`.
- Updated project docs and `.agent` docs so the next implementation cycle starts from the aligned model.

## Open blockers

- None

## Next session start checklist

1. Confirm `PLAN.yaml` active step and acceptance criteria.
2. Confirm `STATE.yaml` blockers and next actions.
3. Continue from first incomplete acceptance criterion.

## Exact next actions

1. Implement a loader that reads `AgentTeams/` and `AgentTeamTemplate/`-style assets into the typed `AgentTeamDefinition` model.
2. Add adapter-facing tests for Team selection, runtime binding, and event generation.
3. Start the OpenCode adapter using the aligned Team manifest/policy/profile model.

## References

- `.agent/PLAN.yaml`
- `.agent/STATE.yaml`
- `.agent/MEMORY_INDEX.md`
