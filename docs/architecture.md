# Architecture Overview

AgentScroll V1 is intentionally narrowed to three primary objects:

1. Agent Team: the main execution unit exposed to users.
2. Adapter: the host integration bridge.
3. Manager: Team selection, configuration, and runtime visibility.

Internally, a Team contains its own Leader, members, default workflow, tool boundaries, and output expectations. V1 does not expose Playbook as a separate first-class object.

## V1 design stance

- Team is the scene entry point.
- User-facing selection is `Team + Mode`.
- Mode is limited to `single-executor` and `team-collaboration`.
- Leader defaults to `delegate first` rather than self-execution.
- Artifact is retained only as a lightweight output and verification concern.

## Module responsibilities

- `src/core`: Team-oriented contracts, specs, and shared runtime types.
- `src/teams`: baseline Team library definitions and Team-first exports.
- `src/packs`: legacy scaffold location kept temporarily; expected to hold Team-library assets until renamed.
- `src/adapters`: host-specific integration contracts plus runtime-binding helpers for future adapters.
- `src/manager`: Team installation, enable/disable, selection, and runtime-plan scaffolding.

## Non-goal

AgentScroll does not implement a host runloop. Hosts execute tool calls, manage sessions, and emit runtime events.

## Host capability contract (minimum)

- Register or switch Agent definitions
- Support single-executor operation and basic team collaboration
- Export runtime event stream or equivalent logs
- Inject tool domains and Team-level rules
- Accept external Team runtime configuration
- Export session logs for basic traceability
