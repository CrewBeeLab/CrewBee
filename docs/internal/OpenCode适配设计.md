# CrewBee OpenCode 适配设计 v2

> 说明：本文档保留的是 OpenCode 适配的设计推导与设计边界。
> 当前已经落地的实现、文件命名和运行时链路，请优先以 `docs/architecture.md` 和 `docs/opencode-runtime-flow.md` 为准。

## 1. 文档定位

本文档回答的问题已经收敛为：

**在不改变 OpenCode 用户使用习惯的前提下，如何让 CrewBee 作为一个独立插件接入 OpenCode，并把 CrewBee 的 Agent Team 定义稳定投影为 OpenCode 可选 Agent。**

这版设计相对前一版有四个关键调整：

1. CrewBee 与 oh-my-opencode 在功能开发上视为互斥体系，CrewBee 不依赖 oh-my-opencode 的任何功能。
2. OpenCode 仍然是唯一入口；配置、Agent 选择、Model 选择、CLI 参数都继续沿用 OpenCode 原生方式。
3. Team 不再通过额外 Manager 入口暴露，而是通过一组投影后的 OpenCode Agent 暴露给用户；用户选择某个投影 Agent，本质上就是选择了某个 Team 的执行入口。
4. provider/model 级别配置收敛到 `team.manifest.yaml` 的 `agent_runtime` 中，能力定义主路径则落在 Agent `runtime_config` 与宿主可用能力集合上。

配套的机器可读决策文件见 `docs/opencode-team-decisions.json`。

---

## 2. 先锁定的设计前提

## 2.1 与 oh-my-opencode 的关系

CrewBee 必须满足以下原则：

* **零功能依赖**：不能依赖 oh-my-opencode 的 hooks、task router、manager、prompt system、continuation system 或任何内部模块。
* **设计互斥**：CrewBee 的能力设计按“单独安装即可完整工作”来做，而不是按“与 oh-my-opencode 组合后更完整”来做。
* **允许共存**：如果用户同时安装两个插件，CrewBee 应尽量通过命名空间、配置键与运行时边界隔离，保持自身行为完整。

这意味着：

* 可以研究 oh-my-opencode 的架构思路；
* 但 CrewBee 不能把 oh-my-opencode 当运行前提；
* 也不能把 CrewBee 的核心行为挂在 oh-my-opencode 提供的任何功能上。

## 2.2 OpenCode 是唯一入口

V1 中，用户的真实入口保持为 OpenCode 本身：

* OpenCode Desktop 的 Agent 选择
* OpenCode Desktop 的 Model 选择
* OpenCode 原生配置文件
* OpenCode CLI 参数

CrewBee 当前阶段**不增加单独的 Manager 入口**。

这意味着：

* 不修改 OpenCode Desktop 界面；
* 不要求用户额外打开一个 CrewBee UI；
* 不要求用户通过 `/team-use`、`/team-mode` 之类的自定义命令完成主要选择。

## 2.3 Team 通过投影 Agent 暴露给用户

CrewBee 在 OpenCode 中不再只暴露一个 Team Entry Agent。

而是把 Team 内一部分合适的角色投影为 OpenCode 的用户可选 Agent。例如：

* `coding-leader` -> `[CodingTeam]leader`
* `coordination-leader` -> `[CodingTeam]coordination-leader`
* `coding-executor` -> `[CodingTeam]executor`

用户在 OpenCode 里选择哪个 Agent，实际上就是选择：

* 进入哪个 Team
* 以 Team 的哪条入口路径开始执行

---

## 3. 核心设计结论

### 3.1 CrewBee 在 OpenCode 中的正确形态

OpenCode 的原生模型是 Agent-first：

* Agent 是配置集合
* Agent 选择是 UI 一级操作
* Model 选择是 UI 一级操作
* 配置由 OpenCode 原生配置系统加载

CrewBee 的原生模型是 Team-first：

* Team 是一级对象
* Leader / 成员属于 Team 内部结构
* Team 自带 workflow、policy、agent capabilities

本次适配的关键做法不是改变 OpenCode 的入口，而是：

**把 Team-first 的静态定义，投影成一组 OpenCode 原生可选 Agent。**

### 3.2 新的中间层不再是“Manager 驱动的 Team Entry Agent”，而是“TeamLibrary Projection”

仍然需要中间层，但它的职责需要调整。

旧问题不在于有没有中间层，而在于中间层过于围绕 Manager 和单一 Team Entry Agent 组织。

新的中间层应当回答两个问题：

