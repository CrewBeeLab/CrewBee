# Framework Prompt

Use this prompt when extending the CrewBee engineering framework.

## Goal
Evolve the repository without drifting from the V1 Team-first model:

- primary objects: `Agent Team + Manager + Adapter`
- Team assets: `team.manifest.yaml`, `team.policy.yaml`, `shared-capabilities.yaml`, `agents/*.agent.md`, `docs/TEAM.md`
- collaboration: Leader-driven, Session Context first
- user-facing choice: `Team + Mode`

## Required alignment checks

1. Does the change preserve Team as the primary unit rather than individual agents or packs?
2. Does it keep Playbook internal to Team workflow rather than creating a new top-level object?
3. Does it preserve Leader-first coordination and delegate-first execution?
4. Does it avoid introducing heavyweight routing files or contract files unless the current work truly needs them?
5. Does it keep runtime state out of static agent or Team definitions?

## Preferred implementation shape

- Put reusable typed contracts in `src/core/`.
- Put baseline composed Team definitions in `src/agent-teams/`.
- Put host bridge logic in `src/adapters/`.
- Put selection/control/visibility logic in `src/manager/`.
- Mirror file-authored Team assets in `teams/` and `teams/template/`.

## Do

- Keep the model practical and OpenCode-first.
- Prefer small, explicit structures over abstract orchestration systems.
- Keep agent profiles split between persona core and responsibility core.
- Keep policy, capability bindings, and runtime selection clearly separated.

## Do not

- Reintroduce Pack-first naming as the primary mental model.
- Add speculative long-running state systems to the static framework.
- Mix runtime TODOs, session ids, or current error details into static Team or agent definitions.
