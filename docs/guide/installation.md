# Installation

Language: English | [中文](./installation.zh-CN.md)

## Current Scope

CrewBee now supports both installation paths:

```text
local dev: build local package -> install into the OpenCode user-level workspace -> write canonical package-name plugin entry
registry:  install the published npm package into the OpenCode user-level workspace -> write canonical package-name plugin entry
```

## New vs Old Flow

### Historical project-local flow

```text
build local package -> install tarball into a target project -> run npx crewbee install inside that project
```

### Current user-level flow

```text
build local package -> install tarball into ~/.cache/opencode -> write package-name plugin entry into ~/.config/opencode/opencode.json(c)
```

The new flow is the one CrewBee supports and documents now.

## For Humans

If you are using an agent, paste this:

```text
Install CrewBee by following docs/guide/installation.md in this repository.
Prefer the registry flow when CrewBee has already been published; otherwise use the local user-level flow.
```

## For LLM Agents

Follow the registry flow when available, or the local user-level flow for development. Do not install CrewBee into a business project's node_modules.

## Step 1: Build and Pack CrewBee Locally

Run these commands in the CrewBee repository:

```bash
npm install
npm run pack:local
```

This produces a stable local tarball at:

```text
.artifacts/local/crewbee-local.tgz
```

`npm run pack:local` triggers `npm pack`, and `prepack` ensures the plugin is rebuilt before the tarball is created.

## Step 2: Install Into the OpenCode User-Level Workspace

### Preferred published / registry flow

When `crewbee` is published to npm, install it with:

```bash
npm run install:registry:user
```

This is equivalent to:

```bash
node ./bin/crewbee.js install --source registry
```

The installer will install the published `crewbee` package into the OpenCode user-level workspace and write the canonical plugin entry `"crewbee"` into OpenCode config.

### Local development flow

From the CrewBee repository root, the simplest path is:

```bash
npm run install:local:user
```

This is equivalent to:

```bash
node ./bin/crewbee.js install --source local --local-tarball ./.artifacts/local/crewbee-local.tgz
```

The installer does all of the following:

1. resolves the OpenCode config root
2. resolves the CrewBee install root
3. bootstraps a minimal user-level package workspace
4. installs the local tarball into that workspace
5. resolves the installed `opencode-plugin.mjs`
6. rewrites OpenCode config to the canonical package-name plugin entry

## Step 3: Understand the User-Level Paths

By default, CrewBee uses two different roots:

```text
Config root:  ~/.config/opencode
Install root: ~/.cache/opencode
```

On Windows, the config root still prefers the cross-platform `~/.config/opencode` location, with fallback to `%APPDATA%/opencode` when an existing OpenCode config already lives there.

You can override these during development:

```bash
node ./bin/crewbee.js install --source local --local-tarball ./.artifacts/local/crewbee-local.tgz --install-root /tmp/crewbee-user-root --config-path /tmp/opencode.json
```

## Step 4: Verify the Installation

Use:

```bash
npm run doctor
npm run version
```

Or directly:

```bash
node ./bin/crewbee.js doctor
```

You should see that:

- the workspace manifest exists
- the installed package exists
- the plugin file exists
- the OpenCode config entry matches the canonical user-level plugin entry

`npm run version` / `crewbee version` reports the semantic version directly from `package.json`. CrewBee intentionally does not add an extra build-id layer at this stage.

The canonical plugin entry is:

```text
crewbee
```

CrewBee now uses a standard Node package layout inside the OpenCode cache root:

```text
~/.cache/opencode/
  package.json
  node_modules/
    crewbee/
      package.json
      opencode-plugin.mjs
      dist/
        opencode-plugin.mjs
```

OpenCode should resolve CrewBee from config by package name, while the user-level workspace keeps the installed package available under `node_modules/crewbee`.

## Step 5: Use CrewBee in OpenCode

After OpenCode loads the plugin:

1. open any project in OpenCode
2. select a CrewBee projected agent such as `coding-leader`
3. send your request normally

CrewBee is no longer tied to a specific target project's `node_modules` installation.

### Optional: add project-specific Teams

CrewBee supports both global Teams and project Teams. Global Teams are registered from the OpenCode config root:

```text
~/.config/opencode/crewbee.json
```

Project Teams are registered from the current OpenCode worktree:

```text
<project-worktree>/.crewbee/crewbee.json
```

Both files use the same `teams` schema. A project Team is not loaded by a separate project-only pipeline; it is normalized into the same Team registration flow as global Teams, with a higher source precedence for the current worktree.

Minimal project config:

```json
{
  "teams": [
    { "path": "@teams/project-team", "enabled": true, "priority": 0 }
  ]
}
```

With that config, `@teams/project-team` resolves to:

```text
<project-worktree>/.crewbee/teams/project-team
```

If the project Team has a user-selectable formal leader, that leader becomes the default Agent for this OpenCode instance, while global Teams remain available at lower source precedence. For the full design and examples, see:

```text
docs/guide/project-team-config.md
```

## Step 6: Migrate From the Old Project-Local Mode

If your OpenCode config still contains a project-local CrewBee entry such as:

```text
file:///some/project/node_modules/crewbee/opencode-plugin.mjs
```

run the new installer once:

```bash
npm run install:local:user
```

CrewBee will replace that old project-local entry with the canonical user-level package entry.

It also migrates the old standalone shim path used in earlier user-level installs, for example:

```text
file://~/.cache/opencode/crewbee/entry/crewbee-opencode-entry.mjs
```

to:

```text
crewbee
```

## Step 7: Uninstall From the User-Level Workspace

Use:

```bash
npm run uninstall:user
```

Or directly:

```bash
node ./bin/crewbee.js uninstall:user
```

This removes CrewBee entries from OpenCode config and removes the installed package from the user-level workspace.

## Publish and Package-Name Install

CrewBee is designed to be published as the npm package `crewbee`.

After publishing, OpenCode config can reference the plugin directly by package name:

```json
{
  "plugin": ["crewbee"]
}
```

This matches the same package-name-first installation model used by `oh-my-openagent`.

For the full publish workflow and operational checklist, see:

```text
docs/guide/release.md
```
