# Installation

## Current Scope

CrewBee currently supports this installation path only:

```text
build local package -> install into the OpenCode user-level workspace -> write canonical file:// plugin entry -> use CrewBee from any OpenCode project
```

Online publish and remote package install are not implemented yet. The command surface is reserved, but the actual registry flow is intentionally out of scope for now.

## New vs Old Flow

### Historical project-local flow

```text
build local package -> install tarball into a target project -> run npx crewbee install inside that project
```

### Current user-level flow

```text
build local package -> install tarball into ~/.cache/opencode -> write package-local plugin entry into ~/.config/opencode/opencode.json(c)
```

The new flow is the one CrewBee supports and documents now.

## For Humans

If you are using an agent, paste this:

```text
Install CrewBee by following docs/guide/installation.md in this repository.
Use the OpenCode user-level workspace flow only.
```

## For LLM Agents

Follow the local user-level flow below. Do not invent a registry publish step and do not install CrewBee into a business project's node_modules.

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
6. rewrites OpenCode config to the canonical package-local plugin entry

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

The canonical plugin entry points at:

```text
file://<install-root>/node_modules/crewbee/opencode-plugin.mjs
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

This shape is compatible with both:

- direct file entry loading via `.../node_modules/crewbee/opencode-plugin.mjs`
- package-level entry resolution via the installed `package.json`

## Step 5: Use CrewBee in OpenCode

After OpenCode loads the plugin:

1. open any project in OpenCode
2. select a CrewBee projected agent such as `[CodingTeam]leader`
3. send your request normally

CrewBee is no longer tied to a specific target project's `node_modules` installation.

## Step 6: Migrate From the Old Project-Local Mode

If your OpenCode config still contains a project-local CrewBee entry such as:

```text
file:///some/project/node_modules/crewbee/opencode-plugin.mjs
```

run the new installer once:

```bash
npm run install:local:user
```

CrewBee will replace that old project-local entry with the canonical user-level workspace entry.

It also migrates the old standalone shim path used in earlier user-level installs, for example:

```text
file://~/.cache/opencode/crewbee/entry/crewbee-opencode-entry.mjs
```

to:

```text
file://~/.cache/opencode/node_modules/crewbee/opencode-plugin.mjs
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

## Reserved Future Flow

CrewBee keeps a reserved framework entry for future online distribution:

```bash
crewbee install --source registry
```

That flow is intentionally not implemented yet. Today, CrewBee only supports:

```bash
crewbee install --source local
```
