# Memory Index

Store only high-signal memory for cross-session continuity.

## Entry format

- ID: `M-0001`
- Type: `decision|bugfix|discovery|risk|rule`
- Summary: short actionable statement
- Affects: modules/domains impacted
- References: file paths

## Entries

- ID: `M-0001`
  - Type: `decision`
  - Summary: "Use optimistic concurrency for all shared-state writes"
  - Affects: `api`, `sync`
  - References: `docs/architecture.md`, `.agent/DECISIONS.md`

- ID: `M-0002`
  - Type: `decision`
  - Summary: "V1 is Team-first: Agent Team + Manager + Adapter, with Team + Mode as the main user-facing choice"
  - Affects: `docs`, `.agent`, `framework terminology`
  - References: `README.md`, `docs/architecture.md`, `.agent/PROJECT.md`, `.agent/ARCHITECTURE.md`, `.agent/DECISIONS.md`

- ID: `M-0003`
  - Type: `decision`
  - Summary: "The executable framework shape is composed Team assets: manifest, policy, shared capabilities, and agent profiles, mirrored by AgentTeams and AgentTeamTemplate directories"
  - Affects: `src/core`, `src/AgentTeams`, `AgentTeams`, `AgentTeamTemplate`, `.agent`
  - References: `src/core/index.ts`, `src/AgentTeams/index.ts`, `AgentTeamTemplate/team.manifest.yaml`, `.agent/prompts/FRAMEWORK_PROMPT.md`
