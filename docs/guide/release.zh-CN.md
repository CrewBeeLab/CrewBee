# 发布指南

语言：[English](./release.md) | 中文

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
  - 运行 `typecheck`、`test`、`doctor`、`pack:release`
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
   - `npm run pack:release`
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

这是推荐的 **official** release path。

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

### Publish workflow

文件：

```text
.github/workflows/publish.yml
```

触发方式：

- GitHub Actions manual dispatch

输入：

- `bump`：`patch | minor | major`
- `version`：可选显式版本覆盖

### publish workflow 会做什么

1. 运行 `test`、`typecheck`、`build` gates。
2. 计算 release version。
3. 检查该版本是否已经存在于 npm。
4. 更新 `package.json` 和 `package-lock.json`。
5. 构建 package。
6. 发布 `crewbee` 到 npm。
7. 把 release version commit 回仓库。
8. 推送版本 commit。
9. 创建 git tag。
10. 创建 GitHub Release 并生成 notes。

### GitHub Actions 发布步骤

1. 打开 **Actions**。
2. 打开 **publish** workflow。
3. 点击 **Run workflow**。
4. 选择：
   - `bump = patch|minor|major`，或
   - 设置显式 `version`
5. 运行 workflow。
6. 成功后验证：
   - npm 存在 `crewbee@<version>`
   - repo 包含 commit `Release v<version>`
   - tag `v<version>` 存在
   - GitHub Release 存在

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

优先使用 GitHub Actions：

```text
Actions -> publish -> Run workflow
```

这是最安全、最可复现的路径。

---

## 快速检查清单

发布前：

- `npm run typecheck`
- `npm run test`
- `npm run doctor`
- `npm run pack:release`

发布后：

- npm 显示 `crewbee@<version>`
- OpenCode config 可以使用 `"crewbee"`
- `npm run install:registry:user` 成功
- `npm run doctor` 健康
