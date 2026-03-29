# CrewBee

[English](README.md) | [简体中文](README.zh-CN.md)

CrewBee 是一个 **Team-first（团队优先）** 的 Agent Team 框架。

它的目标不是再做一个“提示词包”，也不是直接做一个“多 Agent 执行引擎”，而是把下面这些长期会反复出现的问题，抽象成一套清晰、可维护、可移植的工程框架：

- 什么是一个 Team？
- Team 中哪些角色是对用户可见的入口？
- 哪些能力属于 Team / Agent 的宿主无关定义？
- 一套 Team / Agent 定义，如何稳定投影为具体宿主里的可用 Agent？
- 如何在不把框架做成 prompt 杂糅物的前提下，得到高质量、可执行的 Agent Prompt？

当前版本已经打通了 **CrewBee → OpenCode** 的完整 MVP 链路：

- Team / Agent 宿主无关定义
- Team Library 装配与校验
- Runtime Projection 与 formal leader 默认入口选择
- OpenCode agent 配置投影、别名、配置补丁与 session binding
- OpenCode 插件入口、delegation 工具、事件接线与系统提示注入
- 本地构建、用户级安装、doctor 校验与卸载流程

> 简单理解：
>
> **CrewBee = Agent Team 定义框架 + Runtime Projection 层 + 宿主适配层（当前为 OpenCode）**

---

## 目录

