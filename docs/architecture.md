# 架构概览

AgentScroll 的核心仍然是一个可移植的 Agent Team 框架，但在当前 OpenCode 适配方向下，产品入口已经收敛为：

* **OpenCode 仍然是唯一入口**
* **AgentScroll 负责定义 Team，并把 Team 投影成 OpenCode Agent**

因此，当前阶段最重要的三个工程对象是：

1. `Agent Team`：静态事实来源
2. `Runtime Projection`：把 Team 编译成宿主可消费的投影结果
3. `Adapter`：把投影结果接到具体宿主

`Manager` 仍然可以作为内部辅助层存在，但在 OpenCode V1 适配中，它不再是单独暴露给用户的产品入口。

## V1 设计立场

- Team 仍然是方法论上的一级对象。
- OpenCode 保持 Agent-first 入口；用户继续通过 OpenCode 的 Agent 选择、Model 选择、配置文件和 CLI 使用系统。
- AgentScroll 不新增单独 Manager 入口，不修改 OpenCode Desktop UI。
- Team 通过一组投影后的 OpenCode Agent 对用户可见。
- oh-my-opencode 只可作为研究参考，不能成为运行依赖。

## 当前代码框架对应关系

- `src/core`：宿主无关静态契约，包括 Team、Agent、capability 和宿主能力描述。
- `src/agent-teams`：Team Library 子系统，负责发现、解析、校验和装配 Team 资产。
- `src/runtime`：新增的投影层，负责把 Team Library 编译成 Catalog Projection 和 Session Binding。
- `src/adapters`：宿主桥接层；当前新增 `src/adapters/opencode` 作为 OpenCode 适配骨架。
- `src/manager`：内部默认值与运行态辅助层，当前不作为用户显式入口。
- `AgentTeams`：文件型 Team 资产目录。

## Team 文件模型

当前工程的 Team 静态定义当前收敛为：

1. `team.manifest.yaml`
2. `agents/*.agent.md`
3. `TEAM.md` 或 `docs/TEAM.md`

在此基础上，Agent Profile 现在增加了一个新的静态维度：

* `entryPoint`

它表达的是：

* 这个角色是否适合作为用户直接选择的入口
* 如果适合，应以什么标签投影到宿主 Agent 列表中

同时，Team manifest 现在可以通过 `agent_runtime` 为各个 Agent 显式指定宿主运行时模型配置，例如 `provider/model`。

Team 共享规则也已经收敛到 `team.manifest.yaml` 的 `governance` 中，不再单独拆分 `team.policy.yaml`。

## OpenCode 适配方式

对 OpenCode，AgentScroll 不再要求用户先选 Team 再选 Mode，而是：

* 把 Team 中适合作为入口的角色投影为 OpenCode 可选 Agent
* 用户选择哪个投影 Agent，就相当于选择了哪个 Team 的哪条入口路径

例如 `CodingTeam` 当前的用户可选投影是：

* `[CodingTeam]leader`
* `[CodingTeam]coordination-leader`
* `[CodingTeam]executor`

而 `reviewer`、`codebase-explorer`、`web-researcher` 等 support 角色仍然可以作为内部角色存在。

## 运行时桥接方式

当前运行时桥接分为两层：

1. **Catalog Projection**
   * 从 Team Library 生成投影后的 Agent 目录
2. **Session Binding**
   * 根据当前选中的 OpenCode Agent，绑定到 Team / role / mode / active owner

这样可以同时满足：

* Team 定义仍然保持 Team-first
* OpenCode 入口仍然保持 Agent-first
* 用户不需要学习额外 UI

## 共存边界

AgentScroll 与 oh-my-opencode 在功能设计上互斥，但允许用户同时安装。

为此，当前框架要求：

- AgentScroll 只依赖 OpenCode 官方机制，不依赖任何 OMO 内部功能。
- 投影 Agent 必须使用自己的命名空间。
- AgentScroll 不主动修改 foreign agents。
- 默认不抢占 foreign `default_agent`。
- Hook 设计必须顺序无关、可叠加、无 OMO 前提。

## 不是当前阶段目标的部分

以下能力当前仍不在 V1 范围内：

- 自定义 OpenCode Desktop 界面
- 独立 AgentScroll Manager UI
- 自动场景识别与自动 Team 路由
- 对 OpenCode runloop 的接管
- 对 oh-my-opencode 的兼容层依赖
