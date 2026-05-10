# CrewBee

[English](README.md) | [简体中文](README.zh-CN.md)

> [!NOTE]
>
> [![CrewBee - Turn scattered agents into real teams.](./assets/web-home-en.png?v=2)](https://crewbeelab.github.io)
> > **CrewBee turns prompts, agents, rules, review flows, and completion criteria into maintainable Agent Team assets. <br />Visit the website [here](https://crewbeelab.github.io).**


CrewBee is an **Agent Team asset layer** with OpenCode as its first officially supported host.

It turns prompts, agents, rules, review flows, and completion criteria in engineering work into maintainable **Agent Team assets**.

CrewBee helps you build reusable Agent Teams for specialized workflows: not just agents, but tools / skills strategies, workflows, rules, review flows, and completion criteria.

Here, “team” does not mean enabling more agents by default. It means giving complex engineering work clear responsibilities and collaboration boundaries across requirements understanding, codebase exploration, implementation planning, implementation changes, independent review, validation, and delivery notes.

Not a prompt pack.  
Not a flat agent list.  
Not another all-in-one multi-agent runtime.

**Available for OpenCode today.** OpenCode is CrewBee’s first officially supported host; Project Context, the Team template ecosystem, and more Agent Harness adapters are next-stage directions.

---

## Why CrewBee

Complex engineering tasks need a reviewable, verifiable work structure.

Code generation is only one part of delivery. What matters is requirements understanding, codebase exploration, implementation planning, implementation changes, independent review, validation, and delivery notes.

When these concerns are scattered across prompts, agents, rules, review checklists, and ad-hoc conventions, agent work becomes hard to maintain, reuse, and improve.

### CrewBee in OpenCode

The screenshot below shows CrewBee running inside OpenCode, with the Coding Team entry selected and review-backed work visible in the session.

![CrewBee running inside OpenCode desktop](./assets/opencode-desktop.png?v=2)

CrewBee focuses on three current product differentiators:

* **Agent Team assets** — Turn prompts, agents, rules, review flows, and completion criteria into maintainable Team assets.
* **Reusable Agent Teams for specialized workflows** — Build Team definitions for domain-specific work, including agents, tools / skills strategies, workflows, rules, review flows, and completion criteria.
* **Built-in Coding Team** — Start from an owner-centered, review-backed Coding Team for development, fixing, debugging, refactoring, validation, and delivery notes.

CrewBee does not make multi-agent collaboration a default ritual.

Simple tasks stay lightweight. Complex tasks get support, review, validation, and completion criteria.

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
* [Built-in Coding Team](#built-in-coding-team)
* [Next: Project Context](#next-project-context)
* [Configuration, Installation, and Operations Scripts](#configuration-installation-and-operations-scripts)
* [Uninstall](#uninstall)
* [Acknowledgements](#acknowledgements)

---

## What CrewBee Is

CrewBee is an **Agent Team asset layer** with OpenCode as its first officially supported host.

In CrewBee, the first-class object is not a single agent or a prompt fragment, but an **Agent Team asset**.

An Agent Team asset can include:

* Team mission and scope
* formal Leader
* members
* shared policy
* workflow
* review flow
* completion criteria
* Agent Profiles
* tools / skills strategy
* model preferences
* host binding

The goal is to turn a reusable way of working into a maintainable Team asset.

CrewBee does not replace OpenCode and does not try to become another all-in-one multi-agent runtime. Its current focus is to organize specialized engineering workflows into reusable Agent Teams and make the built-in Coding Team available in OpenCode.

CrewBee projects Team assets into OpenCode so they can run in the host environment. Runtime Projection, OpenCode Adapter, setup, doctor checks, per-agent model configuration, and projection-time fallback are implementation and usability supports, not the long-term product differentiators described above.

---

## What CrewBee Solves

CrewBee mainly solves the problem of turning scattered agent work into maintainable Team assets.

### 1. Scattered prompts, agents, and rules are hard to maintain

Many AI coding setups start with a prompt, a few custom agents, some project rules, and a review checklist.

Over time, these pieces become scattered across projects and host-specific configuration. They are hard to reuse, version, review, and improve.

CrewBee turns them into maintainable Agent Team assets.

### 2. Complex engineering tasks need a reviewable, verifiable work structure

Reliable software delivery is not only code generation.

Complex tasks often involve requirements understanding, codebase exploration, implementation planning, implementation changes, independent review, validation, and delivery notes.

CrewBee organizes these responsibilities into a Team structure instead of leaving them in ad-hoc prompts.

### 3. Specialized workflows need reusable Agent Teams

Different work needs different responsibilities, tools, rules, review flows, and completion criteria.

CrewBee helps you build reusable Agent Teams for specialized workflows: coding, code review, documentation, release work, research, bug triage, or other domain-specific work.

This is not a mature template marketplace today. The current value is the engineering ability to define and run reusable Team assets.

### 4. Complex coding tasks should not depend on a single Coder self-declaring completion

The built-in Coding Team is CrewBee’s flagship sample.

It gives complex coding tasks a clearer structure:

```text
Main Owner
+ Codebase Exploration
+ Focused Implementation
+ Independent Review
+ Completion Criteria
```

The goal is not more agents by default. The goal is clearer ownership, better evidence, independent review, and more reliable completion.

### 5. Simple tasks should stay lightweight

CrewBee does not turn every task into a full Team workflow.

Simple tasks should stay lightweight. Complex tasks can use support roles, review, validation, and completion criteria when needed.

---

## Core Features

### 1. Agent Team assets

CrewBee turns prompts, agents, rules, review flows, and completion criteria into maintainable Team assets.

A Team asset can define:

* mission and scope
* formal Leader
* members
* workflow
* shared rules
* tools / skills strategy
* review flow
* completion criteria
* output contract
* model preferences
* host binding

This makes the Team maintainable, reusable, and easier to evolve than scattered prompts or flat agent lists.

### 2. Reusable Agent Teams for specialized workflows

CrewBee lets you define Agent Teams for specialized workflows.

A specialized Team is not just a group of agents. It can also include tools / skills strategies, workflows, rules, review flows, and completion criteria.

Examples of possible Team directions include:

* Coding Team
* Code Review Team
* ResearchOps Team
* Documentation Team
* ReleaseOps Team
* Bug Triage Team
* MarketingOps Team
* Product Planning Team

These are examples of what CrewBee’s Team asset model is designed to support. A broader Team template ecosystem is a roadmap direction, not a mature ecosystem today.

### 3. Built-in Coding Team

CrewBee includes a built-in Coding Team as its current flagship sample.

It is designed for owner-centered, review-backed coding:

```text
Main Owner
+ Codebase Exploration
+ Focused Implementation
+ Independent Review
+ Completion Criteria
```

This helps complex coding tasks avoid depending only on a single Coder agent self-declaring completion.

### 4. Lightweight path for simple tasks, support path for complex tasks

CrewBee does not make multi-agent collaboration a default ritual.

Simple tasks can stay lightweight. Complex tasks can use support agents, review, validation, and completion criteria when needed.

### 5. OpenCode usability support

CrewBee is available for OpenCode today.

The current OpenCode path includes user-level setup, doctor checks, OpenCode configuration support, delegation tooling, and per-agent model configuration.

These are productization and usability supports. They help users install, run, configure, and diagnose CrewBee, but they are not CrewBee’s long-term core differentiators.

### 6. Implementation details that support Team assets

CrewBee also includes implementation details that make Team assets runnable and usable in OpenCode:

* Prompt Projection keeps Agent prompts structured while preserving execution semantics.
* Collaboration sections generate runtime-usable delegation targets.
* Team Contract rendering compresses policy into `Working Rules` and `Approval & Safety`.
* Team assets can be copied, modified, and versioned.

These details are important for implementation quality, but they are not the three main product differentiators.

### 7. Roadmap directions

The following are next-stage directions, not mature current advantages:

* Project Context for long-running, cross-session project work.
* A broader Team template ecosystem.
* More Agent Harness adapters and multi-host projection experiments.

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

The first recommended experience is to open a real project in OpenCode, select `coding-leader`, and run a coding task with review-backed completion.

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

This section explains the current OpenCode implementation path. Runtime Projection, OpenCode configuration patches, session binding, and delegation tooling are implementation details that make CrewBee’s Team assets runnable in OpenCode; they are not the main product differentiators described above.

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

* `task` (CrewBee delegate task implementation for OpenCode)
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

### Model resolution and fallback

CrewBee's model policy is reliability-first: recommended Coding Team models are not treated as hard requirements unless the user explicitly marks them strict.

During OpenCode projection, CrewBee reads OpenCode's configured provider/model registry through the plugin client and uses it as an availability filter:

* user `strict: true` model: projected as-is; failures belong to the explicit user configuration
* user non-strict model: used as primary when available; otherwise fallback candidates are considered
* built-in recommendations: projected only when the model is visible in the OpenCode provider/model registry
* unknown registry: CrewBee does not assume built-in recommendations are usable and falls back to OpenCode host default by omitting `model`

During delegated `task(...)` execution, non-strict model-not-found failures are retried once without a model so OpenCode can use the host default. Strict models are not retried.

Example override:

```jsonc
{
  "teams": [
    {
      "id": "coding-team",
      "agents": {
        "reviewer": {
          "model": "anthropic/claude-opus-4-7",
          "strict": false,
          "fallback_models": ["openai/gpt-5.5"]
        }
      }
    }
  ]
}
```

---

## Built-in Coding Team

CrewBee’s built-in Coding Team is the current flagship sample of the Agent Team asset model.

It is designed for owner-centered, review-backed coding work:

```text
Main Owner
+ Codebase Exploration
+ Focused Implementation
+ Independent Review
+ Completion Criteria
```

The value is not that there are more coding agents. The value is that complex coding tasks get clearer ownership, code evidence, implementation focus, independent review, validation, and delivery notes.

The built-in Coding Team uses direct responsibility-based role names so users can quickly understand what each agent does.

| Built-in Coding Team Role | Responsibility                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `coding-leader`           | Default entry, task owner, decision context owner, and final handoff                                |
| `coding-executor`         | Focused implementation, fixes, debugging, and local refactoring                                     |
| `codebase-explorer`       | Code entry points, call chains, related implementations, and historical clues                       |
| `web-researcher`          | Official docs, external references, open-source implementations, and version differences            |
| `reviewer`                | Independent review of risks, omissions, verification evidence, and completion criteria              |
| `principal-advisor`       | Architecture, performance, and complexity advice                                                    |
| `multimodal-looker`       | Screenshots, charts, PDFs, UI images, and visual materials                                          |
| `task-orchestrator`       | Large plans, multi-wave tasks, and unified QA orchestration                                         |

### 1. The main agent owns the most complete context

The Coding Team’s main agent / formal leader is the default entry point, mainline owner, decision context owner, and final handoff owner.

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

The Coding Team should prove one thing first: complex coding tasks can be organized as a reusable Team asset, instead of being handled by a single Coder agent that writes code and declares the task done.

---

## Next: Project Context

Project Context is a next-stage product direction for CrewBee.

It should not be understood as a fully mature feature today.

The goal is to help long-running projects avoid making agents onboard from zero in every new session.

A future Project Context capability should maintain high-signal project information such as:

* project positioning
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

CrewBee is built with appreciation for OpenCode and the broader open-source agent ecosystem.

OpenCode is CrewBee’s first officially supported host and provides the runtime environment where CrewBee’s current Coding Team can be used.

Community projects such as oh-my-openagent have also helped more developers explore real-world agent workflows in OpenCode and related environments.

CrewBee continues from a different layer: organizing prompts, agents, rules, review flows, and completion criteria into maintainable Agent Team assets.

Thanks to the developers, maintainers, and community members who keep pushing the open-source agent ecosystem forward.
