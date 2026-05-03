# CrewBee Context Quickstart

Project Context initialization, prepare, and update are automatic. Use `project_context_search` only as a rare fallback when auto init/prepare/update still leave a concrete historical project-context gap that blocks the task.

On first startup, the plugin creates this scaffold if required files are missing and delegates the hidden maintainer to initialize it from project docs, architecture/design notes, tests, package metadata, and main source implementation.
