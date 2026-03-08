# Project Charter

## Identity

- Project ID: `agentscroll`
- Project Name: `AgentScroll`
- Repository: `E:\1-Projects\AgentScroll`

## Objective

Define and ship a V1-ready Agent Team scaffold that frames AgentScroll as a portable Team system rather than a pack catalog. The scaffold must now be specific enough to support the next implementation cycle across three layers:

- typed framework contracts in `src/`
- file-based Team starter assets in `scaffold/`
- execution and planning guidance in `.agent/`

## Scope

### In scope

- Document the V1 product positioning around Agent Teams.
- Define the reduced V1 object model: Team, Adapter, Manager.
- Align the code scaffold to Team manifest, Team policy, shared capabilities, and agent profile concepts.
- Add a practical starter Team file tree that mirrors the intended authoring model.
- Add compact framework and planning prompts for future agent sessions.
- Clarify Team-internal concepts: Leader, members, built-in workflow, mode, tool boundaries.
- Capture V1 behavior rules such as manual Team selection and delegate-first execution.
- Keep scaffold docs aligned across `.agent` and top-level project docs.

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
- V1 design boundaries are explicit enough to guide scaffold evolution.
- Legacy Pack-first wording is removed or clearly marked as transitional.
- Behavior changes in code later must still meet typecheck and verification standards.
- The starter scaffold must be concrete enough to begin implementing Team loaders, adapters, and manager flows.

## Glossary

- Agent Team: The primary reusable execution unit, including Leader, members, default workflow, and operating constraints.
- Leader: The Team entry point responsible for intake, delegation, coordination, and convergence.
- Member: A specialized Team role normally hidden from direct user selection in V1.
- Mode: The V1 execution choice: `single-executor` or `team-collaboration`.
- Adapter: The host integration layer that maps Team definitions into a concrete runtime.
- Manager: The control layer for Team selection, configuration, and runtime visibility.