1. 当前 Team Library 应该投影出哪些 OpenCode Agent。
2. 当前 session 因为用户实际选择了哪个 OpenCode Agent，而绑定到哪个 Team 路径。

因此建议把中间层收敛为：

* **TeamLibrary Projection**：从 Team Library 生成一组可投影 Agent 描述
* **Session Binding**：从当前 OpenCode 选中的 Agent 反推出 Team / role / mode / active owner

### 3.3 入口不再是 Team Entry Agent，而是“用户可选投影 Agent”

投影后的 Agent 分两类：

#### 用户可选 Agent

这类 Agent 会直接出现在 OpenCode Agent 列表中，用于承接用户入口。

例如在 `CodingTeam` 中：

* `[CodingTeam]leader`
* `[CodingTeam]coordination-leader`
* `[CodingTeam]executor`

#### 内部 support Agent

这类 Agent 仍然可以作为 subagent 存在，但不作为主要用户入口。

例如：

* `reviewer`
* `codebase-explorer`
* `web-researcher`
* `principal-advisor`
* `multimodal-looker`

它们是否在 OpenCode 中隐藏，属于 adapter projection 策略，而不再是 Team 暴露的主语义。

### 3.4 Manager 退回内部辅助层，不作为当前阶段产品入口

当前阶段仍然保留 `src/manager` 作为内部状态与默认值组织层是可以的，但它不再承担：

* 独立用户入口
* 主要 Team 选择入口
* 主要 Mode 切换入口

在 OpenCode 适配里，真正触发 session 绑定的是：

* 用户选择的 OpenCode Agent
* 用户选择的 OpenCode Model
* OpenCode CLI 参数
* OpenCode 原生配置中的默认 agent/model

换句话说：

**Manager 在 V1 中可以存在，但必须是内部控制面，而不是用户产品入口。**

---

## 4. 新的系统边界

为避免再次把 Team 定义、OpenCode 投影、运行时状态和内部默认值混在一起，建议把系统划分为以下六个边界：

### Boundary 1: Declarative Team Definition

事实来源仍然是：

* `src/agent-teams/embedded/*`
* `AgentTeams/*`

它们定义：

* Team manifest
* Team policy
* agent profiles

### Boundary 2: TeamLibrary Projection Assembler

负责把：

* Team Library
* agent `entryPoint` 暴露策略

编译成：

* 一组用户可选投影 Agent
* 一组内部 support Agent

### Boundary 3: OpenCode Adapter

负责把 TeamLibrary Projection 投影成 OpenCode 可消费对象，例如：

* `config.agent`
* `default_agent`
* `permission` 映射
* `config.mcp`

### Boundary 4: Session Binding

负责从当前 OpenCode 上下文反推出：

* 当前绑定的 Team
* 当前入口角色
* 当前 mode
* 当前 active owner

### Boundary 5: Hook Plane

负责在 OpenCode 提供的生命周期插点中做：

* prompt/system 注入
* tool guard
* runtime state 更新
* support agent 路由

### Boundary 6: Internal Manager / Defaults

这部分只保留为内部默认值组织层，例如：

* 默认 Team/Agent 偏好
* 默认 mode 策略
* 运行态快照格式

但它不应抢占 OpenCode 的原生入口。

---

## 5. Team 暴露策略

## 5.1 新增一个 host-agnostic 的 `entryPoint` 维度

为了支持“部分 Team 角色直接对用户可见”，建议在 Agent Profile 层引入一个宿主无关的静态维度：

* `entryPoint.exposure`
* `entryPoint.selectionLabel`
* `entryPoint.selectionDescription`
* `entryPoint.selectionPriority`

它表达的是：

* 这个 Agent 是否适合作为用户直接选择的入口
* 如果适合，对外希望呈现成什么角色标签
* 如果同一个 Team 暴露多个入口，它在 Team 内排序中的优先级

这不是 OpenCode 特有字段，而是一个跨宿主都成立的问题：

**某个 Team 里的哪些角色，允许被直接选作入口。**

## 5.2 Team manifest 中的 `agent_runtime`

当前框架把 provider/model 级别的宿主运行时配置收敛到 `team.manifest.yaml` 的 `agent_runtime` 中。

它表达的是：

* 某个 Team 内 Agent 在宿主中默认使用哪个 `provider`
* 某个 Team 内 Agent 在宿主中默认使用哪个 `model`
* 如有需要，也可继续承载 `variant`、`temperature`、`topP`、`options` 等宿主模型配置

优先级规则是：

* `agent_runtime` 显式配置
* 高于任何默认宿主模型假设

