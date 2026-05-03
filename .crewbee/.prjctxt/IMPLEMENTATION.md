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

## Verification Commands

- 2026-04-29: `npm run typecheck` passed.
- 2026-04-29: `npm run build` passed.
- 2026-04-29: `npm test` passed; reported 83/83 tests passing.
- 2026-04-29: After the OpenCode config/defaults cleanup, `npm run typecheck`, `npm run build`, and `npm test` passed; tests again reported 83/83 passing.
- 2026-05-03: Update payload recorded verification commands invoked for productized setup work: `npm run typecheck`, `npm run build`, `node --test tests/**/*.test.mjs`, and `npm test`. Exact result output was not available to this maintainer after the payload was cleaned up, so rerun before claiming current pass/fail.

## Working Tree Notes

- Recent code changes touched OpenCode prompt rendering, adapter default constants, embedded coding team agent helper imports, install/package-manager boundaries, and OpenCode config-file helpers.
- Latest product changes touched install/setup CLI modules, OpenCode CLI detection, config backup/rollback, doctor output/health semantics, install/uninstall results, package scripts, install docs, READMEs, and related install/CLI tests.
- The earlier website copy request remains unrelated to the latest recorded productized install work; do not treat site copy as implemented unless a later payload records website changes.
- There are pre-existing/unrelated untracked local artifacts and Project Context scaffold changes in the working tree; do not treat them as product implementation state.
- Current status also showed deleted legacy context files and untracked local/scaffold/image artifacts; preserve user changes and avoid cleanup unless explicitly requested.
- Git warned that two existing coding-team agent files may have CRLF converted to LF on next Git touch; no functional impact was reported.
