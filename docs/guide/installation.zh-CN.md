# 安装指南

语言：[English](./installation.md) | 中文

## Quick Start

用一条命令为 OpenCode 安装 CrewBee：

```bash
npx crewbee@latest setup --with-opencode
```

然后打开你的项目：

```bash
cd /path/to/your/project
opencode
```

选择：

```text
coding-leader
```

CrewBee 会安装到 OpenCode 用户级 workspace，写入标准 plugin entry `"crewbee"`，运行 doctor 检查，并提示下一步。它不会安装到业务项目的 `node_modules`，也不会修改业务仓库文件。

## 已经安装 OpenCode

如果 OpenCode 已经安装并且可以在终端中直接运行：

```bash
npx crewbee@latest setup
```

如果 OpenCode 不存在，使用推荐命令：

```bash
npx crewbee@latest setup --with-opencode
```

使用 `--with-opencode` 时，CrewBee 会通过 OpenCode 官方支持的 npm 包路径安装 OpenCode：

```bash
npm install -g opencode-ai
```

如果全局 npm 没有写权限，请先按 OpenCode 官方文档手动安装 OpenCode，然后重新运行 `npx crewbee@latest setup`。

## `setup` 会做什么

```text
检测运行时与 OpenCode
→ 如果 OpenCode 缺失且设置了 --with-opencode，则安装 OpenCode
→ 把 crewbee@latest 安装到 OpenCode 用户级 workspace
→ 写配置前备份 OpenCode config
→ 写入 OpenCode plugin entry: "crewbee"
→ 创建或修复 CrewBee 用户级 crewbee.json
→ 运行 crewbee doctor
→ 提示如何启动 OpenCode 并选择 coding-leader
```

默认路径：

```text
Config root:  ~/.config/opencode
Install root: ~/.cache/opencode
```

Windows 上推荐使用 WSL 以获得最佳 OpenCode 体验。原生 Windows 也可以使用，只要 OpenCode 已经在 `PATH` 中；OpenCode 可通过 npm、Chocolatey 或 Scoop 安装。

## 官网安装区文案

首页安装卡建议使用：

```text
安装 CrewBee

一条命令为 OpenCode 配置 CrewBee。
不安装到业务项目 node_modules，不需要手动改配置。
```

```bash
npx crewbee@latest setup --with-opencode
```

三步安装区：

```text
1. 安装并配置 CrewBee
2. 在项目中启动 opencode
3. 选择 coding-leader，运行真实任务
```

## 官网安装 Tab

### Recommended

```bash
npx crewbee@latest setup --with-opencode
```

最适合首次使用。OpenCode 缺失时自动安装 OpenCode，然后安装 CrewBee、写入 OpenCode plugin entry，并运行 doctor。

### Already have OpenCode

```bash
npx crewbee@latest setup
```

适合已经安装 OpenCode 且终端可直接运行 `opencode` 的用户。

### For LLM Agents

```bash
npx crewbee@latest setup --with-opencode --yes
npx crewbee@latest doctor
```

重要约束：

```text
不要把 CrewBee 安装进当前业务项目的 node_modules。
不要手动修改业务项目文件。
CrewBee 应安装到 OpenCode 用户级 workspace。
OpenCode plugin entry 应该是 "crewbee"。
安装后告诉用户：在项目中运行 `opencode`，然后选择 `coding-leader`。
```

## CLI 参考

### Setup

```bash
npx crewbee@latest setup [options]
```

参数：

```text
--with-opencode       OpenCode 缺失时自动安装 OpenCode
--yes, -y             非交互模式，适合 LLM Agent / 复制即跑
--doctor              安装后运行 doctor，默认 true
--no-doctor           跳过 doctor
--dry-run             只展示计划，不修改文件
--force               强制重装 CrewBee
--channel stable      安装稳定版 npm dist-tag，默认
--channel next        安装 next npm dist-tag
--config-path <path>  指定 OpenCode config 文件
--install-root <path> 指定 OpenCode 用户级安装根目录
--verbose             输出更多 setup 信息
```

### 验证

```bash
npx crewbee@latest doctor
```

Doctor 会检查 OpenCode config、用户级安装 workspace、package layout、plugin entry、plugin 文件和内置 Team 定义。

### 更新

```bash
npx crewbee@latest update
```

使用 `--channel next` 可以更新到 next dist-tag。

### 卸载

```bash
npx crewbee@latest uninstall
```

这会从 OpenCode config 中移除 CrewBee entry，并从 OpenCode 用户级 workspace 中移除 CrewBee。默认保留用户 Team 配置，除非未来显式使用 purge 选项。

## 安全模型

CrewBee setup 默认保守：

```text
不安装到业务项目 node_modules
不修改业务仓库文件
写入前备份 OpenCode config
setup / uninstall 失败时回滚 OpenCode config
只使用标准 plugin entry: "crewbee"
支持 dry-run 透明预览
```

dry-run 示例：

```bash
npx crewbee@latest setup --with-opencode --dry-run
```

## 开发者本地安装

本地 tarball 路径只给贡献者和维护者，不是首次用户路径：

```bash
npm install
npm run pack:local
npm run install:local:user
npm run doctor
```

本地 tarball 输出到：

```text
.artifacts/local/crewbee-local.tgz
```

## 项目级 Team

CrewBee 支持全局 Team 和项目 Team。项目 Team 从当前 OpenCode worktree 注册：

```text
<project-worktree>/.crewbee/crewbee.json
```

完整设计和示例见：

```text
docs/guide/project-team-config.md
```
