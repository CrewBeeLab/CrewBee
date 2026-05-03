# Implementation Snapshot

## What Works

- Package scripts include `typecheck`, `build`, and full Node test execution via `npm test`.
- OpenCode prompt generation composes rendered team and agent contracts while delegating generic profile rendering to `src/render/prompt-document-renderer.ts`.
- Install and uninstall commands retain public behavior while importing implementation from `src/install/package-installation.ts` through compatibility exports.
- OpenCode config read/write and plugin entry migration/removal now live in `src/install/opencode-config-file.ts`; `src/install/config-writer.ts` remains a re-export compatibility path.
- OpenCode config and chat hooks share `DEFAULT_OPENCODE_EXECUTION_MODE` from `src/adapters/opencode/defaults.ts`; the value remains `single-executor`.
- Embedded coding-team agent modules retain their existing helper names through `agent-helpers.ts`, backed by clearer builder names in `agent-profile-builder.ts`.
- Recent refactors were intended to be behavior-equivalent: no function signatures, CLI behavior, config format, plugin exports, or compatibility paths were intentionally changed.

## Verification Commands

- 2026-04-29: `npm run typecheck` passed.
- 2026-04-29: `npm run build` passed.
- 2026-04-29: `npm test` passed; reported 83/83 tests passing.
- 2026-04-29: After the OpenCode config/defaults cleanup, `npm run typecheck`, `npm run build`, and `npm test` passed; tests again reported 83/83 passing.

## Working Tree Notes

- Recent code changes touched OpenCode prompt rendering, adapter default constants, embedded coding team agent helper imports, install/package-manager boundaries, and OpenCode config-file helpers.
- Latest update payload recorded no product-code edits or verification for the website copy request; do not treat the request as implemented in this repository.
- There are pre-existing/unrelated untracked local artifacts and Project Context scaffold changes in the working tree; do not treat them as product implementation state.
- Current status also showed deleted legacy context files and untracked local/scaffold/image artifacts; preserve user changes and avoid cleanup unless explicitly requested.
- Git warned that two existing coding-team agent files may have CRLF converted to LF on next Git touch; no functional impact was reported.
