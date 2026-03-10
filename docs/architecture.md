# 架构概览

AgentScroll V1 的架构被明确收束为三个一级对象：

1. `Agent Team`：用户面对的主执行单元。
2. `Adapter`：把 Team 映射到具体宿主的桥接层。
3. `Manager`：负责 Team 选择、模式控制与基础运行可视化的管理层。

在这一层级之下，Team 自带自己的 Leader、成员、内建 Workflow、工具边界与输出要求。V1 不把 Playbook 作为独立一级对象暴露给用户。

## V1 设计立场

- Team 就是任务场景入口，不再额外暴露独立 `scene` 选择。
- 用户面对的核心选择收敛为 `Team + Mode`。
- Mode 仅保留 `single-executor` 与 `team-collaboration`。
- Leader 始终是任务入口与最终收口者，但是否亲自执行、何时委派、是否长期持有 ownership 由 Team 设计决定。
- Artifact 在 V1 中只保留为轻量交付与验证结果，不发展为复杂控制平面。

## 当前代码框架对应关系

- `src/core`：定义 Team manifest、Team policy、shared capabilities、agent profile、运行态选择与宿主能力契约。
- `src/agent-teams`：维护 Team Library 子系统；把嵌入式 `CodingTeam` 与 `AgentTeams/` 下的文件型 Team 统一装配为同一种 Team package 形态。
- `src/adapters`：定义适配宿主时所需的 runtime binding 与事件抽象。
- `src/manager`：定义 Team 选择、启用、执行计划与运行快照的管理层入口。
- `AgentTeams`：存放通过配置文件定义的 Team 目录；当前主要承载 `GeneralTeam` 与 `WukongTeam`。
- `AgentTeamTemplate`：存放可复用的 Team 模板，用于新增 Team 时快速落地。

## Team 文件模型

对配置文件型 Team，当前工程将静态定义收敛为以下文件：

1. `team.manifest.yaml`：定义 Team 身份、Leader、成员、模式、Workflow 与运行假设。
2. `team.policy.yaml`：定义 Team 共通规则、审批边界、质量底线与禁止项。
3. `shared-capabilities.yaml`：定义 Team 共享的模型、工具、技能、记忆、hooks 与 MCP 引用。
4. `agents/*.agent.md`：定义单个 Agent 的静态画像，强调 persona core 与 responsibility core。
5. `TEAM.md` 或 `docs/TEAM.md`：提供人类可读的 Team 说明文档。

这套模型与项目书保持一致：以 Team 为一级对象、以 Leader 为稳定入口、以 Session Context 为主要协作媒介，而不是依赖重型路由图与契约文件系统。

## Team Library 子系统

当前 `src/agent-teams` 已从单一巨型入口拆分为更清晰的内部模块：

- `constants.ts` / `types.ts`：Team loader 侧的稳定常量与校验输出类型。
- `parsers.ts`：YAML 与 agent profile markdown frontmatter 的纯解析 / 映射逻辑。
- `filesystem.ts`：基于 Team package 文件结构做目录发现与文件型 Team 加载。
- `embedded/coding-team.ts`：内置受保护 `CodingTeam` 的源码定义。
- `documentation.ts`：Team 文档与 agent profile 文档引用整理。
- `validation.ts`：Team package 与 Team library 的交叉校验。
- `library.ts`：把多个 Team source 装配为最终 `TeamLibrary`。

这种拆分的目的，是让“发现 / 解析 / 校验 / 内置 Team 定义 / Library 装配”彼此独立演化，并为后续 OpenCode 插件接入保留稳定边界。

## 运行时桥接方式

当前 TypeScript 框架并不直接执行 Team，而是为后续宿主接入准备清晰的映射层：

- `TeamManifest`、`TeamPolicy`、`SharedCapabilities`、`AgentProfileSpec` 表达静态定义。
- `AgentTeamDefinition` 负责把内置 Team 与文件型 Team 统一为运行时可加载的 Team 单元。
- `Manager` 负责选 Team、选 Mode，并生成初始执行计划。
- `Adapter` 负责把 Team 选择结果映射为宿主中的运行上下文与事件。

后续如果接入 OpenCode 插件，推荐继续保持这一分层：插件消费的是已经装配完成的 Team runtime 结果，而不是直接耦合 YAML、Markdown 或目录扫描细节。

## 不是当前阶段目标的部分

以下能力目前不在 V1 范围内：

- 宿主 runloop 接管
- 自动场景识别与自动 Team 路由
- 显式的复杂 handoff / completion 契约体系
- 长期任务状态系统与外部状态同步平台

## 宿主最小能力契约

为了让 AgentScroll 能接入宿主，宿主至少需要支持：

- 注册或切换 Agent 定义
- 支持单执行者与基础团队协作
- 输出运行事件流或等价日志
- 注入 Team 级规则与工具白名单
- 接收外部 Team 运行配置
- 导出 Session 日志，便于追踪与审计
