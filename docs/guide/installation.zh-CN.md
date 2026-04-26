# 安装指南

语言：[English](./installation.md) | 中文

## 当前范围

CrewBee 当前支持两条安装路径：

```text
本地开发：构建本地包 -> 安装到 OpenCode 用户级 workspace -> 写入 canonical package-name plugin entry
线上安装：从 npm registry 安装已发布的 crewbee 包 -> 写入 canonical package-name plugin entry
```

## 新旧流程

### 历史上的项目本地安装流程

```text
构建本地包 -> 把 tarball 安装到目标项目 -> 在该项目内运行 npx crewbee install
```

### 当前用户级安装流程

```text
构建本地包 -> 安装 tarball 到 ~/.cache/opencode -> 把 package-name plugin entry 写入 ~/.config/opencode/opencode.json(c)
```

CrewBee 当前支持并推荐新的用户级安装流程。

## 给使用者的最短说明

如果你让 Agent 帮你安装，可以直接粘贴：

```text
请按照本仓库 docs/guide/installation.zh-CN.md 安装 CrewBee。
如果 CrewBee 已经发布到 npm，优先使用 registry flow；否则使用本地 user-level flow。
```

## 给 LLM Agent 的说明

优先使用 registry flow；开发场景使用 local user-level flow。不要把 CrewBee 安装进业务项目的 `node_modules`。

## Step 1：本地构建并打包 CrewBee

在 CrewBee 仓库中运行：

```bash
npm install
npm run pack:local
```

这会生成稳定的本地 tarball：

```text
.artifacts/local/crewbee-local.tgz
```

`npm run pack:local` 会触发 `npm pack`，而 `prepack` 会在生成 tarball 前重新构建插件。

## Step 2：安装到 OpenCode 用户级 workspace

### 推荐：已发布版本 / registry flow

当 `crewbee` 已发布到 npm 后，使用：

```bash
npm run install:registry:user
```

等价于：

```bash
node ./bin/crewbee.js install --source registry
```

安装器会把已发布的 `crewbee` 包安装到 OpenCode 用户级 workspace，并把 canonical plugin entry `"crewbee"` 写入 OpenCode config。

### 本地开发 flow

在 CrewBee 仓库根目录运行：

```bash
npm run install:local:user
```

等价于：

```bash
node ./bin/crewbee.js install --source local --local-tarball ./.artifacts/local/crewbee-local.tgz
```

安装器会完成：

1. 解析 OpenCode config root
2. 解析 CrewBee install root
3. 初始化最小用户级 package workspace
4. 把本地 tarball 安装进该 workspace
5. 定位已安装的 `opencode-plugin.mjs`
6. 把 OpenCode config 重写为 canonical package-name plugin entry

## Step 3：理解用户级路径

默认情况下，CrewBee 使用两个 root：

```text
Config root:  ~/.config/opencode
Install root: ~/.cache/opencode
```

Windows 上 config root 仍优先使用跨平台的 `~/.config/opencode`，当已有 OpenCode config 位于 `%APPDATA%/opencode` 时会兼容该位置。

开发时可以覆盖路径：

```bash
node ./bin/crewbee.js install --source local --local-tarball ./.artifacts/local/crewbee-local.tgz --install-root /tmp/crewbee-user-root --config-path /tmp/opencode.json
```

## Step 4：验证安装

运行：

```bash
npm run doctor
npm run version
```

或直接运行：

```bash
node ./bin/crewbee.js doctor
```

你应看到：

- workspace manifest 存在
- 已安装 package 存在
- plugin 文件存在
- OpenCode config entry 与 canonical user-level plugin entry 一致

`npm run version` / `crewbee version` 会直接报告 `package.json` 中的语义化版本。CrewBee 当前不额外引入 build-id 层。

canonical plugin entry 是：

```text
crewbee
```

CrewBee 在 OpenCode cache root 内使用标准 Node package layout：

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

OpenCode 应通过 package name 解析 CrewBee；用户级 workspace 则保证 `node_modules/crewbee` 下存在已安装包。

## Step 5：在 OpenCode 中使用 CrewBee

OpenCode 加载插件后：

1. 在 OpenCode 中打开任意项目
2. 选择一个 CrewBee projected agent，例如 `coding-leader`
3. 正常发送请求

CrewBee 不再绑定到某个目标项目的 `node_modules` 安装。

### 可选：添加项目级 Team

CrewBee 同时支持全局 Team 和项目 Team。全局 Team 从 OpenCode config root 注册：

```text
~/.config/opencode/crewbee.json
```

项目 Team 从当前 OpenCode worktree 注册：

```text
<project-worktree>/.crewbee/crewbee.json
```

两个文件使用相同的 `teams` schema。项目 Team 不走单独的 project-only pipeline，而是和全局 Team 一样被归一化为 Team registration source；它只因为当前 worktree 的 source precedence 更高而优先。

最小项目配置：

```json
{
  "teams": [
    { "path": "@teams/project-team", "enabled": true, "priority": 0 }
  ]
}
```

在该配置中，`@teams/project-team` 解析为：

```text
<project-worktree>/.crewbee/teams/project-team
```

如果项目 Team 有 user-selectable formal leader，该 leader 会成为当前 OpenCode 实例的默认 Agent；全局 Team 仍以较低 source precedence 保持可用。完整设计与示例见：

```text
docs/guide/project-team-config.md
```

## Step 6：从旧项目本地模式迁移

如果你的 OpenCode config 仍包含旧项目本地 CrewBee entry，例如：

```text
file:///some/project/node_modules/crewbee/opencode-plugin.mjs
```

运行一次新安装器：

```bash
npm run install:local:user
```

CrewBee 会把旧 project-local entry 替换为 canonical user-level package entry。

它也会迁移早期 user-level install 使用过的 standalone shim 路径，例如：

```text
file://~/.cache/opencode/crewbee/entry/crewbee-opencode-entry.mjs
```

迁移为：

```text
crewbee
```

## Step 7：从用户级 workspace 卸载

运行：

```bash
npm run uninstall:user
```

或直接运行：

```bash
node ./bin/crewbee.js uninstall:user
```

这会从 OpenCode config 中移除 CrewBee entry，并从用户级 workspace 中移除已安装 package。

## 发布与 package-name 安装

CrewBee 设计为 npm package `crewbee`。

发布后，OpenCode config 可以直接用 package name 引用插件：

```json
{
  "plugin": ["crewbee"]
}
```

这与 `oh-my-openagent` 的 package-name-first 安装模型一致。

完整发布流程和操作清单见：

```text
docs/guide/release.zh-CN.md
```
