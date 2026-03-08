# Architecture Summary

## System map

```text
user -> Manager -> selected Agent Team -> Adapter -> host runtime
                          |
                          +-> mode selection (single-executor | team-collaboration)

Agent Team -> manifest + policy + shared-capabilities + agent profiles + TEAM.md
```

## Module responsibilities

- `src/core`: shared Team-oriented contracts for manifests, policies, capabilities, agent profiles, and runtime selection.
- `src/teams`: baseline Team library definitions for Coding, General, and Wukong.
- `src/adapters`: host capability mapping, Team injection, and runtime event/log integration.
- `src/manager`: Team selection, configuration, status visibility, and debug-friendly control surface.
- `scaffold/agent-team-starter`: file-authored starter Team aligned to the intended authoring model.
- `.agent/prompts`: compact prompts for framework evolution and implementation planning.

## V1 object model

1. `Agent Team`: the primary execution object, composed from manifest + policy + shared capabilities + agent profiles.
2. `Adapter`: the bridge into OpenCode, Codex, ClaudeCode, or similar hosts.
3. `Manager`: the control and visibility layer.

Within a Team, V1 expects:

- Team name and positioning
- Leader
- Members and role boundaries
- One built-in workflow
- Shared policy and capabilities
- Agent profile metadata, persona core, and responsibility core
- Tool and capability boundaries
- Output and verification expectations

## Execution flow

1. User selects a Team manually.
2. User selects a Mode manually.
3. Manager resolves the Team configuration.
4. Leader receives the task and applies delegate-first routing.
5. Team runs in single-executor or team-collaboration mode.
6. Adapter maps the Team behavior into host-specific runtime constructs.
7. Manager shows basic runtime state and recent actions.

## Key invariants

- Team is the main user-facing selection unit.
- User-facing choice set is constrained to `Team + Mode`.
- Playbook is internalized as Team workflow in V1.
- Artifact is lightweight and not a control-plane centerpiece.
- Leader defaults to delegation before self-execution.
- AgentScroll does not own the host runloop.

## Failure handling

- If a host lacks full multi-agent support, degrade to Leader-mediated serial execution.
- Preserve Team semantics even when collaboration is approximated by the host.
- Keep runtime visibility minimal but sufficient: Team, mode, active executor, stage, recent actions.

## References

- `README.md`
- `docs/architecture.md`
- `scaffold/agent-team-starter/team.manifest.yaml`
- `.agent/prompts/FRAMEWORK_PROMPT.md`
- `.agent/prompts/PLAN_PROMPT.md`
- `.agent/DECISIONS.md`
