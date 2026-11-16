# Changelog

## 0.2.0 — 2026-11-16

CrewBee 0.2.0 adds OpenCode V2 support and partial customization of embedded Agent Teams. Team assets remain independent of the host adapter, and existing delegation logic is reused across supported OpenCode versions.

### Added

- **OpenCode V2 adapter** ([#8](https://github.com/CrewBeeLab/CrewBee/pull/8)): project CrewBee agents and tools into V2, with foreground and background delegation, task status/cancellation, and context/compaction continuity. The plugin retains its V1 entrypoint for supported V1 hosts.
- **Partial overrides for embedded Teams** ([#10](https://github.com/CrewBeeLab/CrewBee/pull/10)): customize selected agents or replace the Team policy without copying the entire embedded Team. Omitted agents and policy are inherited from the enabled embedded base, allowing untouched assets to receive upstream improvements.

### Fixed

- Select the OpenCode plugin configuration format from the detected CLI version; persist key-only `plugin` → `plugins` migrations and preserve plugin options. Release detection reads both formats, and uninstall preserves unrelated plugin entries.
- Isolate cancellation signals between concurrent V2 delegations, observe background execution failures, and select the host default model when retrying without an explicit model.
- Compose partial Team overrides before validation regardless of embedded/file source order, and fall back to a valid source when an override is invalid.
- Keep raw and canonical agent references consistent across Team membership, runtime/model overrides, and collaboration/delegation targets. Policy remains required on a fully loaded Team.
- Repair the dependency lockfile for reproducible installation.

### Compatibility and upgrade notes

- Supported hosts: **OpenCode >= 1.18.29 and < 2.0.0**, or **>= 2.2.0 and < 3.0.0**. Older V1 hosts must be upgraded before adopting this release; V2 versions below 2.2.0 are outside the supported range.
- Installation uses V1 `plugin` entries or V2 `plugins` entries. If the CLI version cannot be detected, the existing format is retained; a new config defaults to V1 format.
- A partial Team override still requires `team.manifest.yaml`. Supplied artifacts replace whole artifacts; this is not a field-by-field merge. Inheritance applies only when the matching embedded Team is enabled, not between file-based sources.
- To replace an embedded Team completely or remove its members, disable that embedded Team in every configuration source that enables it and provide a complete file Team, or use a distinct Team ID.
- OpenCode V2 has no session todo API. CrewBee preserves checkpoint/delegation continuity, but V2 todo snapshots are empty.

### Validation

- The combined changes passed all **123 tests**, type checking, build, both simulators, and packed-package smoke testing in [main CI](https://github.com/CrewBeeLab/CrewBee/actions/runs/43861869697).
- Real-host loading passed on OpenCode **1.18.29** and **2.2.0**, locally on Windows and in Linux CI. V2 delegation behavior has deterministic host-fixture coverage; live model requests and full Desktop UX were not exercised.

### Contributors

Thanks to [Alessandro Muzzi (@AleMuzzi)](https://github.com/AleMuzzi) for the original V2 port, investigation, and partial Team override implementation, and [@PerrinYong](https://github.com/PerrinYong) for maintainer fixes and validation. Both PRs were merged with their original and follow-up commit histories preserved.

[Changes since v0.1.24](https://github.com/CrewBeeLab/CrewBee/compare/v0.1.24...v0.2.0)

### 中文摘要

- 新增 OpenCode V2 适配，保留受支持的 V1 入口，复用 CrewBee 的委派机制。
- 支持局部覆盖内置 Team：只维护需要修改的 Agent 或 policy，其余资产继承已启用的内置 Team。
- 修复配置格式迁移、并发取消隔离、后台任务错误处理、模型回退、覆盖加载顺序和 canonical agent ID 引用一致性。
- 支持 OpenCode `>=1.18.29 <2.0.0` 或 `>=2.2.0 <3.0.0`；升级前请确认宿主版本。
- 局部覆盖仍需 manifest；提供的资产按整份替换。移除内置成员须禁用对应内置 Team 并提供完整定义，或采用新的 Team ID。
- V2 不提供 session todo API，因此 todo 快照为空；checkpoint 与委派上下文连续性仍保留。
- 合并后 123 项测试和 9 项 CI 全部通过；尚未验证真实模型调用及完整 Desktop 交互。

Earlier release notes are available in [GitHub Releases](https://github.com/CrewBeeLab/CrewBee/releases).