- [CrewBee 是什么](#crewbee-是什么)
- [当前已实现的能力](#当前已实现的能力)
- [核心亮点](#核心亮点)
- [安装](#安装)
- [快速开始](#快速开始)
- [当前架构一览](#当前架构一览)
- [Agent Team 与 Agent Profile 定义方式](#agent-team-与-agent-profile-定义方式)
- [OpenCode 运行时是如何工作的](#opencode-运行时是如何工作的)
- [配置、安装与运维脚本](#配置安装与运维脚本)
- [卸载](#卸载)
- [当前未实现的部分](#当前未实现的部分)
- [推荐阅读顺序](#推荐阅读顺序)
- [作者说明 / 项目方向](#作者说明--项目方向)

---

## CrewBee 是什么

CrewBee 的定位可以用一句话概括：

> **一个 Team-first 的 Agent 定义、投影与宿主适配框架。**

它不把“角色 prompt”当成最终产物，而是把完整 Team package 当成一等对象来管理。

当前的 Team package 由这些静态资产组成：

```text
<team-id>/
  team.manifest.yaml
  team.policy.yaml
  agents/
    *.agent.md
  docs/
    TEAM.md
```

其中：

- `team.manifest.yaml`：Team 的身份、leader、members、workflow、runtime 覆写等工程主入口
- `team.policy.yaml`：团队共享规则、安全边界、质量底线、Working Rules
- `agents/*.agent.md`：单个 Agent Profile
- `docs/TEAM.md`：面向人的 Team 说明文档

CrewBee 当前不会强行替你自动选择 Team，也不会替你自动判断“应该走什么组织结构”。

第一阶段的基本思想是：

- 用户选择 Team
- 用户选择或进入一个入口 Agent
- CrewBee 负责把这套 Team 定义稳定投影到宿主中运行

---

## 当前已实现的能力

### 1. Team-first 静态模型

- `src/core`：定义 Team / Agent / Runtime / Host Capability 契约
- `src/agent-teams`：Team library 加载、解析、校验与内置 Team 装配
- `AgentTeams/`：文件型 Team，如 `GeneralTeam`、`WukongTeam`、`AgentTeamTemplate`

### 2. 宿主无关的 Runtime Projection

- `src/runtime/team-library-projection.ts`
  - formal leader 默认入口选择
  - user-selectable / internal agent 划分
  - Team / Agent 投影排序
- `src/runtime/types.ts`
  - ProjectedAgent / ProjectedTeam / SessionRuntimeBinding

### 3. OpenCode 适配器与插件运行时

- `src/adapters/opencode/bootstrap.ts`
  - OpenCode 侧 bootstrap 入口
- `src/adapters/opencode/projection.ts`
  - projected agent → OpenCode agent config
- `src/adapters/opencode/config-merge.ts`
  - 安全合并 CrewBee agent 到宿主 config
- `src/adapters/opencode/plugin.ts`
  - 真实 OpenCode 插件运行时 hooks
- `src/adapters/opencode/prompt-builder.ts`
  - Team Contract / Agent Contract prompt 生成

### 4. 用户级安装与运维链路

- `src/install/install-root.ts`
- `src/install/workspace.ts`
- `src/install/package-manager.ts`
- `src/install/plugin-entry.ts`
- `src/install/config-writer.ts`
- `src/install/doctor.ts`

它们负责：

- 构建本地 tarball
- 安装到 OpenCode 用户级 workspace
- 写入 canonical `file://` 插件入口
- 做 doctor 校验

---

## 核心亮点

### 1. Team-first，而不是零散 Agent-first

CrewBee 把 Team 当成一等对象，而不是只关心一个个散落的 agent prompt。

这意味着：

- Team 有 formal leader
- Team 有 policy
- Team 有 members 和 workflow
- Team 有宿主无关骨架

### 2. Prompt 既低耦合，又保留执行语义

CrewBee 没有回退到“每个字段一个 schema / 一个 renderer”的旧路，也没有退化成“top-level block 全透明 dump”。

当前采用的是：

> **少量公共语义骨架 section + 通用结构处理 + 结构渲染**

例如 Agent prompt 的骨架顺序会围绕执行心智组织：

- Persona Core
- Responsibility Core
- Core Principle
- Scope Control
- Ambiguity Policy
- Support Triggers
- Collaboration
- Task Triage
- Delegation & Review
- Todo Discipline
- Completion Gate
- Failure Recovery
- Operations
- Output Contract
- Templates
- Guardrails
- Heuristics
- Anti Patterns
- Tool Skill Strategy

这样模型更容易快速建立：

- 我是谁
- 我负责什么
- 我默认怎么行动
- 什么时候委派 / 评审 / 提问 / 停下
- 完成标准是什么
- 失败时如何恢复

### 3. Collaboration 会生成可直接委派的 agent 清单

当前生成的 `Collaboration` 不再只是简单列 profile 里的协作绑定，而是会结合：

- Agent Profile 中声明的合作 subagent 列表
- Team Manifest 中的 `members` 描述
- OpenCode 侧可解析的 projected id

从而在 prompt 中生成：

- `Id`
- `Description`
- `When To Delegate`

便于在运行时直接委派。

### 4. Team Contract 已压缩为可执行手册，而不是配置 dump

Team prompt 最终不是直接渲染整块 `governance`，而是收敛为：

- `Working Rules`
- `Approval & Safety`

这让 Team 合同更适合模型消费，也避免了治理字段机械展开。

---

## 安装

### 给人类的最短路径

如果你在用 LLM Agent，直接把下面这段发给它：

```text
请按照当前仓库中的 docs/guide/installation.md 完成 CrewBee 安装。
只使用 OpenCode 用户级安装流程，不要使用旧的 project-local 安装方式。
```

或者你自己阅读：

- [安装指南](docs/guide/installation.md)

### 给 LLM Agent 的最短路径

直接读取并执行：

```text
docs/guide/installation.md
```

### Windows 一键本地安装脚本

仓库已经提供：

```bat
scripts\install-local-user.bat
```

它会自动执行：

1. `npm install`
2. `npm run install:local:user`
3. `npm run doctor`

---

## 快速开始

### 开发构建

```bash
npm install
npm run typecheck
npm run build
```

### 本地用户级安装

推荐从仓库根目录执行：

```bash
npm install
npm run install:local:user
```

这会做四件事：

1. 构建 CrewBee
2. 打包稳定本地 tarball 到 `.artifacts/local/crewbee-local.tgz`
3. 安装到 OpenCode 用户级 workspace
4. 重写 OpenCode config 指向 canonical 插件入口

### 验证安装

```bash
npm run doctor
```

### 在 OpenCode 中使用

安装完成后：

1. 打开任意项目
2. 选择 CrewBee 投影出的 agent（例如 `[CodingTeam]leader`）
3. 正常发送请求

---

## 当前架构一览

```text
Team Definitions
  -> TeamLibrary
  -> TeamLibrary Projection
  -> OpenCode Bootstrap
  -> OpenCode Config Patch + Session Binding
  -> OpenCode Plugin Hooks

User-level install
  -> local tarball
  -> OpenCode user-level workspace
  -> canonical file:// plugin entry
  -> OpenCode config
```

### 代码层级对应

| 层 | 作用 | 主要目录 / 文件 |
| --- | --- | --- |
| Core Contracts | 定义宿主无关 Team / Agent / Runtime 合同 | `src/core/index.ts` |
| Team Library | 装配内置 Team 与文件型 Team | `src/agent-teams/*` |
| Runtime Projection | 生成 projected teams / agents / session binding | `src/runtime/*` |
| Host Adapter | 把投影结果映射到 OpenCode | `src/adapters/opencode/*` |
| Plugin Entry | 让 OpenCode 实际加载 CrewBee | `src/adapters/opencode/plugin.ts`, `opencode-plugin.mjs` |
| Install Flow | 用户级安装、doctor、卸载 | `src/install/*`, `bin/crewbee.js` |

---

## Agent Team 与 Agent Profile 定义方式

### Team 定义

#### `team.manifest.yaml`

负责：

- Team 身份
- leader
- members
- workflow
- agent runtime 覆写
- tags

#### `team.policy.yaml`

负责：

- instruction precedence
- approval policy
- forbidden actions
- quality floor
- working rules

并最终压缩成 Team Contract 的两个 section：

- `Working Rules`
- `Approval & Safety`

### Agent Profile 定义

对 Agent Team 的设计者来说，最重要的是把 Team 和 Agent 的**定义框架**设计清楚，而不是关心 Prompt Pipeline 的内部实现细节。

可以把 CrewBee 的定义框架理解成两层：

1. **Team 层**：定义团队身份、成员关系、共享规则、workflow 与入口角色
2. **Agent 层**：定义每个 Agent 是谁、负责什么、默认怎么行动、什么时候委派 / 评审 / 停下

只要 Team 与 Agent 的定义结构设计得清晰，CrewBee 会负责把它们投影成宿主中可用的 Agent 与 Prompt。

最新推荐的一等 section：

- `persona_core`
- `responsibility_core`
- `core_principle`
- `scope_control`
- `ambiguity_policy`
- `support_triggers`
- `collaboration`
- `task_triage`
- `delegation_review`
- `todo_discipline`
- `completion_gate`
- `failure_recovery`
- `operations`
- `output_contract`
- `templates`
- `guardrails`
- `heuristics`
- `anti_patterns`
- `tool_skill_strategy`

extra top-level section 仍允许存在，但会排在公共语义骨架之后。

### 为什么定义框架比 Prompt 技巧更重要

对于 Team 设计者与使用者来说，真正长期稳定的资产不是某段 prompt 文本，而是：

- Team 的角色结构是否清晰
- 共享规则是否清晰
- Agent 的职责与默认行动模式是否清晰
- 协作边界、完成标准、失败恢复是否被定义成稳定 section

因此，CrewBee 推荐把这些内容直接写进 Profile，而不是依赖后续运行时再“猜”或“拆”。

换句话说：

- Team / Agent 设计者关心 **定义框架**
- CrewBee 框架负责 **投影与生成**
- 最终使用者关心 **选择哪个 Team / 哪个入口 Agent 来完成任务**

### Prompt Projection

当前只支持：

```yaml
prompt_projection:
  include:
    - persona_core
    - responsibility_core.description
  exclude:
    - metadata.tags
  labels:
    delegation_review: Delegation & Review
```

约束：

- 只允许 `snake_case` path
- 不支持 `projection_schema`
- 不支持 camelCase path

---

## OpenCode 运行时是如何工作的

当前 OpenCode 插件链路大致如下：

```text
package.json
  -> opencode-plugin.mjs
  -> dist/src/adapters/opencode/plugin.js
  -> src/adapters/opencode/plugin.ts
```

### 插件初始化时会做什么

1. 加载默认 Team Library
2. 校验 Team Library
3. 生成 bootstrap 结果
4. 生成 alias index
5. 初始化 session binding store
6. 初始化 delegation state store

### 关键 Hook

#### `config`

把 CrewBee projected agents 注入 OpenCode config。

#### `chat.message`

读取用户当前选择的 agent，并建立 CrewBee 视角下的 session binding。

#### `tool` / delegation tools

注册：

- `delegate_task`
- `delegate_status`
- `delegate_cancel`

#### `tool.execute.before`

把 `task` 的 `subagent_type` 从别名重写成 projected config key。

#### `experimental.chat.system.transform`

向系统提示注入最小 CrewBee 运行时说明：

- Team
- Entry Agent
- Active Owner
- Mode

---

## 配置、安装与运维脚本

### 常用脚本

```bash
npm run build
npm run typecheck
npm run test
npm run pack:local
npm run install:local:user
npm run doctor
npm run uninstall:user
npm run simulate:opencode
```

### 说明

- `pack:local`：打包本地 tarball
- `install:local:user`：执行完整用户级安装
- `doctor`：校验 OpenCode 配置与安装状态
- `simulate:opencode`：运行本地 OpenCode runtime simulator

### 用户级 workspace 默认路径

```text
Config root:  ~/.config/opencode
Install root: ~/.cache/opencode/crewbee
```

Windows 下默认仍优先使用：

```text
~/.config/opencode
```

若已有 OpenCode 配置位于 `%APPDATA%/opencode`，则会按现有配置位置回退兼容。

---

## 卸载

推荐使用：

```bash
npm run uninstall:user
```

它会：

- 从 OpenCode config 中移除 CrewBee 插件入口
- 从用户级 workspace 中移除安装包

如果你只想验证是否已经卸载干净，可再运行：

```bash
npm run doctor
```

---

## 当前未实现的部分

CrewBee 当前故意不做成“大而全”的多 Agent 平台。

目前还没有实现：

- OpenCode 之外的完整多宿主运行时
- 完整且宿主无关的 Team-collaboration 执行引擎
- 独立的 Manager 产品入口
- 在线 registry 安装流（`--source registry` 仍是保留口）
- 独立平台二进制分发

也就是说，当前版本的重点是：

> **把 Team 定义、Prompt 投影、OpenCode 适配和本地安装链路做实。**

---

## 推荐阅读顺序

建议按下面顺序理解整个项目：

1. `README.md` / `README.zh-CN.md`
2. `docs/guide/installation.md`
3. `docs/architecture.md`
4. `docs/opencode-runtime-flow.md`
5. `docs/internal/CrewBee 项目书.md`
6. `docs/internal/OpenCode适配设计.md`
7. `docs/internal/Agent Team Prompt Framework 最终代码落地清单.md`

如果你要深入理解最新 prompt / profile 设计，还建议继续看：

- `docs/internal/AgentTeam定义范式文档-1-AgentProfile.md`
- `docs/internal/AgentTeam定义范式文档-2-其他Team文档.md`
- `docs/internal/Agent定义范式.md`

---

## 作者说明 / 项目方向

CrewBee 当前阶段的目标不是做“功能最多的 Agent 工具箱”，而是把下面三件事做扎实：

1. Agent Team 的定义范式
2. Team-first 到 Host Runtime 的投影链路
3. 强执行型 Agent Prompt 的工程化生成方式

也就是说，CrewBee 更关心的是：

- Team 如何被定义得足够清晰
- Prompt 如何既保持低耦合又保持强执行语义
- 宿主适配如何稳定、可维护、可扩展

如果你把它理解成：

> “把 Team / Agent / Prompt / Host Adapter 当成可维护软件系统来做，而不是把它们写成一堆临时 prompt 技巧。”

那么你就理解对了。

欢迎基于这个方向继续改进：

- Team 定义结构
- Prompt 语义骨架
- Runtime Projection
- OpenCode 适配
- 安装与运维体验
