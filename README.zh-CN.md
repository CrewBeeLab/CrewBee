# CrewBee

[English](README.md) | [简体中文](README.zh-CN.md)

<p align="center">
  <img src="assets/crewbee-intro.png" alt="Turn scattered agents into real teams" width="100%" />
</p>

<p align="center"><strong>面向 OpenCode 的 Agent Team 框架。</strong></p>

CrewBee 支持为不同任务 / 项目设计不同的 **Agent Team**，并根据任务复杂度灵活切换 **单 Agent 执行** 与 **多 Agent 协作**。

它不是提示词包，也不是强制多 Agent 仪式，而是把 Agent 的角色分工、协作方式、上下文管理、review 方式、验收标准和宿主适配整理成可维护、可运行、可复用的 Team 工程资产。

**当前重点：**让 Team 级 Agent 系统能够被稳定定义、跨宿主投影，并真正运行在 OpenCode 中。

---

## 为什么是 CrewBee

* **为不同任务 / 项目设计不同 Agent Team** —— 不同工作可以拥有不同角色分工、规则、流程和完成标准。
* **根据任务复杂度切换单 Agent 与多 Agent 协作模式** —— 简单任务保持敏捷，复杂任务启用团队协作、支援、review 和验证。
* **主 Agent 持有最完整上下文** —— 由主 Agent 统一持有用户目标、项目约束、支援结论、review 意见和验证结果，保证关键决策依据更全面。
* **上下文隔离式委派** —— 支援 Agent 在独立上下文中完成探索、研究和审查，只把高信号结论回传给主 Agent，降低主 Agent 的上下文与注意力负担。
* **内置成熟 Coding Team** —— 内置 Coding Team 包含清晰角色分工、review 方式与验收标准，适合代码开发、修复、调试、重构和验证。
* **跨会话 Project Context 方向** —— 下一阶段将增强自动维护 project context 的能力，让长期项目持续保有项目定位、框架设计、历史记录、当前状态与计划等摘要信息。
* **可复制、可修改、可贡献的 Team 模板体系** —— Team 是可以沉淀、版本化和分享的工程资产。

当前版本已经打通了 **CrewBee → OpenCode** 的完整 MVP 链路：

* Team / Agent 宿主无关定义
* Team Library 装配与校验
* Runtime Projection 与 formal leader 默认入口选择
* OpenCode agent 配置投影、别名、配置补丁与 session binding
* OpenCode 插件入口、delegation 工具、事件接线与系统提示注入
* 本地构建、用户级安装、doctor 校验与卸载流程

> 简单理解：
>
> **CrewBee = Agent Team 定义框架 + Runtime Projection 层 + 宿主适配层（当前为 OpenCode）**

---

## 快速入口

