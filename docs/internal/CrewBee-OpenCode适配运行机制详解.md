# CrewBee 针对 OpenCode 宿主的适配运行机制详解

本文面向维护者，目标是回答下面几个问题：

- CrewBee 的 Team/Agent 定义，如何变成 OpenCode 可用的 `agent` 配置
- CrewBee 如何与 OpenCode 现有配置合并，而不是粗暴覆盖
- `createProjectedAgentAliasIndex` 映射的到底是什么数据
- `bindings` 里到底存了什么，为什么要存
- CrewBee 插件注册了哪些 hook，各自的调用时机和作用是什么
- 一次用户消息从进入 OpenCode 到进入 CrewBee 运行时语义，中间经过了哪些阶段

如果只看一句话总结：

> CrewBee 没有接管 OpenCode 的运行时，而是通过 `config` 把 Team-first 定义投影成 OpenCode 原生 agent，再通过少量 hook 把 Team 语义、session 绑定和 task 委派适配补回去。

---

## 1. 先看整体目标

OpenCode 原生是 **Agent-first** 的：

- 用户选择一个 agent
- OpenCode 用这个 agent 的 prompt / permission / model 配置运行会话
- 子代理委派通过 `task` 工具完成

CrewBee 原生是 **Team-first** 的：

- 真正的主对象是 Team
- Team 内部再定义 leader、executor、reviewer、researcher 等角色
- 同一个 Team 内部还带有工作流、治理规则、角色协作逻辑

所以适配的核心不是“把 CrewBee 整个塞进 OpenCode”，而是：

1. 把 CrewBee Team Library 投影成一组 OpenCode 原生 agent
2. 让用户仍然通过 OpenCode 的 agent 选择器进入
3. 在运行时再把“这个 session 实际属于哪个 Team / 哪个入口角色 / 当前 owner 是谁”补回去

---

## 2. 总体数据流

可以把当前实现理解成下面这条链路：

```text
CrewBee TeamLibrary
  -> TeamLibraryProjection
  -> OpenCodeAgentConfig[]
  -> OpenCodeAgentConfigPatch
  -> 与 OpenCode 当前 config 合并
  -> 写回 cfg.agent / cfg.default_agent
  -> 用户选择某个 CrewBee 投影 agent 发消息
  -> 建立 session -> CrewBee binding
  -> 后续 tool / system hook 基于 binding 做适配
```

再展开一点：

```text
Team 定义
  -> 生成投影 agent（例如 [CodingTeam]leader）
  -> 为每个 agent 生成 OpenCode config key（例如 crewbee.coding-team.leader）
  -> 注入到 OpenCode config.agent
  -> 用户在 OpenCode 里选择 [CodingTeam]leader
  -> OpenCode 实际使用 key = crewbee.coding-team.leader
  -> CrewBee 在 chat.message 阶段记住：
       这个 session 属于 coding-team
       当前入口角色是 coding-leader
       当前 active owner 是 coding-leader
  -> 如果后续模型调用 task，CrewBee 会先把 subagent_type 归一化
  -> 再交给 OpenCode 原生 task 工具执行
```

---

## 3. 插件入口做了什么

插件入口在：

- [plugin.ts](E:/0-AI/CrewBee/src/adapters/opencode/plugin.ts)

OpenCode 加载插件时，会调用：

```ts
export const OpenCodeCrewBeePlugin: Plugin = async (ctx) => { ... }
```

这个函数不是“处理一次消息”，而是“初始化一次插件实例”，返回一个 hooks 对象。

### 3.1 初始化阶段做的事

它会先执行：

```ts
const teamLibrary = loadDefaultTeamLibrary(ctx.worktree);
const issues = validateTeamLibrary(teamLibrary);
```

含义：

- 从当前工作区加载 CrewBee 可见的 Team Library
- 对 Team 定义做校验

然后：

- `error` 级问题直接抛错，插件初始化失败
- `warning` / `error` 都会写入 OpenCode 日志

初始化完成后，它会持有 3 个关键运行时对象：

```ts
let boot = createOpenCodeBootstrap(...)
let aliasIndex = createProjectedAgentAliasIndex(boot.projectedAgents)
const bindings = new Map<string, SessionRuntimeBinding>()
```

这 3 个对象是后续所有 hook 的共享状态。

---

## 4. 三个核心运行时对象

## 4.1 `boot`：当前 CrewBee -> OpenCode 的完整快照

`boot` 的类型是 `OpenCodeBootstrapOutput`，由：

