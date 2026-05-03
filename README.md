# CrewBee

[English](README.md) | [简体中文](README.zh-CN.md)

<p align="center">
  <img src="assets/crewbee-intro.png" alt="Turn scattered agents into real teams" width="100%" />
</p>

<p align="center"><strong>An Agent Team framework for OpenCode.</strong></p>

CrewBee lets you design different **Agent Teams** for different tasks or projects, and switch flexibly between **single-agent execution** and **multi-agent collaboration** based on task complexity.

It is not a prompt pack or a forced multi-agent ritual. CrewBee turns agent roles, collaboration patterns, context management, review flow, completion criteria, and host adaptation into maintainable, runnable, and reusable Team engineering assets.

**Current focus:** make Team-level agent systems clearly definable, projectable across host runtimes, and runnable inside OpenCode.

---

## Why CrewBee

* **Design different Agent Teams for different tasks or projects** — Different work can have different roles, rules, workflows, and completion criteria.
* **Switch between single-agent and multi-agent collaboration based on task complexity** — Keep simple tasks fast and lightweight; use Team collaboration, support agents, review, and verification for complex tasks.
* **Keep the main agent as the owner of the most complete context** — The main agent holds the user goal, project constraints, support findings, review feedback, and verification results, so key decisions are based on fuller evidence.
* **Use context-isolated delegation** — Support agents work in dedicated contexts for exploration, research, and review, then return high-signal findings to the main agent. This reduces the main agent’s context and attention load.
* **Built-in mature Coding Team** — CrewBee includes a Coding Team with clear role responsibilities, review flow, and completion criteria for development, debugging, refactoring, and verification work.
* **Project Context direction across sessions** — Next, CrewBee will strengthen automatically maintained project context, so long-running projects can keep summaries of project positioning, framework design, history, current state, and plans across sessions.
* **Copyable, modifiable, and contributable Team templates** — Teams are engineering assets that can be refined, versioned, and shared.

CrewBee has already completed the **CrewBee → OpenCode** MVP path:

* Host-agnostic Team / Agent definitions
* Team Library assembly and validation
* Runtime Projection and formal leader default selection
* OpenCode agent config projection, aliases, config patches, and session binding
* OpenCode plugin entry, delegation tools, event wiring, and system prompt injection
* Local build, user-level installation, doctor checks, and uninstall flow

> Simple mental model:
>
> **CrewBee = Agent Team definition framework + Runtime Projection layer + Host adapter layer, currently for OpenCode**

---

## Quick Links

