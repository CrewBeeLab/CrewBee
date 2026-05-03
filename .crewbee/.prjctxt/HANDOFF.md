# Session Handoff

## Current Snapshot

- Active step: C1/S4.
- Latest product work productized the OpenCode user install path: `crewbee setup`, `crewbee update`, OpenCode CLI detection/optional install, config backup/rollback, doctor OpenCode health, install docs/READMEs, package scripts, and related tests.
- Latest repository hygiene update added `.local/` to ignore rules so local-only workspace artifacts do not appear as untracked files.
- Latest model/provider work implemented projection-time model resolution for OpenCode agents, expanded the default `crewbee.json` Coding Team model template, added `crewbee.json` per-agent model overrides/host-default fallback, and extended file-team `agent_runtime` fallback syntax.
- Latest cleanup after that work was behavior-equivalent: model-resolution candidate/trace logic is factored into clearer helpers, and built-in Coding Team runtime parameters are declared in an explicit profile map.
- Current provider/model flow: Team config and overrides flow through registration, Team Library, canonicalization, OpenCode projection, model resolver, and config hooks; resolver traces are available in doctor output.
- Current limitations: fallback happens during projection/config generation only; no runtime API-error retry loop. Real model availability filtering requires supplying an available-model catalog to projection/bootstrap.
- Recommended user install path is now `npx crewbee@latest setup --with-opencode`; existing install/uninstall compatibility paths still matter.
- Latest model/provider cleanup payload reported `npm run typecheck` passing and `npm test` passing with 90 passed, 0 failed; independent/read-only `coding-reviewer` review reported OKAY/no blocker.
- Earlier website copy work was not represented by implementation changes in the latest payload; confirm correct site workspace before acting on homepage copy requests.

## Exact Next Actions

1. For model/provider follow-up, do not claim runtime API-error fallback unless a later change adds actual retry behavior around LLM calls.
2. If catalog-aware fallback is needed, connect `availableModels` to a real OpenCode or Models.dev model catalog and add tests for catalog source handling.
3. For future model-resolution edits, preserve current fallback ordering and host-default semantics unless explicitly changing behavior and tests.
4. For install-flow follow-ups, keep `setup` as the user-facing path while preserving lower-level `install`, `uninstall`, and compatibility re-export behavior.
5. Keep config writes backed up/restorable and ensure doctor health continues to reflect OpenCode availability.
6. If asked to apply website copy, first locate and verify the actual homepage/site repository.
7. Treat `.local/` as intentionally ignored; ignore other unrelated local/untracked artifacts unless explicitly asked to clean them up.