- [bootstrap.ts](E:/0-AI/CrewBee/src/adapters/opencode/bootstrap.ts)

里的 `createOpenCodeBootstrap(...)` 生成。

它不是一个单字段对象，而是一整份“适配结果快照”。可以把它理解成：

> “基于当前 Team Library 和当前 OpenCode 配置，CrewBee 最终投影出来的结果”

它大致包含这些内容：

- `projection`
  - TeamLibraryProjection，表示 Team 被投影后的结构
- `projectedAgents`
  - OpenCodeAgentConfig 数组，表示每个投影 agent 的 OpenCode 表示
- `configPatch`
  - 本次 CrewBee 想写入 OpenCode 的 agent 配置补丁
- `mergedConfig`
  - 补丁与现有 OpenCode config 合并后的结果
- `mergeResult`
  - 哪些 key 是 inserted / updated / skipped
- `collisions`
  - 与宿主现有 agent 命名冲突的报告
- `sessionBinding`
  - 某些场景下会直接计算出的 binding

### `boot` 的直观示例

以 `[CodingTeam]leader` 为例，`boot.projectedAgents` 中会有一个元素，概念上类似：

```ts
{
  configKey: "crewbee.coding-team.leader",
  publicName: "[CodingTeam]leader",
  teamId: "coding-team",
  sourceAgentId: "coding-leader",
  mode: "primary",
  hidden: false,
  description: "...",
  prompt: "...",
  permission: [...],
  metadata: {
    teamId: "coding-team",
    teamName: "CodingTeam",
    sourceAgentId: "coding-leader",
    surfaceLabel: "leader",
    roleKind: "leader",
    exposure: "user-selectable"
  }
}
```

也就是说，CrewBee 内部 agent 会被重新表达成一个 OpenCode agent 配置对象。

---

## 4.2 `aliasIndex`：同一个 agent 的多种名字索引

`aliasIndex` 由：

- [projection.ts](E:/0-AI/CrewBee/src/adapters/opencode/projection.ts)

里的 `createProjectedAgentAliasIndex(projectedAgents)` 生成。

它的类型是：

```ts
Map<string, OpenCodeAgentAliasEntry>
```

`OpenCodeAgentAliasEntry` 长这样：

```ts
{
  alias: string
  agent: OpenCodeAgentConfig
  kind: "config-key" | "public-name" | "source-agent-id"
}
```

### 为什么要有这个 Map

同一个 CrewBee agent，运行时可能会被模型写成不同名字：

- OpenCode config key
  - `crewbee.coding-team.executor`
- OpenCode 显示名
  - `[CodingTeam]executor`
- CrewBee 源 agent id
  - `coding-executor`

OpenCode 原生 `task` 工具最终认的是 **真实 agent key**。  
所以必须先把别名归一化。

### `aliasIndex` 的直观内容示例

假设当前有这个 projected agent：

```ts
{
  configKey: "crewbee.coding-team.executor",
  publicName: "[CodingTeam]executor",
  sourceAgentId: "coding-executor"
}
```

那么 `aliasIndex` 里会有这几条映射：

```ts
Map {
  "crewbee.coding-team.executor" -> {
    alias: "crewbee.coding-team.executor",
    kind: "config-key",
    agent: <同一个 projected agent>
  },
  "[codingteam]executor" -> {
    alias: "[CodingTeam]executor",
    kind: "public-name",
    agent: <同一个 projected agent>
  },
  "coding-executor" -> {
    alias: "coding-executor",
    kind: "source-agent-id",
    agent: <同一个 projected agent>
  }
}
```

注意：

- key 会先做 `trim().toLowerCase()`
- 所以 public name 查找是大小写不敏感的

### `createProjectedAgentAliasIndex` 的缩略版源码解释

它的逻辑本质上就是：

```ts
for each projectedAgent:
  取出 3 个别名：
    - configKey
    - publicName
    - sourceAgentId
  分别 lower-case 后塞进 Map
  如果某个 key 已存在，则保留先出现的那一个
```

所以它不是业务决策器，只是一个“名字查表器”。

---

## 4.3 `bindings`：每个 session 当前属于哪个 Team 路径

`bindings` 的定义是：

```ts
const bindings = new Map<string, SessionRuntimeBinding>();
```

key 是：

- `sessionID`

value 是：

- `SessionRuntimeBinding`

这个类型定义在：

- [types.ts](E:/0-AI/CrewBee/src/runtime/types.ts)

结构是：