当前框架里，provider/model 的单一事实来源就是 `agent_runtime`。

## 5.3 CodingTeam 的投影规则

当前建议的第一批投影如下。

### 用户可选投影 Agent

* `coding-leader` -> `[CodingTeam]leader`
* `coordination-leader` -> `[CodingTeam]coordination-leader`
* `coding-executor` -> `[CodingTeam]executor`

### 内部 support Agent

* `reviewer`
* `codebase-explorer`
* `web-researcher`
* `principal-advisor`
* `multimodal-looker`

### 设计含义

用户如果选：

* `[CodingTeam]leader`，就是走主执行 owner 路径
* `[CodingTeam]coordination-leader`，就是走范围收束 / 调度开局路径
* `[CodingTeam]executor`，就是直接走边界清晰的执行路径

因此“用户选择 Agent 执行者，就是选择 Team”在这个模型下是成立的。

当前实现进一步明确了两条规则：

* formal leader 若是 `user-selectable`，则它是该 Team 的默认入口；
* 多个 user-selectable 入口的 runtime projection 顺序为：formal leader 在前，其余按 `selectionPriority` 升序，再按声明顺序兜底。

但在 OpenCode 宿主里，最终可见列表顺序仍由宿主自己决定。因此这里的优先级首先作用于 CrewBee 的投影与默认选择语义，而不是对宿主 UI 顺序的绝对控制。

## 5.4 对 GeneralTeam / WukongTeam 的推广规则

并不是每个 Team 都必须把全部成员暴露给用户。

建议规则是：

* 每个 Team 至少有一个用户可选投影 Agent
* 允许 2~3 个风格差异明确的入口角色对用户可见
* 研究、评审、顾问、support 角色默认作为内部角色处理

---

## 6. OpenCode 适配原则

## 6.1 不改变 OpenCode 的原生交互习惯

在 V1 中，CrewBee 不新增下列产品层要求：

* 不要求先进入 CrewBee Manager
* 不要求通过自定义命令先选 Team
* 不要求修改 Desktop UI
* 不要求用户额外理解一层 Team UI

用户继续这样使用 OpenCode：

1. 选 Agent
2. 选 Model
3. 发送请求

只是这些 Agent 里，多了一批由 CrewBee 投影出来的 Team 入口 Agent。

## 6.2 配置仍然走 OpenCode 原生配置通道

当前阶段不单独定义 `crewbee.jsonc` 作为主配置入口。

主要配置来源仍然应当是：

* OpenCode 原生 `opencode.json/jsonc`
* `.opencode/agents/*.md` 或 `config.agent`
* OpenCode Desktop 的 Agent / Model 选择
* OpenCode CLI 参数

CrewBee 可以在插件内部维护最少量的运行时辅助状态，但不能要求用户绕开 OpenCode 原生配置入口。

## 6.3 不修改 OpenCode Desktop 界面

V1 设计明确不考虑 Desktop 界面改造。

这意味着当前可用的控制面只有：

* 原生 Agent 列表
* 原生 Model 列表
* 原生配置文件
* 原生 CLI 参数

因此 CrewBee 的适配目标不是“做一个新的 Team UI”，而是“让 Team 的语义通过 Agent 列表自然显现”。

---

## 7. 与 oh-my-opencode 共存的设计约束

## 7.1 冲突面

如果两个插件同时安装，主要冲突面只有以下几类：

* Agent 名称冲突
* `default_agent` 争夺
* command 名称冲突
* tool hook 叠加顺序
* permission 规则叠加

## 7.2 CrewBee 必须遵守的共存规则

### 规则一：不读取、不依赖、不假设 oh-my-opencode 内部状态

CrewBee 不应：

* 读取 oh-my-opencode 私有配置
* 判断某个 OMO agent 是否存在来决定自身是否工作
* 使用 OMO 提供的自定义 tool 或 custom hook 作为自身前提

### 规则二：所有投影 Agent 使用自己的稳定命名空间

建议至少分离两个层面：

* 内部 config key：例如 `crewbee.coding-team.leader`
* 用户可见名称：例如 `[CodingTeam]leader`

这样即使别的插件也注册 agent，冲突面也能收缩到最小。

### 规则三：不修改 foreign agents

CrewBee 只注入和维护自己生成的 Agent，不主动改写别的插件已经注册的 agent prompt、permission 或 mode。

### 规则四：只在安全条件满足时更新 `default_agent`

当前实现对 `default_agent` 的规则是：

