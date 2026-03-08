# Architecture Overview

AgentScroll V1 is intentionally narrowed to three primary objects:

1. Agent Team: the main execution unit exposed to users.
2. Adapter: the host integration bridge.
3. Manager: Team selection, configuration, and runtime visibility.

Internally, a Team contains its own Leader, members, default workflow, tool boundaries, and output expectations. V1 does not expose Playbook as a separate first-class object.

## V1 design stance

- Team is the task-scene entry point; `scene` is implied by Team rather than exposed as a separate primary object.
- User-facing selection is `Team + Mode`.
- Mode is limited to `single-executor` and `team-collaboration`.
- Leader defaults to `delegate first` rather than self-execution.
- Artifact is retained only as a lightweight output and verification concern.

## Module responsibilities

- `src/core`: Team-oriented contracts, specs, and shared runtime types.
- `src/teams`: baseline Team library definitions, including Team manifest/policy/capability/profile composition.
- `src/adapters`: host-specific integration contracts plus runtime-binding helpers for future adapters.
- `src/manager`: Team installation, enable/disable, selection, and runtime-plan scaffolding.
- `scaffold/agent-team-starter`: file-based starter assets that mirror the intended Team authoring model.

## Static Team asset model

AgentScroll now models the Team authoring surface around five static assets:

1. `team.manifest.yaml`: Team identity, leader/member structure, workflow, and operating assumptions.
2. `team.policy.yaml`: Team-shared rules, approvals, quality floor, and forbidden actions.
3. `shared-capabilities.yaml`: shared model/tool/skill/instruction/memory/hook references.
4. `agents/*.agent.md`: per-agent profile files with metadata, persona core, responsibility core, collaboration, and capability bindings.
5. `docs/TEAM.md`: human-readable Team summary.

This matches the simplified Team-first V1 design: Leader-driven coordination, Session Context as the collaboration medium, and no heavy routing or contract-file system.

## Runtime bridge

The current TypeScript scaffold mirrors those static assets in code:

- `TeamManifest`, `TeamPolicy`, `SharedCapabilities`, and `AgentProfileSpec` define the authoring model.
- `AgentTeamDefinition` composes those assets into a runtime-loadable Team unit.
- `Manager` selects Teams and modes from the composed library.
- `Adapter` binds a selected Team into host runtime state without owning the host runloop.

## Non-goal

AgentScroll does not implement a host runloop. Hosts execute tool calls, manage sessions, and emit runtime events.

## Host capability contract (minimum)

- Register or switch Agent definitions
- Support single-executor operation and basic team collaboration
- Export runtime event stream or equivalent logs
- Inject tool domains and Team-level rules
- Accept external Team runtime configuration
- Export session logs for basic traceability
