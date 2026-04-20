# Release Guide

## Goals

CrewBee now supports two parallel flows:

1. **Keep the existing local development pack/install flow** for day-to-day development.
2. **Add a registry publish flow** so OpenCode can load CrewBee from the package name `crewbee`.

This aligns CrewBee with the same **package-name-first** model used by `oh-my-openagent`:

```json
{
  "plugin": ["crewbee"]
}
```

When OpenCode supports package-name plugin resolution, that config lets it pull CrewBee from the published npm package automatically.

---

## Release Model Overview

### 1) Local development flow (preserved)

For local development and verification:

```bash
npm install
npm run pack:local
npm run install:local:user
npm run doctor
```

Artifacts:

- stable local tarball: `.artifacts/local/crewbee-local.tgz`
- OpenCode plugin config entry: `crewbee`

Use this when you are iterating locally and want to test the package before publishing.

### 2) Registry release flow (new)

For official online distribution:

- npm package name: `crewbee`
- OpenCode config plugin entry: `crewbee`
- publish target: npm registry
- release automation: **both local script and GitHub Actions are supported**

---

## Option A: Local Script-Based Release Flow

This path is useful when you want to prepare or manually publish from your own machine.

### Supporting scripts

- `npm run pack:release`
  - builds a versioned tarball in `.artifacts/release/`
- `node ./scripts/release-registry.mjs --dryRun`
  - computes next version
  - updates local package files
  - runs `typecheck`, `test`, `doctor`, `pack:release`
  - **does not publish**
- `node ./scripts/release-registry.mjs --publish`
  - does the same validation
  - then runs `npm publish --access public --provenance --tag <tag>`
- Windows wrapper:
  - `scripts\release-registry.bat`

### Recommended local release steps

#### Dry-run / preflight

```bash
node ./scripts/release-registry.mjs --dryRun
```

Or on Windows:

```bat
scripts\release-registry.bat
```

#### Publish patch release

```bash
node ./scripts/release-registry.mjs --publish --bump patch
```

#### Publish minor release

```bash
node ./scripts/release-registry.mjs --publish --bump minor
```

#### Publish explicit version

```bash
node ./scripts/release-registry.mjs --publish --version 0.2.0
```

#### Publish prerelease

```bash
node ./scripts/release-registry.mjs --publish --version 0.2.0-beta.1 --tag beta
```

### What the local release script does

1. Reads current local version.
2. Reads npm registry latest version when available.
3. Computes next version.
4. Updates `package.json` and `package-lock.json`.
5. Runs:
   - `npm run typecheck`
   - `npm run test`
   - `npm run doctor`
   - `npm run pack:release`
6. Optionally publishes to npm.

### What the local script does **not** do automatically

The local script currently focuses on **package preparation and npm publish**.

After a successful local publish, you should still do the Git steps explicitly:

```bash
git add package.json package-lock.json
git commit -m "Release vX.Y.Z"
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
gh release create vX.Y.Z --generate-notes
```

This keeps the local manual path explicit and safe.

---

## Option B: GitHub Actions Release Flow

This is the recommended **official** release path.

### CI workflow

File:

```text
.github/workflows/ci.yml
```

It runs:

- `npm ci`
- `npm test`
- `npm run typecheck`
- `npm run build`

### Publish workflow

File:

```text
.github/workflows/publish.yml
```

Trigger:

- manual dispatch in GitHub Actions

Inputs:

- `bump`: `patch | minor | major`
- `version`: optional explicit version override

### What the publish workflow does

1. Runs `test`, `typecheck`, and `build` gates.
2. Computes the release version.
3. Checks whether that version already exists on npm.
4. Updates `package.json` and `package-lock.json`.
5. Builds the package.
6. Publishes `crewbee` to npm.
7. Commits the released version back to the repository.
8. Pushes the version commit.
9. Creates a git tag.
10. Creates a GitHub release with generated notes.

### GitHub Actions release steps

1. Go to **Actions**.
2. Open the **publish** workflow.
3. Click **Run workflow**.
4. Choose either:
   - `bump = patch|minor|major`, or
   - set explicit `version`
5. Run the workflow.
6. After success, verify:
   - npm has `crewbee@<version>`
   - repo contains commit `Release v<version>`
   - tag `v<version>` exists
   - GitHub release exists

---

## OpenCode Auto-Install Model

After CrewBee is published, the target OpenCode config should reference the package name directly:

```json
{
  "plugin": ["crewbee"]
}
```

### Why this works

CrewBee now writes and validates the canonical plugin entry as:

```text
crewbee
```

instead of a `file://.../opencode-plugin.mjs` path.

This is the same model used by `oh-my-openagent`: the config references the package name, and the host/plugin workspace resolves the published npm package.

### Local fallback

If you are doing development or the package is not yet published, use:

```bash
npm run install:local:user
```

That still installs a local tarball into the OpenCode user-level workspace, but the config entry remains the same canonical package name:

```json
{
  "plugin": ["crewbee"]
}
```

---

## Recommended Operational Policy

### For day-to-day development

Use the preserved local flow:

```bash
npm run install:local:user
```

### For pre-release verification

Use the local release preflight:

```bash
node ./scripts/release-registry.mjs --dryRun
```

### For official releases

Prefer GitHub Actions:

```text
Actions -> publish -> Run workflow
```

This is the safest and most reproducible path.

---

## Quick Checklist

Before release:

- `npm run typecheck`
- `npm run test`
- `npm run doctor`
- `npm run pack:release`

After release:

- npm shows `crewbee@<version>`
- OpenCode config can use `"crewbee"`
- `npm run install:registry:user` succeeds
- `npm run doctor` is healthy