```ts
{
  sessionID: string
  teamId: string
  selectedAgentId: string
  selectedSurfaceLabel: string
  mode: ExecutionMode
  activeOwnerId: string
  delegatedAgentId?: string
  source: "host-agent-selection" | "host-cli" | "plugin-default"
}
```

### `bindings` 存什么

以 `[CodingTeam]leader` 开始的会话为例，实际存进去的大概是：

```ts
{
  sessionID: "ses_xxx",
  teamId: "coding-team",
  selectedAgentId: "coding-leader",
  selectedSurfaceLabel: "leader",
  mode: "single-executor",
  activeOwnerId: "coding-leader",
  source: "host-agent-selection"
}
```

这条数据的含义是：

- 这个 OpenCode session 属于 `coding-team`
- 用户选中的入口角色是 `coding-leader`
- 当前 active owner 也是 `coding-leader`
- 运行模式是 `single-executor`
- 这个绑定来自宿主的 agent 选择，而不是插件默认回退

### 为什么需要 `bindings`

OpenCode 原生只知道“当前用的是哪个 agent”。  
CrewBee 还需要知道：

- 属于哪个 Team
- 这是哪个入口路径
- 当前 owner 是谁
- 之后 task 委派时要按哪个 Team 语义适配

所以 `bindings` 是 CrewBee 对 OpenCode session 加的一层 Team 语义状态。

---

## 5. CrewBee 的 agent 定义如何与 OpenCode config 合并

这是最关键的问题之一。

相关文件：

- [bootstrap.ts](E:/0-AI/CrewBee/src/adapters/opencode/bootstrap.ts)
- [config-merge.ts](E:/0-AI/CrewBee/src/adapters/opencode/config-merge.ts)
- [projection.ts](E:/0-AI/CrewBee/src/adapters/opencode/projection.ts)

## 5.1 第一步：先生成 CrewBee 自己想注入的 patch

`createOpenCodeBootstrap(...)` 会做这些事：

1. `createTeamLibraryProjection(teamLibrary)`
2. `createOpenCodeAgentConfigs(projection)`
3. 生成 `configPatch`

`configPatch` 的结构大概是：

```ts
{
  agent: {
    "crewbee.coding-team.leader": { ...OpenCode agent definition... },
    "crewbee.coding-team.executor": { ... },
    ...
  },
  defaultAgent: "crewbee.coding-team.leader"
}
```

这个阶段只是“CrewBee 想注入什么”，还没有与宿主配置合并。

## 5.2 第二步：与 OpenCode 当前 config 合并

真正的合并在：

- `applyOpenCodeAgentConfigPatch(existingConfig, configPatch)`

里完成。

### 合并规则

规则可以概括成：

1. 不碰外部插件和用户自定义的非 CrewBee agent
2. CrewBee 自己管理的 key 可以更新
3. 历史遗留的旧前缀 key 可以被迁移清理
4. `default_agent` 只在安全条件下才覆盖

### 关键前缀

当前使用：

- `crewbee.`

兼容旧前缀：

- `agentscroll.`

### 示例：宿主当前 config

假设 OpenCode 里原本已有：

```json
{
  "default_agent": "build",
  "agent": {
    "build": {
      "name": "build"
    },
    "custom.my-reviewer": {
      "name": "My Reviewer"
    }
  }
}
```

CrewBee 想注入：

```json
{
  "agent": {
    "crewbee.coding-team.leader": {
      "name": "[CodingTeam]leader"
    },
    "crewbee.coding-team.executor": {
      "name": "[CodingTeam]executor"
    }
  },
  "defaultAgent": "crewbee.coding-team.leader"
}
```

### 合并后的结果

大致会变成：

```json
{
  "default_agent": "build",
  "agent": {
    "build": { "name": "build" },
    "custom.my-reviewer": { "name": "My Reviewer" },
    "crewbee.coding-team.leader": { "name": "[CodingTeam]leader" },
    "crewbee.coding-team.executor": { "name": "[CodingTeam]executor" }
  }
}
```

因为：

- `build` 是宿主自己的，不会覆盖
- `custom.my-reviewer` 是外部定义，不会覆盖
- CrewBee 只增加自己的 key
- 宿主已有明确的 `default_agent = build`，CrewBee 不会强改

## 5.3 `default_agent` 的覆盖规则

`default_agent` 只有在下面两种情况才会被 CrewBee 设进去：

1. 宿主当前没有 `default_agent`
2. 宿主当前 `default_agent` 本身就是 CrewBee 兼容前缀 key

所以这段逻辑很保守：

- 不会强行改掉用户明确指定的宿主默认 agent
- 只会在“空缺”或“原本就是 CrewBee 自己的默认值”时更新