* 如果宿主还没有 `default_agent`，CrewBee 可以写入自己的默认入口；
* 如果现有 `default_agent` 已经是 CrewBee 兼容 key，则 CrewBee 可以更新为新的默认入口；
* 如果现有 `default_agent` 属于 foreign agent，则 CrewBee 不覆盖它。

因此，CrewBee 并不是“永远不碰 `default_agent`”，而是只在空值或已归自己名下的情况下做安全更新。

### 规则五：把 hook 当共享环境而不是独占环境

OpenCode 的 hook 是串行叠加执行的。
因此 CrewBee 的 hook 设计必须满足：

* 无论是否存在别的插件，单独运行即可完整
* 即使顺序变化，也不依赖 foreign plugin 的副作用

---

## 8. 新的框架落点

基于以上调整，当前工程推荐收敛为以下目录结构：

```text
src/
  core/                      # Team / Agent / capability 的宿主无关静态契约
  agent-teams/               # Team library 的发现、解析、校验与内置 Team
runtime/                   # TeamLibrary Projection + Session Binding
  adapters/
    index.ts                 # 宿主无关 adapter 接口
    opencode/                # OpenCode 适配实现
  manager/                   # 内部默认值与辅助状态，非当前阶段产品入口
```

### 8.1 `src/runtime/`

这一层现在的职责是：

* 从 Team Library 生成 TeamLibrary Projection
* 从当前选中的投影 Agent 生成 Session Binding

而不是围绕独立 Manager 命令做 Team 切换。

### 8.2 `src/adapters/opencode/`

这一层现在的职责是：

* 声明 OpenCode 的 capability contract
* 把 TeamLibrary Projection 投影成 OpenCode Agent 配置草图
* 维护与 foreign plugin 的共存策略
* 为后续插件 entry 做 bootstrap 骨架

### 8.3 `src/manager/`

这一层保留，但在当前阶段只应被视为：

* 内部默认值辅助层
* 运行态快照辅助层

而不是产品入口。

---

## 9. 当前阶段的 OpenCode Hook 策略

在新的方向下，OpenCode hook 主要服务于“投影 Agent 运行时治理”，而不是“额外 Team UI”。

建议主用：

* `config`
  * 注入 CrewBee 生成的 projected agents
* `chat.message`
  * 根据当前选中 agent 建立 session binding
* `experimental.chat.system.transform`
  * 注入 Team policy、role-specific overlay、workflow note
* `experimental.chat.messages.transform`
  * 注入 instruction packs 与必要 Team 上下文
* `chat.params`
  * 依据 `agent_runtime` 调整模型参数
* `tool.execute.before`
  * 做 role boundary 和 task routing guard
* `tool.execute.after`
  * 更新最近动作、阶段与运行态快照
* `event`
  * 处理 session 生命周期与状态清理

不应依赖为强治理主入口的：

* `permission.ask`

原因是 OpenCode 主路径已经更多转向 `PermissionNext.ask`。

---

## 10. 初步实现口径

当前阶段的初步框架只需要先把三件事跑通：

### 10.1 在 Agent Profile 中显式标注哪些角色可以作为入口

例如 `CodingTeam`：

* `coding-leader` -> `user-selectable`
* `coordination-leader` -> `user-selectable`
* `coding-executor` -> `user-selectable`

### 10.2 生成一份 TeamLibrary Projection

它至少要能输出：

* team id
* source agent id
* 是否用户可选
* 投影 label
* 投影说明

### 10.3 生成 OpenCode 投影草图

它至少要能输出：

* 内部 config key
* 用户可见 public name
* `primary` / `subagent`
* `hidden` / `visible`

---

## 11. 本版设计对应的代码框架调整

本次框架修改后，工程里应体现出以下变化：

1. `src/core` 新增 Agent 入口暴露与入口优先级的静态契约
2. `src/agent-teams/parsers.ts` 支持解析入口暴露字段
3. `CodingTeam` 中将 leader / coordination-leader / executor 标为可投影入口
4. `src/runtime/` 新增 TeamLibrary Projection 与 Session Binding 骨架
5. `src/adapters/opencode/` 新增 OpenCode capability / projection / coexistence / bootstrap 骨架

---

## 12. 最终结论

这版 OpenCode 适配的核心不是“给 CrewBee 做一个新的入口”，而是：

**让 CrewBee 继续保持 Team-first 的静态定义方式，但在 OpenCode 中以原生 Agent 选择体验暴露给用户。**

一句话收束：

**CrewBee 定义 Team，OpenCode 继续作为入口，Adapter 负责把 Team 中可选入口角色投影为 OpenCode Agent。**
