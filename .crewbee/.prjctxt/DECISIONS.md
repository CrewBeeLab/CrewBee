# Decisions

## 2026-04-29: Keep adapter prompt assembly separate from generic document rendering

- State: accepted
- Context: Prompt rendering logic was duplicated in the OpenCode adapter.
- Decision: Put normalize -> catalog -> projection -> plan -> render orchestration in the render layer and keep the OpenCode adapter responsible for Team/Agent Contract assembly plus runtime collaboration projection.
- Consequence: Future prompt rendering changes should usually be made in the render layer, not duplicated per adapter.

## 2026-04-29: Preserve compatibility wrappers during responsibility-oriented refactors

- State: accepted
- Context: Internal modules were renamed toward clearer responsibilities for package installation and embedded agent profile construction.
- Decision: Keep old module paths as re-export compatibility boundaries when moving implementation to clearer files.
- Consequence: Deep internal imports remain lower risk while new code can import from the clearer responsibility modules.

## 2026-04-29: Centralize OpenCode adapter defaults and config-file responsibilities

- State: accepted
- Context: OpenCode execution mode and install config-file handling were spread across adapter/install modules with less precise names.
- Decision: Keep default adapter constants in the OpenCode adapter defaults module, and keep OpenCode config file read/write plus plugin entry maintenance in the install config-file module.
- Consequence: Future OpenCode default changes should update the shared defaults module; future config-file behavior should prefer the clearer config-file module while preserving compatibility exports.