---

## 6. `config` hook 为什么是异步函数

OpenCode 插件协议本身要求 hook 是异步的。

相关定义见：

- [packages/plugin/src/index.ts](E:/0-AI/CrewBee/tmp/opencode-src/packages/plugin/src/index.ts)

其中：

```ts
config?: (input: Config) => Promise<void>
```

### 为什么设计成异步

因为插件在配置阶段可能要做这些事：

- 读磁盘上的额外配置
- 安装或等待插件依赖
- 写日志
- 读网络配置
- 异步生成运行时注入内容

CrewBee 这里虽然主要是内存计算，但它也确实会：

- 校验 TeamLibrary
- 写日志
- 重新生成 projection

所以定义成异步是合理的，也与 OpenCode 插件模型一致。

## 6.1 `config` hook 的调用时机

OpenCode 的调用顺序是：

1. 启动 instance
2. `InstanceBootstrap()`
3. `Plugin.init()`
4. `Config.get()`
5. 对每个插件执行 `await hook.config?.(config)`

也就是说：

> `config` hook 的调用时机是 OpenCode 插件系统初始化阶段，在真正聊天会话开始前。

所以 `config` hook 的职责是：

- 修改运行时配置
- 注入 agents
- 设置默认 agent
- 做配置层准备

而不是每次用户发消息都执行。

---

## 7. 插件注册了哪些 hook，各自做什么

当前插件注册的 hook 是：

```ts
{
  config,
  "chat.message",
  "tool.definition",
  "tool.execute.before",
  "experimental.chat.system.transform",
}
```

下面分别解释。

## 7.1 `config`

作用：

- 重新计算最新的 `boot`
- 刷新 `aliasIndex`
- 把 CrewBee 的 agent patch 写到 `cfg.agent`
- 必要时更新 `current.default_agent`
- 记录 inserted / updated / skipped 日志

缩略版逻辑：

```ts
current = 当前 OpenCode config
next = 基于 TeamLibrary + current 重新计算 bootstrap
boot = next
aliasIndex = 基于 next.projectedAgents 重建
cfg.agent = next.mergedConfig.agent
如果 next.mergedConfig.default_agent 存在:
  current.default_agent = next.mergedConfig.default_agent
写日志
```

它的本质是：

> 把 CrewBee 产出的 projected agents 注入到 OpenCode 的配置层。

## 7.2 `chat.message`

作用：

- 当一条用户消息创建时，根据当前选中的 agent 生成 CrewBee session binding

缩略版逻辑：

```ts
selected = input.agent 或 boot 推导出的默认 agent
agent = 在 projectedAgents 中解析 selected
如果解析成功:
  bindings[input.sessionID] = createSessionRuntimeBinding(...)
```

它不修改消息文本，而是在“消息进入会话”时记住：

- 这个 session 属于哪个 Team
- 当前是哪个入口角色

## 7.3 `tool.definition`

作用：

- 只改 `task` 工具的描述文案
- 给模型补充“CrewBee 子代理别名说明”

缩略版逻辑：

```ts
如果 toolID 不是 task:
  return

helpLines = 为每个 projected agent 生成别名说明
把 helpLines 追加到 task.description
```

它不改变工具行为，只改变模型看到的工具说明书。

## 7.4 `tool.execute.before`

作用：

- 在 `task` 工具真正执行前，把 `subagent_type` 从别名改成 OpenCode 真实 agent key

缩略版逻辑：

```ts
如果 tool 不是 task:
  return
如果当前 session 没有 CrewBee binding:
  return
如果 output.args 不是对象:
  return
如果 output.args.subagent_type 不是字符串:
  return

resolved = aliasIndex.get(lower(subagent_type))
如果找到:
  output.args.subagent_type = resolved.agent.configKey
```

这是当前适配层最关键的运行时补丁。

它解决的问题是：

- prompt 里鼓励模型使用 `coding-executor`
- 模型也可能使用 `[CodingTeam]executor`
- 但 OpenCode `task` 最终需要 `crewbee.coding-team.executor`

所以这里必须做归一化。

## 7.5 `experimental.chat.system.transform`

作用：

- 把当前 session 的 CrewBee binding 信息追加进 system prompt

缩略版逻辑：

```ts
binding = bindings.get(input.sessionID)
如果有 binding:
  output.system.push("CrewBee runtime binding: ...")
```

追加进去的内容类似：

```text
CrewBee runtime binding:
- Team: coding-team
- Entry Agent: coding-leader
- Active Owner: coding-leader
- Mode: single-executor
```

