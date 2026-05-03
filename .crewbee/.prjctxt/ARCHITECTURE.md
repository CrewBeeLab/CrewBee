# Architecture

## System Map

- CrewBee is a TypeScript npm package (`crewbee`) that builds an OpenCode plugin and CLI from source into `dist`.
- Core profile documents are loaded, normalized, projected, planned, and structurally rendered into prompts.
- OpenCode adapter prompt construction keeps adapter-specific responsibilities: composing Team Contract + Agent Contract and applying OpenCode/runtime collaboration projection.
- Generic prompt rendering pipeline now lives in the render layer via `renderLoadedPromptDocument` and `renderNormalizedPromptDocument`.
- Install/uninstall CLI behavior delegates package side effects to the install layer; package root resolution remains in plugin-entry helpers.
- OpenCode config file read/write and CrewBee plugin entry maintenance are isolated in the install layer behind a clearer config-file module, with the older config-writer path retained as a compatibility boundary.
- OpenCode adapter defaults, including the default execution mode, are centralized in the adapter defaults module and shared by config and chat hooks.
- Embedded coding team agent definitions use a small profile/binding builder and preserve compatibility through old helper re-exports.

## Current Boundary Notes

- `src/render/prompt-document-renderer.ts` owns normalize/catalog/projection/plan/render orchestration for profile documents.
- `src/adapters/opencode/prompt-builder.ts` should not duplicate the generic render pipeline; it should focus on OpenCode-facing prompt assembly.
- `src/install/package-installation.ts` owns npm install/uninstall and legacy cleanup side effects.
- `src/install/opencode-config-file.ts` owns OpenCode config JSONC loading/writing and plugin entry migration/removal helpers.
- `src/install/config-writer.ts` remains a compatibility re-export boundary.
- `src/install/package-manager.ts` remains a compatibility re-export boundary.
- `src/adapters/opencode/defaults.ts` owns OpenCode adapter default constants; hooks should import shared defaults rather than hard-code values.
- `src/agent-teams/embedded/coding-team/agent-profile-builder.ts` owns embedded profile and collaboration binding construction.
- `src/agent-teams/embedded/coding-team/agent-helpers.ts` remains a compatibility re-export boundary.
