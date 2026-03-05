# Architecture Overview

AgentScroll has four layers:

1. Core: shared contracts and spec definitions.
2. Packs: reusable agent/playbook bundles.
3. Adapters: host-specific integration bridges.
4. Manager: pack management and observability orchestration.

## Non-goal

AgentScroll does not implement a host runloop. Hosts execute tool calls and generate event streams.

## Host capability contract (minimum)

- Agent registration and switching
- Agent orchestration (serial or parallel)
- Runtime event stream export
- Tool domain injection
- Session log export