这让模型知道：

- 自己不只是一个普通 OpenCode agent
- 当前会话处于 CrewBee 的某条 Team 路径里

---

## 8. 一次实际运行过程示例

假设用户在 OpenCode 里选择：

- `[CodingTeam]leader`

然后发送一句：

> 帮我修复登录流程里的 token 刷新问题

### 阶段 1：OpenCode 初始化时

`config` hook 先把 CrewBee 的 agents 注入到 OpenCode：

```json
{
  "crewbee.coding-team.leader": {
    "name": "[CodingTeam]leader"
  },
  "crewbee.coding-team.executor": {
    "name": "[CodingTeam]executor"
  }
}
```

### 阶段 2：消息进入时

`chat.message` 发现当前 agent 是：

- `crewbee.coding-team.leader`

于是建立 binding：

```json
{
  "sessionID": "ses_123",
  "teamId": "coding-team",
  "selectedAgentId": "coding-leader",
  "selectedSurfaceLabel": "leader",
  "mode": "single-executor",
  "activeOwnerId": "coding-leader",
  "source": "host-agent-selection"
}
```

### 阶段 3：模型拿到 system prompt

`experimental.chat.system.transform` 把 binding 加进去，模型因此知道：

- 我现在是在 `coding-team`
- 当前 owner 是 `coding-leader`

### 阶段 4：模型决定委派

模型调用 `task`，可能写：

```json
{
  "description": "Fix token refresh",
  "prompt": "定位并修复 token refresh 流程的 bug",
  "subagent_type": "coding-executor"
}
```

### 阶段 5：CrewBee 在 `tool.execute.before` 里改写

CrewBee 通过 `aliasIndex` 查表，把：

- `coding-executor`

改成：

- `crewbee.coding-team.executor`

于是最终 OpenCode `task` 工具实际看到的是：

```json
{
  "description": "Fix token refresh",
  "prompt": "定位并修复 token refresh 流程的 bug",
  "subagent_type": "crewbee.coding-team.executor"
}
```

这样 OpenCode 原生 `Agent.get(params.subagent_type)` 才能查到真实 agent。

---

## 9. 这层适配到底做了哪些事

从工程视角看，当前 CrewBee 对 OpenCode 的适配主要做了 4 类事情。

## 9.1 配置投影

把 CrewBee Team 定义转换成 OpenCode 原生 agent 配置：

- `cfg.agent`
- `cfg.default_agent`

## 9.2 命名桥接

解决同一个 agent 有多个标识的问题：

- `sourceAgentId`
- `publicName`
- `configKey`

让模型、prompt、OpenCode runtime 三边都能对齐。

## 9.3 会话语义绑定

在 OpenCode session 上补一层 CrewBee 的 Team 语义：

- 属于哪个 Team
- 从哪个入口角色进入
- 当前 active owner 是谁

## 9.4 工具调用适配

对 `task` 工具做最小干预：

- 修改工具说明
- 修改 `subagent_type`

但不接管 OpenCode 原生 task 执行器。

---

## 10. 为什么这种适配方式比较稳

因为它没有去做下面这些高风险动作：

- 不重写 OpenCode 的主 runloop
- 不替换 OpenCode 的 agent 系统
- 不修改 OpenCode UI
- 不自己实现一套 task 执行器

而是只做：

- 配置注入
- session 绑定
- task 参数归一化
- system prompt 补充

这意味着：

- OpenCode 仍然保留原生行为
- CrewBee 只在必要位置补 Team 语义
- 出问题时排查边界更清晰

---

## 11. 当前这层适配的边界

这份实现目前还没有做的事情包括：

- 没有真正接管 Team 内部 owner 切换
- 没有持久化 CrewBee 自己的 session state 到独立存储
- 没有实现 CrewBee 自定义工具
- 没有让 Team 内部 handoff 变成一套完整显式协议

当前版本更准确的定位是：

> CrewBee 作为 OpenCode 插件，对宿主配置和运行时做最小可行适配，使 Team-first 定义能在 OpenCode 的 Agent-first 运行时里成立。

---

## 12. 最后用一句人话总结

如果站在人类维护者视角看，这个插件就是在做三件事：

1. **把 CrewBee Team 翻译成 OpenCode agent**
2. **记住每个 session 在 CrewBee 语义里是谁、属于哪个 Team**
3. **在 task 委派前把“人类看得懂的 agent 名字”翻译成“OpenCode 真能执行的 agent key”**

理解了这三点，这套适配的主干就已经掌握了。

