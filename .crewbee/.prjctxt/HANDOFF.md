# Session Handoff

## Current Snapshot

- Active step: C1/S3.
- Latest product work productized the OpenCode user install path: `crewbee setup`, `crewbee update`, OpenCode CLI detection/optional install, config backup/rollback, doctor OpenCode health, install docs/READMEs, package scripts, and related tests.
- Recommended user install path is now `npx crewbee@latest setup --with-opencode`; existing install/uninstall compatibility paths still matter.
- Payload showed verification commands were run for typecheck, build, node tests, and npm test, but exact result output was unavailable to this maintainer after runtime payload cleanup; rerun before reporting current pass/fail.
- Earlier website copy work was not represented by implementation changes in the latest payload; confirm correct site workspace before acting on homepage copy requests.

## Exact Next Actions

1. For install-flow follow-ups, keep `setup` as the user-facing path while preserving lower-level `install`, `uninstall`, and compatibility re-export behavior.
2. Rerun `npm run typecheck`, `npm run build`, and `npm test` before claiming verification status.
3. Keep config writes backed up/restorable and ensure doctor health continues to reflect OpenCode availability.
4. If asked to apply website copy, first locate and verify the actual homepage/site repository.
5. Ignore unrelated local/untracked artifacts unless explicitly asked to clean them up.
