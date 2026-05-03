# Installation

Language: English | [中文](./installation.zh-CN.md)

## Quick Start

Install CrewBee for OpenCode in one command:

```bash
npx crewbee@latest setup --with-opencode
```

Then open your project:

```bash
cd /path/to/your/project
opencode
```

Select:

```text
coding-leader
```

CrewBee installs into the OpenCode user-level workspace, writes the canonical plugin entry `"crewbee"`, runs doctor checks, and prints the next step. It does not install into your business project's `node_modules` and does not modify repository files.

## Already Have OpenCode

If OpenCode is already installed and available in your terminal:

```bash
npx crewbee@latest setup
```

If OpenCode is missing, use the recommended command instead:

```bash
npx crewbee@latest setup --with-opencode
```

When `--with-opencode` is used, CrewBee installs OpenCode with the official npm package path:

```bash
npm install -g opencode-ai
```

If global npm installation is not writable, install OpenCode manually from the official docs and re-run `npx crewbee@latest setup`.

## What `setup` Does

```text
Detect runtime and OpenCode
→ install OpenCode if missing and --with-opencode is set
→ install crewbee@latest into the OpenCode user-level workspace
→ back up OpenCode config before writing
→ write OpenCode plugin entry: "crewbee"
→ create or repair CrewBee's user-level crewbee.json
→ run crewbee doctor
→ show how to start OpenCode and select coding-leader
```

Default roots:

```text
Config root:  ~/.config/opencode
Install root: ~/.cache/opencode
```

On Windows, OpenCode works best in WSL. Native Windows is supported when OpenCode is available in `PATH`; OpenCode can be installed via npm, Chocolatey, or Scoop.

## Website Installation Copy

Use this copy for the homepage installation card:

```text
Install CrewBee

Set up CrewBee for OpenCode in one command.
No project-local node_modules. No manual config editing.
```

```bash
npx crewbee@latest setup --with-opencode
```

Three-step section:

```text
1. Setup CrewBee for OpenCode
2. Open your project with opencode
3. Select coding-leader and run a real task
```

## Installation Tabs

### Recommended

```bash
npx crewbee@latest setup --with-opencode
```

Best for first-time users. Installs OpenCode if missing, installs CrewBee, writes the OpenCode plugin entry, and runs doctor.

### Already have OpenCode

```bash
npx crewbee@latest setup
```

Use this if OpenCode is already installed and available in your terminal.

### For LLM Agents

```bash
npx crewbee@latest setup --with-opencode --yes
npx crewbee@latest doctor
```

Important:

```text
Do not install CrewBee into this project's node_modules.
Do not manually edit business project files.
CrewBee should be installed into the OpenCode user-level workspace.
The OpenCode plugin entry should be "crewbee".
After installation, tell the user to open a project with `opencode` and select `coding-leader`.
```

## CLI Reference

### Setup

```bash
npx crewbee@latest setup [options]
```

Options:

```text
--with-opencode       Install OpenCode when it is missing
--yes, -y             Non-interactive mode for LLM agents and copy-paste setup
--doctor              Run doctor after setup, default true
--no-doctor           Skip doctor
--dry-run             Show the plan without changing files
--force               Reinstall CrewBee
--channel stable      Install the stable npm dist-tag, default
--channel next        Install the next npm dist-tag
--config-path <path>  Use a custom OpenCode config file
--install-root <path> Use a custom OpenCode user-level install root
--verbose             Print additional setup details
```

### Verify

```bash
npx crewbee@latest doctor
```

Doctor checks the OpenCode config, user-level install workspace, package layout, plugin entry, plugin file, and built-in Team definitions.

### Update

```bash
npx crewbee@latest update
```

Use `--channel next` to update to the next dist-tag.

### Uninstall

```bash
npx crewbee@latest uninstall
```

This removes CrewBee entries from OpenCode config and removes CrewBee from the OpenCode user-level workspace. User Team configuration is preserved unless a future purge option is explicitly used.

## Safety Model

CrewBee setup is intentionally conservative:

```text
No project-local node_modules install
No business repository file modifications
OpenCode config backup before writes
Rollback of OpenCode config on setup/uninstall failure
Canonical plugin entry only: "crewbee"
Dry-run mode for transparent planning
```

Dry-run example:

```bash
npx crewbee@latest setup --with-opencode --dry-run
```

## Developer Local Install

The local tarball path is for contributors and maintainers, not first-time users:

```bash
npm install
npm run pack:local
npm run install:local:user
npm run doctor
```

The local tarball is written to:

```text
.artifacts/local/crewbee-local.tgz
```

## Project-specific Teams

CrewBee supports global Teams and project Teams. Project Teams are configured from the current OpenCode worktree:

```text
<project-worktree>/.crewbee/crewbee.json
```

For the full design and examples, see:

```text
docs/guide/project-team-config.md
```
