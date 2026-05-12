# CrewBee Developer Guides

Language: English | [中文](./README.zh-CN.md)

These guides are for contributors and maintainers working on the CrewBee repository itself.

## Guides

- [Development Conventions](./contributing.en.md)
- [OpenCode Runtime Simulator](./opencode-runtime-simulator.md)
- [Release And CI/CD Guide](./release.md)

## Maintainer CI/CD Flow

CrewBee separates user-facing documentation from repository maintenance workflows:

- ordinary code changes go through normal pull requests and `ci.yml`
- official releases are started manually through `release-ci.yml`
- successful release validation creates a version-only release commit on `main`
- `release-tag.yml` creates the immutable release tag
- `publish.yml` publishes the tag to npm and creates the GitHub Release

For installation and Team authoring, use the [user guide index](../guide/README.md).
