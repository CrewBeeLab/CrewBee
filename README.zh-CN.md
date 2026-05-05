# CrewBee

[English](README.md) | [简体中文](README.zh-CN.md)

> [!NOTE]
>
> [![CrewBee - 把分散的智能体变成真正的团队。](./assets/web-home-cn.png?v=2)](https://crewbeelab.github.io)
> > **CrewBee 把研发工作中的 prompts、agents、规则、review 流程和验收标准，整理成可维护的 Agent Team 资产。<br />访问官网：[crewbeelab.github.io](https://crewbeelab.github.io)。**


CrewBee 是当前优先适配 OpenCode 的 **Agent Team 资产层**。

它把研发工作中的 prompts、agents、规则、review 流程和验收标准，整理成可维护的 **Agent Team 资产**。

CrewBee 帮助你为专项业务场景定制可复用 Agent Team：不只是 agents，还包括 tools / skills 策略、工作流、规则、review 和验收标准。

这里的“团队”不是为了默认启用更多 Agent，而是为了让复杂研发任务中的需求理解、代码定位、方案判断、实现变更、独立审查、验证确认和交付说明拥有清晰职责与协作边界。

不是 prompt pack。
不是平铺 agent 列表。
不是另一个大而全 multi-agent runtime。

**当前优先适配 OpenCode。** OpenCode 是 CrewBee 当前的首个正式适配宿主；Project Context、Team 模板生态和更多 Agent Harness 适配属于下一阶段方向。

---

## 为什么需要 CrewBee

复杂研发任务，需要可审查、可验证、可交付的 **工作结构**。

代码生成只是其中一环。真正影响交付质量的，往往是需求理解、代码定位、方案判断、实现变更、独立审查、验证确认和交付说明。

如果这些内容分散在 prompts、agents、rules、review checklist 和临时约定里，Agent 工作方式会越来越难维护，也更难判断结果是否真的完成。

### CrewBee 在 OpenCode 中运行

下图展示了 CrewBee 在 OpenCode 中运行时的界面：已选择 Coding Team 入口，并能看到带 review 支撑的任务执行过程。

![CrewBee 在 OpenCode 桌面中运行](./assets/opencode-desktop.png?v=2)

CrewBee 让你把这些内容整理成可维护的 Agent Team 资产：定义 Team、选择 Leader，并在 OpenCode 中运行结构化 Agent Team 工作流。

简单任务保持轻量。
复杂任务再启用支援、review 和验收标准。

当前 CrewBee 最重要的三项产品力是：

* **Agent Team 资产层** —— 把 prompts、agents、规则、review 流程和验收标准组织成可维护资产。
* **专项业务场景 Team 工程能力** —— 为 Coding、调研、文档、发布等场景定制可复用 Agent Team。
* **内置 Coding Team 旗舰样板** —— 用 owner-centered、review-backed 的方式组织复杂代码任务。

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

CrewBee 是一个当前优先适配 OpenCode 的 Agent Team 资产层。

在 CrewBee 里，真正的一等对象不是单个 Agent，而是 **Team**。一个 Team 不是几段 prompt 的拼接，也不是平铺的角色列表，而是一套可以维护、复制、修改和复用的工作结构，通常包含：

* Team 身份与定位
* formal leader
* members
* workflow
* Team 共享规则
* Agent Profiles
* review flow
* completion criteria
* tools / skills 策略
* 模型偏好与宿主绑定

CrewBee 的目标，是把零散的 prompts、agents、规则、review 流程和验收标准沉淀为可维护的 Agent Team 资产。

当前阶段的基本使用方式是：

* 在 OpenCode 中选择 Team 的入口 Agent，例如 `coding-leader`
* 用 Team 定义组织 Leader、成员职责、规则、工作流、review 和验收标准
* 简单任务保持单 Agent 轻量路径，复杂任务再启用支援、review 和验证

Runtime Projection、OpenCode Adapter、setup、doctor、per-agent 模型配置和 projection-time fallback，是让这些 Team 资产在 OpenCode 中可用、可配置、可诊断的实现方案与可用性支撑；它们重要，但不作为 CrewBee 的长期核心优势来表述。

---

## CrewBee 解决什么问题

CrewBee 当前主要解决三类问题。

### 1. 把分散的 Agent 工作方式整理成资产

很多团队会逐步积累 prompts、agents、rules、review checklist、模型偏好和工具使用经验。问题是，这些内容一旦分散在不同配置和临时约定里，就很难维护、复用和审查。

CrewBee 把它们组织成 Agent Team 资产，让一类工作的方法可以被复制、修改、版本化和持续改进。

### 2. 为专项业务场景定制可复用 Agent Team

Coding、Code Review、ResearchOps、Documentation、ReleaseOps、Bug Triage 或内部团队流程，都可能需要不同的职责、工具 / 技能策略、工作流、规则、review 和验收标准。

CrewBee 支持你把某个专项业务场景整理成一支可复用 Agent Team，而不是把所有工作都塞进一套越来越长的通用 prompt。

### 3. 用内置 Coding Team 提供可运行样板

CrewBee 当前内置 Coding Team，用于代码开发、修复、调试、重构、验证和交付。

它不是一个单独的 Coder Agent，而是一支面向软件工程任务设计的 Team：有主线 owner，有代码定位，有专项实现，有独立 review，也有验收标准。

这让 CrewBee 不只停留在“可以定义 Team”的抽象层，而是提供一支当前就能在 OpenCode 中使用的旗舰样板。

### 当前边界

Project Context、Team 模板生态和多宿主投影，都是下一阶段方向；当前 README 不把它们写成成熟优势。

---

## 核心特性

### 1. Agent Team 资产层

CrewBee 把 Team 当成一等对象，而不是只关心一个个散落的 agent prompt。

一个 Agent Team 资产可以包含：

* 任务定位与适用边界
* 默认入口 Leader
* 成员职责与协作边界
* Team 内部工作流
* 共享规则
* tools / skills 策略
* review 流程
* 验收标准
* 输出风格
* 模型偏好与宿主绑定

这让 Team 不再是一次性 prompt，而是一套可以维护、复制、修改、版本化和复用的工作结构。

### 2. 为专项业务场景定制可复用 Agent Team

CrewBee 的价值不只是“有内置 Team”，而是支持你把某类工作的方法沉淀成一支可复用 Agent Team。

专项业务场景可以是：

* Coding
* Code Review
* ResearchOps
* Documentation
* ReleaseOps
* Bug Triage
* Product Planning
* 团队内部特定流程

一支专项业务场景 Team 不只是 agents，还可以组织：

```text
Agent Team
+ tools / skills 策略
+ 工作流
+ shared rules
+ review flow
+ completion criteria
+ output contract
```

用户不一定要修改 CrewBee core，也可以先从 Team 定义开始，沉淀自己的业务场景工作方式。

### 3. 内置 Coding Team 作为旗舰样板

CrewBee 当前最重要的可运行样板是内置 Coding Team。

它不是单个 Coder Agent，而是一支面向软件工程任务设计的 Agent Team：

```text
主线 owner + 代码定位 + 专项实现 + 独立 review + 验收标准
```

内置 Coding Team 采用直接职责命名，让用户快速理解每个 Agent 负责什么。

| 内置 Coding Team 角色   | 职责                      |
| ------------------- | ----------------------- |
| `coding-leader`     | 默认入口、任务 owner、最终判断与交付说明 |
| `coding-executor`   | 执行明确实现、修复、调试与局部重构       |
| `codebase-explorer` | 定位代码入口、调用链、相似实现和历史线索    |
| `web-researcher`    | 查官方资料、外部文档、开源实现和版本差异    |
| `reviewer`          | 独立审查风险、遗漏、验证证据和完成标准     |
| `principal-advisor` | 提供架构、性能、复杂度等高阶判断和主建议    |
| `multimodal-looker` | 解读截图、图表、PDF、界面图和视觉资料    |
| `task-orchestrator` | 处理大型计划、多波次任务和统一 QA 编排   |

复杂代码任务中，真正有价值的不是默认拉起更多 Agent，而是：

* 有主执行 owner 持有任务主线；
* 有 codebase-explorer 提供代码定位和证据；
* 有 web-researcher 在必要时补充外部资料；
* 有 reviewer 提供独立质量视角；
* 有 completion criteria 防止“Agent 自证完成”。

### 4. 当前可用性支撑

为了让 Agent Team 资产真实落地到 OpenCode，CrewBee 也提供了一组可用性支撑：

* OpenCode 优先适配
* Team / Agent 校验
* Runtime Projection
* formal leader 默认入口
* delegation tooling
* per-agent 模型配置
* projection-time fallback
* user-level setup
* doctor checks
* 卸载与诊断脚本

这些能力让 CrewBee 更容易安装、配置、运行和排障；它们是实现方案、用户体验支撑和版本质量证据，不写成 CrewBee 的长期核心差异化优势。

### 5. 下一阶段方向

以下方向是 Roadmap，不是当前成熟优势：

* **Project Context**：让长期项目中的 Agent 不再每次像新人入职。
* **Team 模板生态**：围绕专项业务场景沉淀更多可复用 Team。
* **更多 Agent Harness 适配**：探索 OpenCode 之外的宿主适配与 Team 资产迁移能力。

---

## 安装

用一条命令为 OpenCode 安装 CrewBee：

```bash
npx crewbee@latest setup --with-opencode
```

如果你已经安装 OpenCode：

```bash
npx crewbee@latest setup
```

CrewBee 会安装到 OpenCode 用户级 workspace，写入标准 plugin entry `"crewbee"`，运行 doctor 检查，并且不会修改业务仓库文件。

完整说明见：[安装指南](docs/guide/installation.zh-CN.md)

---

## 快速开始

```bash
cd /path/to/project
opencode
```

选择 `coding-leader`，然后运行第一个真实任务：

```text
使用 CrewBee Coding Team 修复这个问题，并在完成前进行 review 与验证。
```

随时验证：

```bash
npx crewbee@latest doctor
```

本地开发仍可使用 `npm run install:local:user`，但不要把这条路径放进首次用户 onboarding。

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

CrewBee 当前最重要的旗舰样板，就是内置 Coding Team。

它证明 CrewBee 的产品力不只是“可以定义 Team”，而是可以把一个真实业务场景组织成一支可用的 Agent Team。

### 1. 主 Agent 持有最完整上下文

Coding Team 的主 Agent / formal leader 是默认入口、主线 owner、最终判断者和交付说明责任人。

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

### 3. Coding Team 的价值不是更多 Agent，而是更清晰的工作结构

复杂代码任务中，风险往往不在“AI 能不能写出代码”，而在：

* 是否改对目标；
* 是否定位到真正相关的代码；
* 是否影响其他模块；
* 是否遗漏边界情况；
* 是否运行过必要验证；
* 是否过度修改；
* 是否把未验证项说明清楚。

所以，Coding Team 的核心不是默认拉起更多 Agent，而是把复杂代码任务组织成：

```text
主线 owner + 代码定位 + 专项实现 + 独立 review + 验收标准
```

### 4. 最值得独立出去的通常不是 Planner，而是 Reviewer

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

### 5. 支援 Agent 独立上下文，主 Agent 统一收口

对于代码任务，CrewBee 更强调：

* 主 Agent 长期持有主上下文
* Codebase Explorer 独立定位代码证据
* Web Researcher 独立查外部资料
* Reviewer 独立审查风险和完成标准
* Principal Advisor 按需提供高阶判断
* 主 Agent 接收高信号结论后统一决策和收口

---

## 下一步：Project Context

Project Context 是 CrewBee 下一阶段的重要产品力方向，不是当前 README 中应被写成成熟优势的能力。

它的目标，是让长期项目中的 Agent 不再每次像新人入职。理想状态下，长期项目可以持续持有高信号摘要信息，包括：

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

> 当前说明：Project Context 是下一阶段重点增强方向。README 中保留它作为 Roadmap 说明，但不把它表述为当前成熟产品优势。

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
npm run setup
npm run install:local:user
npm run install:registry:user
npm run update
npm run doctor
npm run uninstall
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
* `setup`：面向用户的产品化安装；必要时安装 OpenCode，安装 CrewBee，写入配置并运行 doctor
* `install:local:user`：执行完整用户级安装
* `install:registry:user`：把已发布的 npm 包安装到用户级 workspace
* `update`：从 registry 重装 CrewBee 并运行 doctor
* `doctor`：校验 OpenCode 配置与安装状态
* `version`：显示当前包版本与已安装包版本
* `uninstall`：从 OpenCode config 和用户级 workspace 中移除 CrewBee
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

CrewBee 受 OpenCode 以及 oh-my-openagent 等社区项目启发。

OpenCode 提供了 CrewBee 当前优先适配的真实 AI coding 宿主环境；oh-my-openagent 等项目则启发了社区对 Agent Team、角色协作和工作流组织方式的探索。

感谢这些项目的开发者与维护者。

CrewBee 在这个方向上继续推进：不做另一个大而全 multi-agent runtime，而是把 prompts、agents、规则、review 流程和验收标准整理成可维护的 Agent Team 资产，并优先让它们在 OpenCode 中真实可用。
