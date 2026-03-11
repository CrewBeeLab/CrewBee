# Project Charter

## Identity

- Project ID: `crewbee`
- Project Name: `CrewBee`
- Repository: `E:\1-Projects\CrewBee`

## Objective

Define and ship a V1-ready Team-first Agent System that frames CrewBee as a practical Team system rather than a pack catalog. The framework must now be specific enough to support the next implementation cycle across three layers:

- typed framework contracts in `src/`
- file-based Team definitions in `AgentTeams/` and reusable template assets in `AgentTeamTemplate/`
- execution and planning guidance in `.agent/`

## Scope

### In scope

- Document the V1 product positioning around Agent Teams.
- Define the reduced V1 object model: Team, Adapter, Manager.
- Align the code framework to Team manifest, Team policy, shared capabilities, and agent profile concepts.
- Add a practical Team template tree and concrete Team directories that mirror the intended authoring model.
- Add compact framework and planning prompts for future agent sessions.
- Clarify Team-internal concepts: Leader, members, built-in workflow, mode, tool boundaries.
- Capture V1 behavior rules such as manual Team selection and delegate-first execution.
- Keep framework docs aligned across `.agent` and top-level project docs.

### Out of scope

- Implementing full runtime orchestration.
- Automatic scene detection or automatic Team routing.
- A first-class Playbook system exposed to users.
- A heavy Artifact control plane.
- A standalone IDE or host runloop replacement.

## Constraints

- V1 must reduce user-facing complexity to `Team + Mode`.
- Team should be the primary entry point; internal members remain secondary.
- Playbook is internal to Team in V1, not a separate user-facing object.
- Documentation must stay implementation-oriented and avoid speculative features.

## Quality bar

- Canonical docs consistently use Team-first terminology.
- V1 design boundaries are explicit enough to guide framework evolution.
- Legacy Pack-first wording is removed or clearly marked as transitional.
- Behavior changes in code later must still meet typecheck and verification standards.
- The Team template and Team directories must be concrete enough to begin implementing Team loaders, adapters, and manager flows.

## Glossary

- Agent Team: The primary reusable execution unit, including Leader, members, default workflow, and operating constraints.
- Leader: The Team entry point responsible for intake, delegation, coordination, and convergence.
- Member: A specialized Team role normally hidden from direct user selection in V1.
- Mode: The V1 execution choice: `single-executor` or `team-collaboration`.
- Adapter: The host integration layer that maps Team definitions into a concrete runtime.
- Manager: The control layer for Team selection, configuration, and runtime visibility.