* [CrewBeeLab 官网](https://crewbeelab.github.io)
* [安装指南](docs/guide/installation.zh-CN.md)
* [自定义 Agent Team 指南](docs/guide/custom-agent-team.md)
* [项目级 Team 配置指南](docs/guide/project-team-config.md)
* [发布指南](docs/guide/release.zh-CN.md)

英文文档请从 [README.md](README.md) 进入，并优先阅读 `docs/guide` 下的英文指南文件。

---

## OpenCode 中的 Agent ID

CrewBee 统一使用单一的 **canonical agent id**，贯穿投影、默认选择、session binding、delegation 和用户可见名称。

例如：

* `coding-leader`
* `coding-executor`
* `coding-reviewer`

同一个 id 会同时用于 OpenCode `default_agent`、session 中显式选择的 agent、delegation 目标，以及用户可见的运行时 / 配置 id。

---

## 目录

* [CrewBee 是什么](#crewbee-是什么)
* [CrewBee 解决什么问题](#crewbee-解决什么问题)
* [核心特性](#核心特性)
* [安装](#安装)
* [快速开始](#快速开始)
* [Agent Team 与 Agent Profile 定义方式](#agent-team-与-agent-profile-定义方式)
* [OpenCode 运行时是如何工作的](#opencode-运行时是如何工作的)
* [内置 Coding Team 的设计思想](#内置-coding-team-的设计思想)
* [下一步：Project Context](#下一步project-context)
* [配置、安装与运维脚本](#配置安装与运维脚本)
* [卸载](#卸载)
* [致谢](#致谢)

---

## CrewBee 是什么

CrewBee 是一个面向真实宿主运行时的 Agent Team 框架。

在 CrewBee 里，真正的一等对象不是单个 Agent，而是 **Team**。一个 Team 不是几段 prompt 的拼接，而是一个有结构的定义单元，至少包含：

* Team 身份与定位
* formal leader
* members
* workflow
* Team 共享规则
* Agent Profiles
* Prompt Projection
* 宿主运行时映射

CrewBee 的目标是把零散的 Agent prompt、规则和协作约定沉淀为可维护、可迁移、可运行的 Team 资产。

当前阶段的基本使用方式是：

* 用户在宿主中选择 Team 的入口 Agent
* CrewBee 负责把 Team 定义稳定投影到宿主中运行
* 运行时通过 session binding、delegation 与系统提示注入维持 Team 语义

CrewBee 当前不会强行替你自动选择 Team，也不会替你自动判断所有任务的组织结构。它优先把 Team 定义、Team 投影、运行时绑定和 OpenCode 适配做扎实。

---

## CrewBee 解决什么问题

CrewBee 主要解决七类问题。

### 1. 为不同任务 / 项目设计不同 Agent Team

Coding、调研、写作、分析、推广、长期项目维护并不是同一种工作。它们需要不同的角色结构、工作规则、工具边界、review 方式和完成标准。

CrewBee 允许你为不同任务 / 项目设计不同 Agent Team，而不是用一套越来越长的通用 prompt 处理所有工作。

### 2. 根据任务复杂度灵活切换单 Agent 与多 Agent 协作模式

简单任务需要快速响应、少 token、少步骤；复杂任务才需要支援 Agent、独立 review、验证和更明确的完成闸门。

CrewBee 的设计目标不是默认让所有任务都变成多 Agent 协作，而是支持根据任务复杂度选择合适的执行方式。

### 3. 主 Agent 持有最完整上下文，保证决策依据的全面性

复杂任务中，代码探索、外部调研、review 和验证都可能产生关键信息。

CrewBee 强调由主 Agent / formal leader 持有最完整的任务上下文，统一汇总用户目标、项目约束、支援结论、review 意见和验证结果，再进行关键判断与最终收口。

### 4. 上下文隔离式委派，降低主 Agent 的上下文与注意力负担

复杂任务不应该把所有搜索过程、支线探索、失败路径和低信号材料都塞进主 Agent 上下文。

CrewBee 通过 delegation 让支援 Agent 在独立上下文中完成代码探索、资料研究、review 或多模态解读，再把高信号结论回传给主 Agent。这可以减少主上下文污染，也降低主 Agent 的注意力负担。

### 5. 内置成熟 Coding Team，含 review 方式与验收标准

代码任务不只需要生成实现，还需要代码定位、外部资料、独立 review、验证证据和完成标准。

CrewBee 内置 Coding Team 用直接职责命名组织角色，并强调 review 与验收标准，帮助复杂代码任务更可靠地收口。

### 6. 跨会话 Project Context 方向

长期项目不应该每次新会话都从零解释项目定位、框架设计、历史记录、当前状态和下一步计划。

CrewBee 下一阶段将增强跨会话自动维护 project context 的能力，让 Agent 能基于项目摘要启发式阅读代码，减少完整阅读工程代码带来的上下文消耗。

### 7. 可复制、可修改、可贡献的 Team 模板体系

Team 不只是内部配置，也是可以复制、修改、版本化和贡献的工程资产。

这让用户可以从内置 Team 或模板出发，逐步沉淀自己的 Agent 工作方式。

---

## 核心特性

### 1. 为不同任务 / 项目设计不同 Agent Team

CrewBee 把 Team 当成一等对象，而不是只关心一个个散落的 agent prompt。

一个 Team 可以拥有自己的：

* 任务定位
* 默认入口 Agent
* 成员分工
* 工作流程
* 共享规则
* 工具边界
* review 方式
* 完成标准
* 输出风格

这意味着你可以为不同任务 / 项目分别设计不同 Team，例如：

* `CodingTeam`：代码开发、修复、调试、重构、验证
* `GeneralTeam`：调研、分析、写作、方案
* `ResearchOpsTeam`：证据检索、资料整理、结论收束
* `MarketingOpsTeam`：开源发布、推广、社区反馈
* `ProjectContextTeam`：项目上下文维护、状态更新、跨会话 handoff
* `WukongTeam`：高不确定性、强探索、长周期复杂任务

### 2. 根据任务复杂度灵活切换单 Agent 与多 Agent 协作模式

CrewBee 不把多 Agent 协作做成默认仪式，而是支持根据任务复杂度选择不同执行方式。

**单 Agent 执行模式** 适合：

* 简单问答
* 小范围代码修改
* 局部解释
* 快速整理
* 低风险任务
* 已经有明确上下文和明确目标的任务

**多 Agent 协作模式** 适合：

* 跨文件实现
* 复杂 bug 修复
* 外部资料调研
* 架构判断
* 独立 review
* 需要验证证据的任务
* 长周期项目工作

简单任务保持敏捷，复杂任务启用团队协作。

### 3. 主 Agent 持有最完整上下文，保证决策依据的全面性

CrewBee 的 Team 以主 Agent / formal leader 作为任务入口、主线 owner 和最终收口者。

主 Agent 负责持有最完整的任务上下文，包括：

* 用户目标
* 项目约束
* 当前任务状态
* 支援 Agent 回传的结论
* review 意见
* 验证结果
* 风险与未决事项

关键决策由主 Agent 基于这些信息完成，而不是由只掌握局部信息的支援 Agent 独立做全局判断。

### 4. 上下文隔离式委派，降低主 Agent 的上下文与注意力负担

CrewBee 的支援型协作强调上下文隔离式委派：

```text
主 Agent 持有主线任务上下文。
支援 Agent 在独立上下文中完成专项任务。
支援 Agent 只把高信号结论回传给主 Agent。
主 Agent 基于回流结论继续决策和收口。
```

支援任务包括：

* 代码库探索
* 外部资料检索
* 证据整理
* 多模态资料解读
* 独立 review
* 高阶架构建议

这样可以避免支线搜索、失败路径、低信号材料和审查过程污染主上下文。

### 5. 内置成熟 Coding Team，含 review 方式与验收标准

CrewBee 当前最重要的方法论样板是内置 Coding Team。

它不是单个 Coder Agent，而是一支面向软件工程任务设计的 Agent Team，推荐结构包括：

```text
coding-leader
coding-executor
codebase-explorer
web-researcher
reviewer
principal-advisor
multimodal-looker
task-orchestrator
```

内置 Coding Team 采用直接职责命名，让用户快速理解每个 Agent 负责什么。

| 内置 Coding Team 角色   | 职责                    |
| ------------------- | --------------------- |
| `coding-leader`     | 默认入口、任务 owner、最终收口者   |
| `coding-executor`   | 执行明确实现、修复、调试与局部重构     |
| `codebase-explorer` | 定位代码入口、调用链、相似实现和历史线索  |
| `web-researcher`    | 查官方资料、外部文档、开源实现和版本差异  |
| `reviewer`          | 独立审查风险、遗漏、验证证据和完成标准   |
| `principal-advisor` | 提供架构、性能、复杂度等高阶判断和主建议  |
| `multimodal-looker` | 解读截图、图表、PDF、界面图和视觉资料  |
| `task-orchestrator` | 处理大型计划、多波次任务和统一 QA 编排 |

Coding Team 的完成不应只依赖“Agent 认为完成了”，而应尽量包含明确验收标准，例如：

```text
- 目标问题已定位
- 修改点有明确依据
- 已完成必要实现或修复
- 已运行可用的 diagnostics / build / tests
- reviewer 未发现真实阻塞
- 已说明未验证项和残余风险
```

### 6. Host-agnostic 定义与 OpenCode Runtime Projection

CrewBee 先把 Team-first 结构转换成统一的中间表示，再映射到具体宿主。

当前重点宿主是 OpenCode。

当前 OpenCode MVP 链路包括：

* Team Library loading
* Team / Agent validation
* Runtime Projection
* formal leader default selection
* projected agent generation
* OpenCode config patch
* session binding
* delegation tooling
* plugin entry
* user-level install
* doctor verification

这使 CrewBee 不只是一个 prompt 文件夹，而是一个可以真实接入 OpenCode 的运行框架。

### 7. 可复制、可修改、可贡献的 Team 模板体系

CrewBee 的 Team 是文件型工程资产，可以被复制、修改、版本化和贡献。

用户可以：

* 使用内置 Team
* 复制 Team 模板
* 修改角色结构
* 调整共享规则
* 固化自己的工作方式
* 为社区贡献 Team

很多用户不一定会修改 CrewBee core，但可以基于模板改出自己的 Team。

### 8. Prompt 既低耦合，又保留执行语义

CrewBee 没有回退到“每个字段一个 schema / 一个 renderer”的旧路，也没有退化成“top-level block 全透明 dump”。

当前采用的是：

> **少量公共语义骨架 section + 通用结构处理 + 结构渲染**

例如 Agent prompt 的骨架顺序会围绕执行心智组织：

* Persona Core
* Responsibility Core
* Core Principle
* Scope Control
* Ambiguity Policy
* Support Triggers
* Collaboration
* Task Triage
* Delegation & Review
* Todo Discipline
* Completion Gate
* Failure Recovery
* Operations
* Output Contract
* Templates
* Guardrails
* Heuristics
* Anti Patterns
* Tool Skill Strategy

这样模型更容易快速建立：

* 我是谁
* 我负责什么
* 我默认怎么行动
* 什么时候委派 / 评审 / 提问 / 停下
* 完成标准是什么
* 失败时如何恢复

### 9. Collaboration 会生成可直接委派的 Agent 清单

当前生成的 `Collaboration` 不再只是简单列 profile 里的协作绑定，而是会结合：

* Agent Profile 中声明的合作 subagent 列表
* Team Manifest 中的 `members` 描述
* OpenCode 侧可解析的 projected id

从而在 prompt 中生成：

* `Id`
* `Description`
* `When To Delegate`

便于在运行时直接委派。

### 10. Team Contract 压缩为可执行手册

Team prompt 最终不是直接渲染整块治理配置，而是收敛为：

* `Working Rules`
* `Approval & Safety`

这让 Team 合同更适合模型消费，也避免了治理字段机械展开。

### 11. 用户级安装与运维链路

CrewBee 已经具备完整的本地构建、用户级安装、doctor 校验和卸载链路，能够作为 OpenCode 的用户级插件稳定接入。

---

## 安装

### 给人类的最短路径

如果你在用 LLM Agent，直接把下面这段发给它：

```text
请按照当前仓库中的 docs/guide/installation.zh-CN.md 完成 CrewBee 安装。
只使用 OpenCode 用户级安装流程，不要使用旧的 project-local 安装方式。
```

或者你自己阅读：

* [安装指南](docs/guide/installation.zh-CN.md)

### 给 LLM Agent 的最短路径

直接读取并执行中文指南：

```text
docs/guide/installation.zh-CN.md
docs/guide/release.zh-CN.md
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
3. 安装到 OpenCode 用户级 package workspace（`~/.cache/opencode`）
4. 重写 OpenCode config 为 canonical 插件入口 `crewbee`

### 已发布后的 registry 安装

当 `crewbee` 发布到 npm 后，可以直接执行：

```bash
npm run install:registry:user
```

OpenCode 配置也可以直接写插件包名：

```json
{
  "plugin": ["crewbee"]
}
```

### 验证安装

```bash
npm run doctor
npm run version
```

`npm run version`（或 `crewbee version`）会直接从 `package.json` 读取当前包版本和已安装包版本。

### 在 OpenCode 中使用

安装完成后：

1. 打开任意项目
2. 选择 CrewBee 投影出的 agent（例如 `coding-leader`）
3. 正常发送请求

---

## Agent Team 与 Agent Profile 定义方式

如果你要设计并注册自己的文件型 Team，请先阅读 [自定义 Agent Team 指南](docs/guide/custom-agent-team.md)。它会说明真实可运行的目录结构、`crewbee.json` 注册方式、Team policy 设计、Agent 职责边界和验证清单。

如果你需要让项目级 Team 覆盖或补充全局 Team，请继续阅读 [项目级 Team 配置指南](docs/guide/project-team-config.md)。

### 文件型 Team 的实际结构

当前真实可运行的文件型 Team 结构是：

```text
teams/<team-name>/
  team.manifest.yaml
  team.policy.yaml
  <agent>.agent.md
  <agent>.agent.md
  TEAM.md            # 可选
```

当前实现采用 **同级扁平目录**；不要求 `agents/` 或 `docs/` 子目录。

当前通过以下配置控制要加载哪些文件型 Team：

```text
~/.config/opencode/crewbee.json
```

示例：

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/research-team", "enabled": true, "priority": 1 }
  ]
}
```

说明：

* 内置 `coding-team` 不需要 `path`
* 文件型 Team 使用 `path` 指向包含 `team.manifest.yaml` 的目录
* `@...` 路径相对于 OpenCode 配置根目录解析
* `priority` 数字越小优先级越高；最高优先级 Team 的默认 leader 会成为 CrewBee 的默认 OpenCode agent

### `team.manifest.yaml`

负责：

* Team 身份
* mission / scope
* formal leader
* members
* workflow
* agent runtime 覆写
* tags

其中，`members` 不只是展示字段。它会影响：

* Team 结构校验
* Team 运行时描述
* Collaboration prompt 输出

因此，`members.<agent>.responsibility / delegate_when / delegate_mode` 是关键字段，而不是说明性装饰。

### `team.policy.yaml`

负责：

* instruction precedence
* approval policy
* forbidden actions
* quality floor
* working rules

并最终压缩成 Team Contract 的两个 section：

* `Working Rules`
* `Approval & Safety`

### `*.agent.md`

负责定义单个 Agent 的静态画像，包括：

* 这个 Agent 是怎样的做事者
* 这个 Agent 负责什么
* 这个 Agent 的边界是什么
* 这个 Agent 默认如何协作
* 这个 Agent 运行时需要哪些工具和权限
* 这个 Agent 默认怎样输出结果

CrewBee 推荐直接把关键执行语义定义为顶层 section，例如：

* `persona_core`
* `responsibility_core`
* `core_principle`
* `scope_control`
* `ambiguity_policy`
* `support_triggers`
* `collaboration`
* `task_triage`
* `delegation_review`
* `todo_discipline`
* `completion_gate`
* `failure_recovery`
* `operations`
* `output_contract`
* `templates`
* `guardrails`
* `heuristics`
* `anti_patterns`
* `tool_skill_strategy`

### 当前能力定义路径

当前能力定义的主要落点是：

* **Agent 级能力**：`*.agent.md` 里的 `runtime_config`
* **Team 级运行时覆盖**：`team.manifest.yaml` 里的 `agent_runtime`
* **宿主侧可用能力**：adapter / host capability contract

### `TEAM.md`

`TEAM.md` 是面向人的 Team 说明文档。
它的作用是帮助快速理解：

* 这个 Team 是干什么的
* Leader 是谁
* 成员分别做什么
* 默认 Workflow 是什么

但它不是 source of truth。
真正的逻辑来源仍然是：

* `team.manifest.yaml`
* `team.policy.yaml`
* `*.agent.md`

### Prompt Projection

当前支持：

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

* 只允许 `snake_case` path
* 不支持 `projection_schema`
* 不支持 camelCase path

---

## OpenCode 运行时是如何工作的

当前 OpenCode 插件链路大致如下：

```text
package.json
  -> opencode-plugin.mjs
  -> dist/opencode-plugin.mjs
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

* `delegate_task`
* `delegate_status`
* `delegate_cancel`

#### `tool.execute.before`

把 `task` 的 `subagent_type` 从别名重写成 projected config key。

#### `experimental.chat.system.transform`

向系统提示注入最小 CrewBee 运行时说明：

* Team
* Entry Agent
* Active Owner
* Mode

---

## 内置 Coding Team 的设计思想

CrewBee 当前最重要的方法论样板，就是内置 Coding Team。

### 1. 主 Agent 持有最完整上下文

Coding Team 的主 Agent / formal leader 是默认入口、主线 owner 和最终收口责任人。

它负责汇总：

* 用户目标
* 仓库约束
* 代码探索结果
* 外部研究结论
* reviewer 意见
* 验证结果
* 风险与未决事项

关键判断由主 Agent 基于完整上下文完成。

### 2. 简单任务不强制复杂协作

CrewBee 认为：

* **简单任务** 应该轻
* **复杂但常规的工程任务** 适合 Team 协作结构化介入
* **极难问题** 应保持上下文集中、试错快速、人类主导清晰

因此，Coding Team 不应把所有任务都变成完整团队流程。

### 3. 最值得独立出去的通常不是 Planner，而是 Reviewer

在 Coding 场景里，计划、执行、验证是强耦合回路。
真正值钱的是：

* 上下文连续性
* 端到端责任闭环
* 独立质量视角

所以，更稳定的结构通常是：

* 主执行 owner
* research
* reviewer
* 必要时的 advisor

而不是 O / P / E 三权平分。

### 4. 支援 Agent 独立上下文，主 Agent 统一收口

对于代码任务，CrewBee 更强调：

* 主 Agent 长期持有主上下文
* Codebase Explorer 独立定位代码证据
* Web Researcher 独立查外部资料
* Reviewer 独立审查风险和完成标准
* Principal Advisor 按需提供高阶判断
* 主 Agent 接收高信号结论后统一决策和收口

---

## 下一步：Project Context

Project Context 是 CrewBee 下一阶段的重要产品力方向。

它的目标是跨会话自动维护项目上下文，使长期项目持续持有高信号摘要信息，包括：

* 项目定位
* 框架设计
* 架构摘要
* 关键历史记录
* 当前实现状态
* 当前计划
* 已知风险
* 决策记录
* 下一步行动
* handoff 摘要

Project Context 不应只是一次性生成项目摘要，而应在项目推进过程中持续更新：

```text
会话开始：读取 project context，恢复项目定位、框架、历史记录和当前计划。
任务执行：根据当前目标阅读必要代码和资料。
会话结束：自动更新 project context，记录新的实现状态、决策、风险和下一步计划。
下一次会话：基于最新 project context 继续工作。
```

它可以减少两类成本：

1. **减少手动提示补充**：用户不需要每次重新解释项目定位、历史决策和当前计划。
2. **减少完整阅读工程代码带来的上下文消耗**：Agent 可以先根据 project context 理解项目结构、关键模块和当前任务相关区域，再进行针对性代码阅读。

> 当前说明：Project Context 是下一阶段重点增强方向，不应理解为当前已经完整实现的成熟能力。

---

## 配置、安装与运维脚本

### 常用脚本

```bash
npm run build
npm run typecheck
npm run test
npm run pack:local
npm run pack:release
npm run release:registry:dry-run
npm run install:local:user
npm run install:registry:user
npm run doctor
npm run uninstall:user
npm run simulate:opencode
npm run simulate:compact
```

### 说明

* `build`：构建产物
* `typecheck`：执行 TypeScript 类型检查
* `test`：运行测试
* `pack:local`：打包本地 tarball
* `pack:release`：打包版本化 release tarball
* `release:registry:dry-run`：在本地执行 registry 发布预检但不真正发布
* `install:local:user`：执行完整用户级安装
* `install:registry:user`：把已发布的 npm 包安装到用户级 workspace
* `doctor`：校验 OpenCode 配置与安装状态
* `version`：显示当前包版本与已安装包版本
* `uninstall:user`：卸载用户级安装
* `simulate:opencode`：运行本地 OpenCode runtime simulator
* `simulate:compact`：运行 compact 场景验证脚本

### 用户级 workspace 默认路径

```text
Config root:  ~/.config/opencode
Install root: ~/.cache/opencode
```

Canonical 插件入口：

```text
crewbee
```

发布手册：

```text
docs/guide/release.zh-CN.md
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

* 从 OpenCode config 中移除 CrewBee 插件入口
* 从用户级 workspace 中移除安装包

如果你只想验证是否已经卸载干净，可再运行：

```bash
npm run doctor
```

---

## 致谢

CrewBee 受 OpenCode 以及 oh-my-openagent 等社区项目启发。这些项目探索了 Agent Team 工作流在真实开发环境中的价值，也让更多开发者看到了多 Agent 协作的潜力。

感谢这些项目的开发者与维护者。

CrewBee 在这个方向上继续推进：把 Agent Team 从一组提示词或角色配置，进一步整理为可管理、可投影、可配置、可复用的工程资产，使不同任务 / 项目下的 Agent Team 能够更清晰地定义、运行和演化。
