# Implementation Snapshot

## What Works

- Package scripts include `typecheck`, `build`, and full Node test execution via `npm test`.
- OpenCode prompt generation composes rendered team and agent contracts while delegating generic profile rendering to `src/render/prompt-document-renderer.ts`.
- Install and uninstall commands retain public behavior while importing implementation from `src/install/package-installation.ts` through compatibility exports.
- OpenCode config read/write and plugin entry migration/removal now live in `src/install/opencode-config-file.ts`; `src/install/config-writer.ts` remains a re-export compatibility path.
- Productized installation now centers on `crewbee setup` / `npx crewbee@latest setup --with-opencode`, with `crewbee update` as a forced setup/reinstall path and `crewbee uninstall` as an alias alongside `uninstall:user`.
- Setup detects OpenCode, can install it via the official npm package path when `--with-opencode` is used, installs CrewBee from `crewbee@latest` or `crewbee@next`, writes the canonical OpenCode plugin entry, and optionally runs doctor checks.
- OpenCode config changes are backed up before install/uninstall writes and can be restored on failure; backup helpers are exported through the install index and legacy config-writer compatibility path.
- Doctor output now includes OpenCode detection/version details, and doctor health requires OpenCode to be available in PATH.
- OpenCode config and chat hooks share `DEFAULT_OPENCODE_EXECUTION_MODE` from `src/adapters/opencode/defaults.ts`; the value remains `single-executor`.
- Embedded coding-team agent modules retain their existing helper names through `agent-helpers.ts`, backed by clearer builder names in `agent-profile-builder.ts`.
- Recent setup/install work intentionally changed the recommended user-facing install path and documentation, while preserving compatibility paths for existing install/uninstall internals and exports.
- Repository ignore rules now include `.local/` for local-only workspace artifacts.
- An internal documentation note records the earlier Agent Team provider/model configuration state and remains useful historical baseline for fallback/provider-selection work; it was intentionally kept out of user-facing guide docs.
- Built-in Coding Team model defaults are now explicit constants and are expanded into the default `crewbee.json` template with `model_preset`, `fallback`, `fallback_to_host_default`, and per-agent model entries.
- `crewbee.json` Team entries support model config overrides for per-agent models and host-default fallback behavior; overrides are normalized during filesystem team registration, preserved through library loading, and canonicalized with agent ID aliases.
- OpenCode projection now uses a model resolver that records resolution traces and can choose user overrides, manifest runtime, manifest `$default`, builtin role fallback, or `host-default`. Available-model filtering is supported when an available model list is supplied.
- File-based Team `agent_runtime` accepts optional provider, `provider/model` model strings, `$default`, `fallback_models`, and `fallback_to_host_default`.
- Doctor now includes model-resolution trace output.
- Model resolution implementation has been responsibility-cleaned without semantic change: runtime model ID normalization, candidate construction, unique candidate appending, host-default trace creation, and candidate trace projection are split into named helpers in the OpenCode model-resolution layer.
- Embedded Coding Team runtime parameters are now held in an explicit per-agent runtime profile map instead of nested inline conditional expressions; current values remain agent-specific and include the long-context variant for the coding leader.
- Internal 0.1.12 release-notes source material now summarizes 0.1.10-to-current changes across setup/update install UX, OpenCode detection/config backup/rollback, user-level package workspace, Coding Team model defaults/overrides/fallback, doctor diagnostics, docs, tests, and release caveats.

## Verification Commands

- 2026-04-29: `npm run typecheck` passed.
- 2026-04-29: `npm run build` passed.
- 2026-04-29: `npm test` passed; reported 83/83 tests passing.
- 2026-04-29: After the OpenCode config/defaults cleanup, `npm run typecheck`, `npm run build`, and `npm test` passed; tests again reported 83/83 passing.
- 2026-05-03: Update payload recorded verification commands invoked for productized setup work: `npm run typecheck`, `npm run build`, `node --test tests/**/*.test.mjs`, and `npm test`. Exact result output was not available to this maintainer after the payload was cleaned up, so rerun before claiming current pass/fail.
- 2026-05-03: `.gitignore` update was checked by the parent session with `git status --short`; it reported only the `.gitignore` modification and no untracked `.local/` entry.
- 2026-05-03: Agent Team provider/model current-state documentation update reported `npm run typecheck`, `npm run build`, and `npm test` passing; `npm test` reported 87 passed, 0 failed. The parent session also reported a read-only coding-reviewer review as OKAY with no blocker.
- 2026-05-03: Built-in Coding Team model override/fallback implementation reported `npm run typecheck` passing and `npm test` passing with 90 passed, 0 failed. Parent session also reported independent `coding-reviewer` review as OKAY with no blocker.
- 2026-05-03: Behavior-equivalent model-resolution/runtime-profile cleanup reported `npm run typecheck` passing and `npm test` passing with 90 passed, 0 failed. Parent session also reported read-only `coding-reviewer` review as OKAY with no blocker.
- 2026-05-03: Internal 0.1.12 release-notes basis was reviewed read-only by `coding-reviewer`; parent session reported OKAY with no blocker. No command/test verification was recorded for this documentation-only change.

## Working Tree Notes

- Recent code changes touched OpenCode prompt rendering, adapter default constants, embedded coding team agent helper imports, install/package-manager boundaries, and OpenCode config-file helpers.
- Latest product changes touched install/setup CLI modules, OpenCode CLI detection, config backup/rollback, doctor output/health semantics, install/uninstall results, package scripts, install docs, READMEs, and related install/CLI tests.
- The earlier website copy request remains unrelated to the latest recorded productized install work; do not treat site copy as implemented unless a later payload records website changes.
- There are pre-existing/unrelated untracked local artifacts and Project Context scaffold changes in the working tree; do not treat them as product implementation state.
- Current status also showed deleted legacy context files and untracked local/scaffold/image artifacts; `.local/` is now intentionally ignored, but preserve other user changes and avoid cleanup unless explicitly requested.
- Git warned that two existing coding-team agent files may have CRLF converted to LF on next Git touch; no functional impact was reported.
- Latest product change implemented projection-time model override/fallback for built-in and file-based Teams, added model resolution traces to doctor output, updated the default CrewBee config template, and added model fallback tests. `.gitignore` was also touched by prior/internal-doc hygiene in this working tree.
- Latest cleanup touched only the OpenCode model-resolution helper structure and embedded Coding Team runtime-profile expression style; it was reported as behavior-equivalent and did not change config formats, fallback strategy, or OpenCode projection semantics.
- Latest documentation work added internal release-notes basis material for the upcoming 0.1.12 release and updated ignore rules so that internal document can be tracked; package metadata was still reported as 0.1.11 and must be bumped during release.
