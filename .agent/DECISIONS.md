# Decisions (ADR-lite)

## D-0001

- Status: accepted
- Context: Multiple agents may write shared state.
- Decision: Use version-token optimistic concurrency with deterministic merge/retry.
- Consequences:
  - Pros: prevents silent overwrite
  - Cons: requires conflict handling path

## D-0002

- Status: accepted
- Context: Early scaffold docs framed AgentScroll around Pack and Playbook concepts, which increases V1 complexity and weakens the intended product boundary.
- Decision: Reframe V1 around `Agent Team + Manager + Adapter`, fold Playbook into Team as an internal workflow concept, and reduce the primary user-facing selection to `Team + Mode`.
- Consequences:
  - Pros: clearer V1 scope, simpler docs, lower implementation ambiguity, easier host mapping
  - Cons: legacy `packs` naming may temporarily remain in the filesystem until code structure catches up

## D-0003

- Status: accepted
- Context: The repo had Team-first positioning, but the implementation scaffold still lacked a concrete authoring model for Team manifests, Team policy, shared capabilities, and agent profiles. Future sessions also lacked explicit framework/planning prompts.
- Decision: Align the scaffold around a composed Team definition (`manifest + policy + sharedCapabilities + agents`) in `src/`, add a file-based starter Team under `scaffold/agent-team-starter/`, and add `.agent` prompts for framework evolution and planning.
- Consequences:
  - Pros: the repo is now ready for Team loaders, OpenCode mapping, and manager flow implementation without inventing the model again
  - Cons: there is more static scaffold surface to keep synchronized as the framework evolves

## Template

Use this format for new records:

```text
## D-XXXX
- Status: proposed|accepted|deprecated
- Context: ...
- Decision: ...
- Consequences: ...
```
