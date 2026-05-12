# CrewBee 开发者指南

语言：[English](./README.md) | 中文

这些指南面向参与 CrewBee 仓库本身开发、维护和发布的贡献者。

## 指南

- [开发约定](./contributing.md)
- [OpenCode Runtime Simulator](./opencode-runtime-simulator.zh-CN.md)
- [发布与 CI/CD 指南](./release.zh-CN.md)

## 维护者 CI/CD 流程

CrewBee 将用户文档和仓库维护流程分开：

- 普通代码改动通过正常 pull request 和 `ci.yml` 验证
- 官方发布由维护者手动运行 `release-ci.yml` 开始
- release 验证成功后，在 `main` 上创建只包含版本号变更的 release commit
- `release-tag.yml` 创建不可变 release tag
- `publish.yml` 将该 tag 发布到 npm，并创建 GitHub Release

安装和 Team 编写请使用[用户指南索引](../guide/README.zh-CN.md)。
