# Starter Team

## Mission
Provide a minimal, leader-driven Agent Team that works cleanly in OpenCode-style environments.

## Leader
- `Leader`: receives the task, coordinates the Team, and reports the final result.

## Members
- `Researcher`: gathers context, sources, and file-level evidence.
- `Executor`: performs the implementation or execution work and validates the result.

## Default Workflow
1. Human gives the task to the Leader.
2. Leader clarifies, delegates, or executes directly.
3. Supporting agents work through Session Context.
4. Leader converges the result and reports back.

## Current Assumptions
- Session Context is the main collaboration medium.
- Explicit routing files are not required.
- Explicit contract files are not required.
- Long-running external state is out of scope.
