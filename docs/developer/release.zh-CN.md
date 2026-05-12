# 发布与 CI/CD 指南

语言：[English](./release.md) | 中文

适用对象：参与 CrewBee 仓库开发、维护和发布的**开发者与维护者**。如果只是安装或使用 CrewBee，请从[安装指南](../guide/installation.zh-CN.md)开始。

## 范围

本文覆盖本地维护者流程、GitHub Actions CI/CD、官方发布、npm publish 和发布后验证。普通 CrewBee 用户不需要阅读本文。

## 目标

CrewBee 当前支持两条并行流程：

1. **保留本地开发 pack / install 流程**，用于日常开发验证。
2. **提供 registry publish 流程**，让 OpenCode 可以通过 package name `crewbee` 加载 CrewBee。

这与 `oh-my-openagent` 使用的 **package-name-first** 模型一致：

```json
{
  "plugin": ["crewbee"]
}
```

当 OpenCode 支持 package-name plugin resolution 时，这份配置可以让它从已发布的 npm package 中解析 CrewBee。

---

## 发布模型概览

### 1）本地开发流程（保留）

本地开发与验证使用：

```bash
npm install
npm run pack:local
npm run install:local:user
npm run doctor
```

产物：

- 稳定本地 tarball：`.artifacts/local/crewbee-local.tgz`
- OpenCode plugin config entry：`crewbee`

当你正在本地迭代，并希望发布前测试 package 时使用该流程。

### 2）Registry 发布流程

用于正式线上分发：

- npm package name：`crewbee`
- OpenCode config plugin entry：`crewbee`
- publish target：npm registry
- release automation：支持本地脚本和 GitHub Actions

---

## 方案 A：本地脚本发布流程

当你希望在本机准备或手动发布时使用该路径。

### 支持脚本

- `npm run pack:release`
  - 在 `.artifacts/release/` 中构建带版本号的 tarball
- `node ./scripts/release-registry.mjs --dryRun`
  - 计算下一个版本
  - 更新本地 package 文件
  - 运行 `typecheck`、`test`、`doctor`、simulators、`pack:release` 和 package smoke
  - **不发布**
- `node ./scripts/release-registry.mjs --publish`
  - 执行相同验证
  - 然后运行 `npm publish --access public --provenance --tag <tag>`
- Windows wrapper：
  - `scripts\release-registry.bat`

### 推荐本地发布步骤

#### Dry-run / preflight

```bash
node ./scripts/release-registry.mjs --dryRun
```

Windows：

```bat
scripts\release-registry.bat
```

#### 发布 patch 版本

```bash
node ./scripts/release-registry.mjs --publish --bump patch
```

#### 发布 minor 版本

```bash
node ./scripts/release-registry.mjs --publish --bump minor
```

#### 发布指定版本

```bash
node ./scripts/release-registry.mjs --publish --version 0.2.0
```

#### 发布 prerelease

```bash
node ./scripts/release-registry.mjs --publish --version 0.2.0-beta.1 --tag beta
```

### 本地发布脚本会做什么

1. 读取当前本地版本。
2. 在可用时读取 npm registry latest version。
3. 计算下一个版本。
4. 更新 `package.json` 和 `package-lock.json`。
5. 运行：
   - `npm run typecheck`
   - `npm run test`
   - `npm run doctor`
   - `npm run simulate:opencode`
   - `npm run simulate:compact`
   - `npm run pack:release`
   - `npm run smoke:package`
6. 可选发布到 npm。

> 注意：本地 publish 路径会请求 npm provenance。部分本地 shell 不会被 npm 识别为支持 provenance 的 provider。如果验证和 `pack:release` 已通过，但 npm 报错 `Automatic provenance generation not supported for provider: null`，可以在同一版本 checkout 下执行 `npm publish --access public --tag <tag>` 发布，并在发布记录 / handoff 中说明 provenance fallback。

### 本地脚本不会自动做什么

本地脚本只关注 package preparation 和 npm publish。

本地发布成功后，仍应显式执行 Git 步骤：

```bash
git add package.json package-lock.json
git commit -m "Release vX.Y.Z"
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
gh release create vX.Y.Z --generate-notes
```

这样可以让本地手动路径保持显式和安全。

---

## 方案 B：GitHub Actions 发布流程

这是推荐的 **official** release path。人正常将功能 / 修复 PR 合并到 `main`，需要发布时手动运行 `release-ci`。`release-ci` 通过后，版本号 bump、tag、npm publish 和 GitHub Release 会自动继续执行。