* [CrewBeeLab Website](https://crewbeelab.github.io)
* [Installation Guide](docs/guide/installation.md)
* [Custom Agent Team Guide](docs/guide/custom-agent-team.en.md)
* [Project-level Team Configuration Guide](docs/guide/project-team-config.en.md)
* [Release Guide](docs/guide/release.md)

For Chinese documentation, start from [README.zh-CN.md](README.zh-CN.md) and the Chinese guide files under `docs/guide`.

---

## Agent IDs in OpenCode

CrewBee uses a single **canonical agent id** across projection, default selection, session binding, delegation, and user-visible names.

Examples:

* `coding-leader`
* `coding-executor`
* `coding-reviewer`

The same id is used for OpenCode `default_agent`, explicitly selected agents in a session, delegation targets, and user-visible runtime / config ids.

---

## Table of Contents

* [What CrewBee Is](#what-crewbee-is)
* [What CrewBee Solves](#what-crewbee-solves)
* [Core Features](#core-features)
* [Installation](#installation)
* [Quick Start](#quick-start)
* [Agent Team and Agent Profile Definitions](#agent-team-and-agent-profile-definitions)
* [How the OpenCode Runtime Works](#how-the-opencode-runtime-works)
* [Built-in Coding Team Design](#built-in-coding-team-design)
* [Next: Project Context](#next-project-context)
* [Configuration, Installation, and Operations Scripts](#configuration-installation-and-operations-scripts)
* [Uninstall](#uninstall)
* [Acknowledgements](#acknowledgements)

---

## What CrewBee Is

CrewBee is an Agent Team framework for real host runtimes.

In CrewBee, the first-class object is not a single Agent, but a **Team**. A Team is not a concatenation of prompt fragments. It is a structured definition unit that includes at least:

* Team identity and positioning
* formal leader
* members
* workflow
* Team-level shared rules
* Agent Profiles
* Prompt Projection
* host runtime mapping

CrewBee aims to turn scattered agent prompts, rules, and collaboration conventions into maintainable, portable, and runnable Team assets.

The current usage model is:

* The user selects a Team entry agent in the host runtime.
* CrewBee projects the Team definition into the host runtime in a stable way.
* At runtime, CrewBee preserves Team semantics through session binding, delegation, and system prompt injection.

CrewBee does not currently force automatic Team selection or automatically decide the organization structure for every task. It first focuses on making Team definitions, Team projection, runtime binding, and OpenCode adaptation solid.

---

## What CrewBee Solves

CrewBee mainly solves seven problems.

### 1. Design different Agent Teams for different tasks or projects

Coding, research, writing, analysis, marketing, and long-running project maintenance are not the same kind of work. They need different role structures, working rules, tool boundaries, review flows, and completion criteria.

CrewBee lets you design different Agent Teams for different tasks or projects instead of using one increasingly long general-purpose prompt for everything.

### 2. Switch flexibly between single-agent and multi-agent collaboration based on task complexity

Simple tasks need fast responses, fewer tokens, and fewer steps. Complex tasks need support agents, independent review, verification, and clearer completion gates.

CrewBee is not designed to turn every task into multi-agent collaboration by default. It is designed to choose the right execution mode based on task complexity.

### 3. Keep the main agent as the owner of the most complete context

In complex tasks, codebase exploration, external research, review, and verification may all produce important information.

CrewBee keeps the main agent / formal leader as the owner of the most complete task context. The main agent collects the user goal, project constraints, support findings, review feedback, and verification results before making key decisions and closing the task.

### 4. Reduce the main agent’s context and attention load through context-isolated delegation

Complex work should not dump every search trace, side exploration, failed path, and low-signal detail into the main agent’s context.

CrewBee uses delegation so support agents can work in dedicated contexts for codebase exploration, research, review, or multimodal interpretation, then return high-signal findings to the main agent. This reduces main-context pollution and the main agent’s attention load.

### 5. Built-in mature Coding Team with review flow and completion criteria

Coding tasks need more than code generation. They need codebase exploration, external research, independent review, verification evidence, and completion criteria.

CrewBee’s built-in Coding Team uses direct responsibility-based role names and emphasizes review and completion criteria, helping complex coding tasks reach a more reliable closure.

### 6. Project Context direction across sessions

Long-running projects should not require the user to re-explain project positioning, framework design, history, current state, and next steps every time a new session starts.

CrewBee’s next stage will strengthen automatically maintained Project Context, so agents can use project summaries to read code heuristically and reduce the context cost of repeatedly scanning the whole codebase.

### 7. Copyable, modifiable, and contributable Team templates

A Team is not just internal configuration. It is an engineering asset that can be copied, modified, versioned, and contributed.

This lets users start from built-in Teams or templates, then gradually build their own agent workflows.

---

## Core Features

### 1. Design different Agent Teams for different tasks or projects

CrewBee treats Team as a first-class object rather than focusing only on scattered agent prompts.

A Team can have its own:

* task positioning
* default entry agent
* member responsibilities
* workflow
* shared rules
* tool boundaries
* review flow
* completion criteria
* output style

This means you can design different Teams for different tasks or projects, such as:

* `CodingTeam`: development, fixing, debugging, refactoring, verification
* `GeneralTeam`: research, analysis, writing, planning
* `ResearchOpsTeam`: evidence retrieval, material organization, conclusion synthesis
* `MarketingOpsTeam`: open-source release, promotion, community feedback
* `ProjectContextTeam`: project context maintenance, state updates, cross-session handoff
* `WukongTeam`: high-uncertainty exploration and long-running complex tasks

### 2. Switch between single-agent and multi-agent collaboration based on task complexity

CrewBee does not make multi-agent collaboration a default ritual. It supports choosing different execution modes based on task complexity.

**Single-agent execution** fits:

* simple questions
* small code changes
* local explanations
* quick summarization
* low-risk tasks
* tasks with clear context and clear goals

**Multi-agent collaboration** fits:

* cross-file implementation
* complex bug fixes
* external research
* architecture decisions
* independent review
* tasks requiring verification evidence
* long-running project work

Simple tasks stay fast. Complex tasks use Team collaboration.

### 3. Main agent owns the most complete context for fuller decisions

CrewBee Teams use the main agent / formal leader as the task entry point, mainline owner, and final closer.

The main agent holds the most complete task context, including:

* user goal
* project constraints
* current task state
* findings returned by support agents
* review feedback
* verification results
* risks and unresolved items

Key decisions are made by the main agent based on this combined context, instead of being made globally by support agents that only hold partial information.

### 4. Context-isolated delegation reduces the main agent’s context and attention load

CrewBee’s support collaboration emphasizes context-isolated delegation:

```text
The main agent owns the main task context.
Support agents work on specialized tasks in dedicated contexts.
Support agents return high-signal findings to the main agent.
The main agent continues decision-making and final closure based on those findings.
```

Support tasks include:

* codebase exploration
* external documentation research
* evidence organization
* multimodal interpretation
* independent review
* high-level architecture advice

This prevents side searches, failed paths, low-signal material, and review traces from polluting the main context.

### 5. Built-in mature Coding Team with review flow and completion criteria

CrewBee’s most important methodology sample today is the built-in Coding Team.

It is not a single Coder Agent, but an Agent Team designed for software engineering work. The recommended structure includes:

```text
coding-leader
coding-executor
codebase-explorer
web-researcher
reviewer
principal-advisor
multimodal-looker
task-orchestrator
```

The built-in Coding Team uses direct responsibility-based role names so users can quickly understand what each agent does.

| Built-in Coding Team Role | Responsibility                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `coding-leader`           | Default entry point, task owner, and final closer                                                   |
| `coding-executor`         | Implements clear development, fixing, debugging, and local refactoring tasks                        |
| `codebase-explorer`       | Locates code entry points, call chains, similar implementations, and historical clues               |
| `web-researcher`          | Researches official docs, external references, open-source implementations, and version differences |
| `reviewer`                | Independently reviews risks, omissions, verification evidence, and completion criteria              |
| `principal-advisor`       | Provides high-level advice on architecture, performance, and complexity decisions                   |
| `multimodal-looker`       | Interprets screenshots, charts, PDFs, UI images, and visual materials                               |
| `task-orchestrator`       | Handles large plans, multi-wave tasks, and unified QA orchestration                                 |

Completion in the Coding Team should not depend only on “the agent thinks it is done.” It should include explicit completion criteria whenever possible, such as:

```text
- The target issue has been located.
- The change has a clear rationale.
- The required implementation or fix has been completed.
- Available diagnostics / build / tests have been run.
- The reviewer found no real blocking issue.
- Unverified items and residual risks have been stated.
```

### 6. Host-agnostic definitions and OpenCode Runtime Projection

CrewBee first converts the Team-first structure into a unified intermediate representation, then maps it into concrete host runtimes.

The current primary host is OpenCode.

The current OpenCode MVP path includes:

* Team Library loading
* Team / Agent validation
* Runtime Projection
* formal leader default selection
* projected agent generation
* OpenCode config patch
* session binding
* delegation tooling
* plugin entry
* user-level install
* doctor verification

This makes CrewBee more than a prompt folder. It is a runtime framework that can actually plug into OpenCode.

### 7. Copyable, modifiable, and contributable Team templates

CrewBee Teams are file-based engineering assets that can be copied, modified, versioned, and contributed.

Users can:

* use built-in Teams
* copy Team templates
* modify role structures
* adjust shared rules
* encode their own workflow
* contribute Teams back to the community

Many users may not modify CrewBee core, but they can still start from a template and build their own Team.

### 8. Prompts are decoupled while preserving execution semantics

CrewBee does not fall back to an old pattern where every field needs a dedicated schema and renderer. It also does not simply dump every top-level block into the prompt.

The current approach is:

> **a small set of shared semantic sections + generic structural processing + structured rendering**

For example, the Agent prompt skeleton is organized around execution cognition:

* Persona Core
* Responsibility Core
* Core Principle
* Scope Control
* Ambiguity Policy
* Support Triggers
* Collaboration
* Task Triage
* Delegation & Review
* Todo Discipline
* Completion Gate
* Failure Recovery
* Operations
* Output Contract
* Templates
* Guardrails
* Heuristics
* Anti Patterns
* Tool Skill Strategy

This helps the model quickly establish:

* who I am
* what I am responsible for
* how I act by default
* when to delegate / review / ask / stop
* what counts as completion
* how to recover from failure

### 9. Collaboration generates runtime-usable delegation targets

The generated `Collaboration` section is not just a simple list of collaboration bindings from the profile. It combines:

* subagent collaboration declarations from the Agent Profile
* `members` descriptions from the Team Manifest
* projected ids that OpenCode can resolve

Then it generates:

* `Id`
* `Description`
* `When To Delegate`

This makes delegation targets directly usable at runtime.

### 10. Team Contract is compressed into an executable handbook

The Team prompt does not mechanically render the entire governance config. It is compressed into:

* `Working Rules`
* `Approval & Safety`

This makes the Team contract easier for the model to consume and avoids mechanical expansion of governance fields.

### 11. User-level installation and operations flow

CrewBee already has a complete local build, user-level installation, doctor verification, and uninstall flow, so it can be installed as a user-level OpenCode plugin.

---

## Installation

Install CrewBee for OpenCode in one command:

```bash
npx crewbee@latest setup --with-opencode
```

If you already have OpenCode:

```bash
npx crewbee@latest setup
```

CrewBee installs into the OpenCode user-level workspace, writes the canonical plugin entry `"crewbee"`, runs doctor checks, and does not modify your repository files.

Full guide: [Installation Guide](docs/guide/installation.md)

---

## Quick Start

```bash
cd /path/to/project
opencode
```

Select `coding-leader` and run your first real task:

```text
Use CrewBee Coding Team to fix this issue with review-backed completion.
```

Verify anytime:

```bash
npx crewbee@latest doctor
```

For local development, use `npm run install:local:user`; keep that path out of first-time user onboarding.

### Use in OpenCode

After installation:

1. Open any project.
2. Select a CrewBee-projected agent, such as `coding-leader`.
3. Send your request normally.

---

## Agent Team and Agent Profile Definitions

If you want to design and register your own file-based Team, start with the [Custom Agent Team Guide](docs/guide/custom-agent-team.en.md). It explains the actual runnable directory structure, `crewbee.json` registration, Team policy design, Agent responsibility boundaries, and validation checklist.

If you need project-level Teams to override or supplement global Teams, continue with the [Project-level Team Configuration Guide](docs/guide/project-team-config.en.md).

### Actual file-based Team structure

The current runnable file-based Team structure is:

```text
teams/<team-name>/
  team.manifest.yaml
  team.policy.yaml
  <agent>.agent.md
  <agent>.agent.md
  TEAM.md            # optional
```

The current implementation uses a **flat directory**. It does not require `agents/` or `docs/` subdirectories.

The following config controls which file-based Teams are loaded:

```text
~/.config/opencode/crewbee.json
```

Example:

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/research-team", "enabled": true, "priority": 1 }
  ]
}
```

Notes:

* Built-in `coding-team` does not need a `path`.
* File-based Teams use `path` to point to the directory containing `team.manifest.yaml`.
* `@...` paths resolve relative to the OpenCode config root.
* Lower `priority` numbers rank higher. The default leader of the highest-priority Team becomes CrewBee’s default OpenCode agent.

### `team.manifest.yaml`

Responsible for:

* Team identity
* mission / scope
* formal leader
* members
* workflow
* agent runtime overrides
* tags

`members` is not just a display field. It affects:

* Team structure validation
* Team runtime description
* Collaboration prompt output

Therefore, `members.<agent>.responsibility / delegate_when / delegate_mode` are key fields, not decorative notes.

### `team.policy.yaml`

Responsible for:

* instruction precedence
* approval policy
* forbidden actions
* quality floor
* working rules

It is eventually compressed into two Team Contract sections:

* `Working Rules`
* `Approval & Safety`

### `*.agent.md`

Defines a single Agent’s static profile, including:

* what kind of actor this Agent is
* what this Agent is responsible for
* what boundaries this Agent has
* how this Agent collaborates by default
* what tools and permissions this Agent needs at runtime
* how this Agent outputs by default

CrewBee recommends defining key execution semantics as top-level sections, such as:

* `persona_core`
* `responsibility_core`
* `core_principle`
* `scope_control`
* `ambiguity_policy`
* `support_triggers`
* `collaboration`
* `task_triage`
* `delegation_review`
* `todo_discipline`
* `completion_gate`
* `failure_recovery`
* `operations`
* `output_contract`
* `templates`
* `guardrails`
* `heuristics`
* `anti_patterns`
* `tool_skill_strategy`

### Current capability definition paths

Current capability definitions mainly live in:

* **Agent-level capabilities**: `runtime_config` inside `*.agent.md`
* **Team-level runtime overrides**: `agent_runtime` inside `team.manifest.yaml`
* **Host-side available capabilities**: adapter / host capability contract

### `TEAM.md`

`TEAM.md` is a human-facing Team description document.

It helps people quickly understand:

* what this Team does
* who the Leader is
* what each member does
* what the default Workflow is

But it is not the source of truth.
The real logic sources are still:

* `team.manifest.yaml`
* `team.policy.yaml`
* `*.agent.md`

### Prompt Projection

Currently supported:

```yaml
prompt_projection:
  include:
    - persona_core
    - responsibility_core.description
  exclude:
    - metadata.tags
  labels:
    delegation_review: Delegation & Review
```

Constraints:

* only `snake_case` paths are allowed
* `projection_schema` is not supported
* camelCase paths are not supported

---

## How the OpenCode Runtime Works

The current OpenCode plugin path is roughly:

```text
package.json
  -> opencode-plugin.mjs
  -> dist/opencode-plugin.mjs
```

### What happens during plugin initialization

1. Load the default Team Library.
2. Validate the Team Library.
3. Generate bootstrap results.
4. Generate alias index.
5. Initialize session binding store.
6. Initialize delegation state store.

### Key hooks

#### `config`

Injects CrewBee projected agents into OpenCode config.

#### `chat.message`

Reads the currently selected agent and establishes a CrewBee session binding.

#### `tool` / delegation tools

Registers:

* `delegate_task`
* `delegate_status`
* `delegate_cancel`

#### `tool.execute.before`

Rewrites the `subagent_type` of `task` from alias to projected config key.

#### `experimental.chat.system.transform`

Injects minimal CrewBee runtime information into the system prompt:

* Team
* Entry Agent
* Active Owner
* Mode

---

## Built-in Coding Team Design

CrewBee’s most important methodology sample today is the built-in Coding Team.

### 1. The main agent owns the most complete context

The Coding Team’s main agent / formal leader is the default entry point, mainline owner, and final closer.

It collects:

* user goal
* repository constraints
* codebase exploration results
* external research findings
* reviewer feedback
* verification results
* risks and unresolved items

Key decisions are made by the main agent based on the complete context.

### 2. Simple tasks do not force complex collaboration

CrewBee believes:

* **simple tasks** should stay lightweight
* **complex but regular engineering tasks** fit structured Team collaboration
* **extremely hard problems** should keep context concentrated, trial-and-error fast, and human direction clear

Therefore, the Coding Team should not turn every task into a full Team workflow.

### 3. The most valuable independent role is usually Reviewer, not Planner

In coding, planning, execution, and verification form a tightly coupled feedback loop.

What matters most is:

* context continuity
* end-to-end responsibility
* independent quality perspective

A more stable structure is usually:

* main execution owner
* research
* reviewer
* advisor when needed

rather than equal Orchestrator / Planner / Executor separation.

### 4. Support agents use isolated contexts, and the main agent closes the task

For coding tasks, CrewBee emphasizes:

* the main agent holds the main context over time
* Codebase Explorer independently locates code evidence
* Web Researcher independently checks external references
* Reviewer independently checks risks and completion criteria
* Principal Advisor provides high-level judgment when needed
* the main agent receives high-signal findings, then decides and closes the task

---

## Next: Project Context

Project Context is an important next-stage product direction for CrewBee.

Its goal is to automatically maintain project context across sessions, so long-running projects keep high-signal summary information, including:

* project positioning
* framework design
* architecture summary
* key history
* current implementation state
* current plan
* known risks
* decision records
* next actions
* handoff summary

Project Context should not be a one-time generated project summary. It should be continuously updated during project work:

```text
Session start: read project context and restore project positioning, framework, history, and current plan.
Task execution: read only the necessary code and materials based on the current goal.
Session end: update project context with new implementation state, decisions, risks, and next steps.
Next session: continue from the latest project context.
```

It reduces two kinds of cost:

1. **Less manual prompting**: users do not need to re-explain project positioning, historical decisions, and current plans every time.
2. **Less context spent on reading the whole codebase**: agents can first use project context to understand project structure, key modules, and task-related areas, then read code selectively.

> Current note: Project Context is a next-stage enhancement direction. It should not be understood as a fully mature implemented feature today.

---

## Configuration, Installation, and Operations Scripts

### Common scripts

```bash
npm run build
npm run typecheck
npm run test
npm run pack:local
npm run pack:release
npm run release:registry:dry-run
npm run setup
npm run install:local:user
npm run install:registry:user
npm run update
npm run doctor
npm run uninstall
npm run uninstall:user
npm run simulate:opencode
npm run simulate:compact
```

### Notes

* `build`: builds the package
* `typecheck`: runs TypeScript type checking
* `test`: runs tests
* `pack:local`: packs a local tarball
* `pack:release`: packs a versioned release tarball
* `release:registry:dry-run`: runs local registry release checks without publishing
* `setup`: productized setup for users; installs OpenCode when missing, installs CrewBee, writes config, and runs doctor
* `install:local:user`: runs the complete user-level installation flow
* `install:registry:user`: installs the published npm package into the user-level workspace
* `update`: reinstalls CrewBee from the registry and runs doctor
* `doctor`: verifies OpenCode config and installation state
* `version`: shows the current package version and installed package version
* `uninstall`: removes CrewBee from OpenCode config and user-level workspace
* `uninstall:user`: uninstalls the user-level installation
* `simulate:opencode`: runs the local OpenCode runtime simulator
* `simulate:compact`: runs the compact scenario validation script

### User-level workspace default paths

```text
Config root:  ~/.config/opencode
Install root: ~/.cache/opencode
```

Canonical plugin entry:

```text
crewbee
```

Release guide:

```text
docs/guide/release.md
```

On Windows, CrewBee still prefers:

```text
~/.config/opencode
```

If an existing OpenCode config is found under `%APPDATA%/opencode`, CrewBee falls back to that location for compatibility.

---

## Uninstall

Recommended:

```bash
npm run uninstall:user
```

This will:

* remove the CrewBee plugin entry from OpenCode config
* remove the installed package from the user-level workspace

To verify the uninstall state:

```bash
npm run doctor
```

---

## Acknowledgements

CrewBee is inspired by OpenCode and community projects such as oh-my-openagent. These projects explored the value of Agent Team workflows in real development environments and helped more developers see the potential of multi-agent collaboration.

Thanks to their developers and maintainers.

CrewBee continues in this direction by organizing Agent Teams from prompt fragments or role configurations into manageable, projectable, configurable, and reusable engineering assets, so Agent Teams for different tasks or projects can be defined, run, and evolved more clearly.
