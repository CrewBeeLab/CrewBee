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

## Template

Use this format for new records:

```text
## D-XXXX
- Status: proposed|accepted|deprecated
- Context: ...
- Decision: ...
- Consequences: ...
```
