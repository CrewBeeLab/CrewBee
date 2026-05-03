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

## 2026-05-03: Make setup the productized OpenCode user install path

- State: accepted
- Context: The install UX needed a user-facing quick start that can handle missing OpenCode, install CrewBee into the OpenCode user-level workspace, write canonical config, and run diagnostics without modifying project repositories.
- Decision: Introduce `crewbee setup` as the recommended path (`npx crewbee@latest setup --with-opencode`), keep `crewbee update` as forced setup/reinstall, and keep existing install/uninstall commands and compatibility exports.
- Consequence: Future installation docs and support should lead with setup; lower-level install commands remain useful for local/development and compatibility flows.

## 2026-05-03: Treat OpenCode availability as part of setup and doctor health

- State: accepted
- Context: Installing CrewBee is not actionable if OpenCode is missing or an attempted OpenCode install does not leave `opencode` on PATH.
- Decision: Detect OpenCode during setup/doctor, require OpenCode availability for doctor health, and fail setup after an attempted OpenCode install if `opencode` still cannot be detected.
- Consequence: Some environments may need a new terminal or manual OpenCode install before setup can complete successfully.