该流程要求仓库 secret 中配置 `CREWBEE_AUTOMATION_TOKEN`。该 token 必须允许 push 到 `main` 并 push tag；默认 `GITHUB_TOKEN` 不够，因为 GitHub 会抑制由 `GITHUB_TOKEN` push 触发的后续 workflow。

### CI workflow

文件：

```text
.github/workflows/ci.yml
```

它运行：

- `npm ci`
- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run simulate:opencode`
- `npm run simulate:compact`
- `npm run doctor`
- `npm run pack:release`
- 通过 `scripts/smoke-packed-package.mjs` 执行 packed package smoke

### CI/CD workflow map

| Workflow | 触发方式 | 职责 | 输出 |
| --- | --- | --- | --- |
| `.github/workflows/ci.yml` | push 到 `main`、任意 pull request | 验证普通开发改动 | 必要验证 checks |
| `.github/workflows/release-ci.yml` | release PR，或手动 `workflow_dispatch` | 验证 release candidate；手动发布时 gates 通过后 bump version | `main` 上的 `Release vX.Y.Z` commit |
| `.github/workflows/release-tag.yml` | push 到 `main` | 识别 version-only release commit，并创建不可变 tag | `vX.Y.Z` tag |
| `.github/workflows/publish.yml` | push `vX.Y.Z` tag | 发布 npm package，并创建 GitHub Release | npm release 与 GitHub Release |

普通功能 / 修复 PR 不应该修改 package version。维护者通过手动运行 `release-ci` 决定何时发布。

### Release CI workflow

文件：

```text
.github/workflows/release-ci.yml
```

触发方式：

- 目标分支是 `main`，且来源分支以 `release/v` 开头的 PR
- 或目标分支是 `main`，且带有 `release` label 的 PR
- 手动 `workflow_dispatch`，用于验证 `main`、bump package version，并推送 release commit

Release PR 要求：

- PR 必须来自本仓库，而不是 fork
- `package.json`、`package-lock.json` 和 release 分支中的版本号必须一致
- 目标版本不能已经存在于 npm
- PR 只能修改 `package.json` 和 `package-lock.json`

Release CI gates：

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run simulate:opencode`
- `npm run simulate:compact`
- `npm run doctor`
- `npm run pack:release`
- packed tarball smoke test
- 将本地 tarball 安装到 OpenCode 用户级 workspace
- `opencode models --print-logs --log-level DEBUG`
- `opencode agent list --print-logs --log-level DEBUG`

手动发布行为：

- 在当前 `main` 上运行同一套 release gates
- 根据 `patch`、`minor`、`major` 或指定版本计算下一版本
- 只更新 `package.json` 和 `package-lock.json`
- 直接向 `main` 提交 `Release vX.Y.Z`
- 让 `release-tag.yml` 根据该版本号变更创建 release tag

### Release tag workflow

文件：

```text
.github/workflows/release-tag.yml
```

触发方式：

- push 到 `main`

行为：

- 如果 push 到 `main` 时修改了 `package.json` 或 `package-lock.json`，校验两者包含相同 release version `X.Y.Z`
- 如果 `crewbee@X.Y.Z` 已经存在于 npm，则拒绝创建 tag
- 当 `vX.Y.Z` tag 不存在时，自动创建并 push 该 tag
- 未修改 package version 文件的 push 会被忽略

### Publish workflow

文件：

```text
.github/workflows/publish.yml
```

触发方式：

- push tag `vX.Y.Z`

### publish workflow 会做什么

1. checkout 不可变 release tag。
2. 校验 tag、`package.json`、`package-lock.json` 版本一致。
3. 如果该 npm version 已经发布，跳过 `npm publish`，继续执行发布后 smoke、`latest` promotion、latest 验证和 GitHub Release 创建。这用于同一个 tag 在 post-publish 步骤失败后的续跑。
4. 运行完整 release gates：`typecheck`、tests、build、simulators、doctor、pack、package smoke、真实 OpenCode loading smoke。
5. 如果该 npm version 尚未发布，将已验证 tarball 发布到 staging dist-tag：
   - stable release 先发布到 `next`
   - prerelease 发布到对应 prerelease tag，例如 `beta`
6. 从 npm registry 拉回刚发布的 package 并 smoke-test。
7. stable release 通过后，将 `crewbee@X.Y.Z` promote 到 `latest`。
8. stable release promote 后，从 registry 安装并再次运行 OpenCode smoke。
9. 创建 GitHub Release 并生成 notes。

### GitHub Actions 发布步骤

