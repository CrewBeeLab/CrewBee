# Release Guide

Language: English | [中文](./release.zh-CN.md)

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
  - runs `typecheck`, `test`, `doctor`, simulators, `pack:release`, and package smoke
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
   - `npm run simulate:opencode`
   - `npm run simulate:compact`
   - `npm run pack:release`
   - `npm run smoke:package`
6. Optionally publishes to npm.

> Note: the local publish path requests npm provenance. Some local shells are not recognized by npm as supported provenance providers. If validation and `pack:release` have already passed but npm fails with `Automatic provenance generation not supported for provider: null`, publish the prepared package from the same checked version with `npm publish --access public --tag <tag>` and record the provenance fallback in the release notes / handoff.

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

## Option B: GitHub Actions Release PR Flow

This is the recommended **official** release path. Humans only create and merge a release PR; the tag and npm publish happen automatically after that PR lands on `main`.

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
- `npm run simulate:opencode`
- `npm run simulate:compact`
- `npm run doctor`
- `npm run pack:release`
- packed package smoke via `scripts/smoke-packed-package.mjs`

### Release CI workflow

File:

```text
.github/workflows/release-ci.yml
```

Trigger:

- pull requests targeting `main` whose branch starts with `release/v`
- or pull requests targeting `main` with the `release` label

Release PR requirements:

- the PR must come from this repository, not a fork
- `package.json`, `package-lock.json`, and the release branch version must match
- the target version must not already exist on npm
- the PR may only change `package.json` and `package-lock.json`

Release CI gates:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run simulate:opencode`
- `npm run simulate:compact`
- `npm run doctor`
- `npm run pack:release`
- packed tarball smoke test
- install local tarball into the OpenCode user-level workspace
- `opencode models --print-logs --log-level DEBUG`
- `opencode agent list --print-logs --log-level DEBUG`

### Release tag workflow

File:

```text
.github/workflows/release-tag.yml
```

Trigger:

- push to `main`

Behavior:

- if the push to `main` changed `package.json` or `package-lock.json`, validate that both files contain the same release version `X.Y.Z`
- refuse to tag if `crewbee@X.Y.Z` already exists on npm
- create and push tag `vX.Y.Z` when it does not already exist
- pushes that do not change package version files are ignored

### Publish workflow

File:

```text
.github/workflows/publish.yml
```

Trigger:

- push of tag `vX.Y.Z`

### What the publish workflow does

1. Checks out the immutable release tag.
2. Validates that tag, `package.json`, and `package-lock.json` versions match.
3. Rejects the release if that npm version is already published.
4. Runs the full release gates: `typecheck`, tests, build, simulators, doctor, pack, package smoke, and real OpenCode loading smoke.
5. Publishes the verified tarball to a staging dist-tag:
   - stable releases first publish to `next`
   - prereleases publish to their prerelease tag, for example `beta`
6. Fetches the just-published package back from npm and smoke-tests it.
7. For stable releases, promotes `crewbee@X.Y.Z` to `latest`.
8. For stable releases, installs from the registry and reruns OpenCode smoke.
9. Creates a GitHub release with generated notes.

### GitHub Actions release steps

1. Create a branch named `release/vX.Y.Z` from `main`.
2. Update only `package.json` and `package-lock.json` to `X.Y.Z`.
3. Commit with subject `Release vX.Y.Z`.
4. Open a PR from `release/vX.Y.Z` to `main`.
5. Wait for `ci` and `release-ci` to pass.
6. Merge the release PR.
7. `release-tag.yml` detects the package version bump on `main` and creates `vX.Y.Z` automatically.
8. `publish.yml` publishes the tag automatically.
9. After success, verify:
   - npm has `crewbee@<version>`
   - `latest` points to the released stable version
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

Use the release PR flow:

```text
release/vX.Y.Z -> Release PR -> merge -> automatic tag -> automatic publish
```

This keeps a single human entry point while preserving an immutable tag as the publish boundary.

---

## Quick Checklist

Before release:

- `npm run typecheck`
- `npm run test`
- `npm run doctor`
- `npm run simulate:opencode`
- `npm run simulate:compact`
- `npm run pack:release`
- `npm run smoke:package`

After release:

- npm shows `crewbee@<version>`
- OpenCode config can use `"crewbee"`
- `npm run install:registry:user` succeeds
- `npm run doctor` is healthy