1. 正常将功能或修复 PR 合并到 `main`。
2. 准备发布时，手动运行 `release-ci` workflow。
3. 选择 `patch`、`minor`、`major`，或填写指定版本。
4. `release-ci` 在 `main` 上运行完整 release gates。
5. gates 全部通过后，`release-ci` 向 `main` 提交只修改 `package.json` 和 `package-lock.json` 的 `Release vX.Y.Z`。
6. `release-tag.yml` 检测 `main` 上的 package version bump 并自动创建 `vX.Y.Z`。
7. `publish.yml` 自动发布该 tag。
8. 成功后验证：
   - npm 存在 `crewbee@<version>`
   - `latest` 指向该 stable version
   - tag `v<version>` 存在
   - GitHub Release 存在

Release commit 刻意保持 version-only。这样既保留发布安全边界，也避免每次功能迭代都手写第二个 PR。

### 手动指定发布版本

如果某次发布需要指定版本号，不要手改 `package.json`，也不要在 publish 失败后 bump 新版本。标准入口仍然是手动运行 `release-ci`，并填写 `version` 输入。

GitHub UI 操作：

1. 打开 Actions -> `release-ci` -> Run workflow。
2. Branch 选择 `main`。
3. `version` 填写目标版本，例如 `0.2.0` 或 `0.2.0-beta.1`。
4. `bump` 会在填写 `version` 时被忽略，可以保留默认 `patch`。
5. 运行后等待 `release-ci`、`release-tag`、`publish` 完成。

如果让 Agent 执行，直接给出版本号即可，例如：

```text
请发布 CrewBee 0.2.0
```

Agent 应执行以下流程：

1. 确认工作区没有未提交的发布相关改动；不要读取或提交 `.crewbee/`、`.crewbeectxt/`、`.local/`。
2. 触发 `release-ci` 的 `workflow_dispatch`，参数为 `version=<目标版本>`，`bump=patch`。
3. 等待 `release-ci` 创建 `Release v<目标版本>` commit。
4. 等待 `release-tag.yml` 创建 `v<目标版本>` tag。
5. 等待 `publish.yml` 完成 npm publish、`latest` promotion、GitHub Release 创建。
6. 验证 `npm view crewbee version`、`npm view crewbee dist-tags --json` 和 GitHub Release。

失败处理规则：

- 如果失败发生在 `Publish npm package to staging dist-tag` 之前，修复 workflow 或环境后重跑同一个 tag / workflow，不增加版本号。
- 如果失败发生在 `npm publish` 成功之后，但 `latest` promotion、latest 验证或 GitHub Release 创建之前，修复 workflow 或环境后重跑同一个 tag / workflow；`publish.yml` 会检测到该版本已存在并跳过 `npm publish`，继续补全后续步骤。
- 只有已经决定发布一个新的产品版本时，才指定新的版本号。

---

## OpenCode 自动安装模型

CrewBee 发布后，目标 OpenCode config 应直接引用 package name：

```json
{
  "plugin": ["crewbee"]
}
```

### 为什么这样可行

CrewBee 当前写入和校验的 canonical plugin entry 是：

```text
crewbee
```

而不是 `file://.../opencode-plugin.mjs` 路径。

这与 `oh-my-openagent` 的模型一致：config 引用 package name，host / plugin workspace 解析已发布的 npm package。

### 本地 fallback

开发中或 package 尚未发布时，使用：

```bash
npm run install:local:user
```

它仍会把本地 tarball 安装进 OpenCode 用户级 workspace，但 config entry 仍保持相同的 canonical package name：

```json
{
  "plugin": ["crewbee"]
}
```

---

## 推荐操作策略

### 日常开发

使用保留的本地流程：

```bash
npm run install:local:user
```

### 发布前验证

使用本地 release preflight：

```bash
node ./scripts/release-registry.mjs --dryRun
```

### 正式发布

使用手动 `release-ci` 流程：

```text
workflow_dispatch release-ci -> Release vX.Y.Z commit -> automatic tag -> automatic publish
```

这保留了单一人工入口，同时使用不可变 tag 作为 publish 边界。

---

## 快速检查清单

发布前：

- `npm run typecheck`
- `npm run test`
- `npm run doctor`
- `npm run simulate:opencode`
- `npm run simulate:compact`
- `npm run pack:release`
- `npm run smoke:package`

发布后：

- npm 显示 `crewbee@<version>`
- OpenCode config 可以使用 `"crewbee"`
- `npm run install:registry:user` 成功
- `npm run doctor` 健康
