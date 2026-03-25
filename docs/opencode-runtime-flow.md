# OpenCode 运行时流程

## 1. 文档定位

本文档只讲一件事：

**CrewBee 是如何作为 OpenCode 插件被加载，并在运行时完成配置注入、会话绑定、delegation 工具接线、事件驱动状态跟踪和系统提示注入的。**

如果你想看更大的框架分层，请先看 `docs/architecture.md`。

---

## 2. 入口链路

当前 OpenCode 路径的入口链如下：

```text
package.json
  -> opencode-plugin.mjs
  -> dist/src/adapters/opencode/plugin.js
  -> src/adapters/opencode/plugin.ts
```

其中：

- `package.json` 把包根导向 `./opencode-plugin.mjs`
- `opencode-plugin.mjs` 负责把包根入口指向编译后的 OpenCode 插件实现
- `src/adapters/opencode/plugin.ts` 是源码级的真实 OpenCode 插件入口

---

## 3. OpenCode 插件初始化流程

源码入口：`src/adapters/opencode/plugin.ts`

初始化阶段做了这些事：

1. 调用 `loadDefaultTeamLibrary(ctx.worktree)`
2. 调用 `validateTeamLibrary(teamLibrary)`
3. 如果存在校验错误，直接抛错阻止插件继续加载
4. 把 warning / error 通过 `ctx.client.app.log()` 输出给宿主
5. 调用 `createInitialBootstrap()` 生成第一版 bootstrap 结果和 alias index
6. 初始化 `bindings` map，用来保存会话绑定结果
7. 初始化 `DelegateStateStore`，用来保存 delegation runtime 状态

这一步的作用是：

- 确保 TeamLibrary 合法
- 确保插件一启动就有默认的 OpenCode 投影结果

---

## 4. 运行时 Hook 说明

当前实现的是一组协同工作的 OpenCode hook，而不只是 3 个最小 hook。

### 4.1 `config`

作用：把 CrewBee 投影结果注入 OpenCode 配置。

主要流程：

```text
config hook
  -> get current config
  -> createOpenCodeBootstrap(existingConfig)
  -> write cfg.agent
  -> optionally write default_agent
  -> log inserted / updated / skipped agent keys
```

关键点：

- 不是直接硬写配置，而是先经过 `createOpenCodeBootstrap()`
- 如果宿主已有 foreign agents，会经过 collision 检查和安全过滤
- 只有在安全条件满足时才会回填 `default_agent`
- CrewBee 计算默认入口时会优先使用 Team 的 formal leader（若该 leader 是 user-selectable）
- OpenCode 最终列表顺序仍由宿主控制，所以 CrewBee 可靠控制的是 `default_agent` 与投影结果本身

相关文件：

- `src/adapters/opencode/plugin.ts`
- `src/adapters/opencode/bootstrap.ts`
- `src/adapters/opencode/config-merge.ts`
- `src/adapters/opencode/coexistence.ts`

### 4.2 `chat.message`

作用：在用户真正发消息时，把当前会话绑定回 CrewBee 的 Team / Agent 入口。

主要流程：

```text
chat.message hook
  -> read selected OpenCode agent
  -> resolveProjectedAgentSelection()
  -> createSessionRuntimeBinding()
  -> save binding into bindings map
```

绑定结果里会记录：

- `teamId`
- `selectedAgentId`
- `selectedSurfaceLabel`
- `mode`
- `activeOwnerId`
- `source`

相关文件：

- `src/adapters/opencode/plugin.ts`
- `src/adapters/opencode/projection.ts`
- `src/runtime/team-library-projection.ts`
- `src/runtime/types.ts`

### 4.3 `tool` / delegation tools

作用：把 CrewBee 的 Team 内 delegation 能力注册成 OpenCode 插件工具。

当前注册的工具包括：

- `delegate_task`
- `delegate_status`
- `delegate_cancel`

这些工具的真实实现位于：

- `src/adapters/opencode/delegation/tools.ts`
- `src/adapters/opencode/delegation/store.ts`
- `src/adapters/opencode/delegation/continuity.ts`

### 4.4 `event`

作用：消费 `session.status` / `session.idle` / `session.error` / `session.compacted` / `session.deleted` 等事件，把 background delegation 状态和 continuity 恢复真正闭环起来。

相关文件：

- `src/adapters/opencode/event-hook.ts`
- `src/adapters/opencode/delegation/store.ts`
- `src/adapters/opencode/delegation/continuity.ts`

### 4.5 `tool.definition` / `tool.execute.before` / `tool.execute.after`

作用：把 CrewBee 的 projected agent 语义与 OpenCode 原生 `task` 工具接起来。

其中：

- `tool.definition`：给原生 `task` 追加 CrewBee alias 帮助文本
- `tool.execute.before`：把 `subagent_type` alias 重写成 projected config key
- `tool.execute.after`：对 delegation 工具结果做 result hardening

### 4.6 `experimental.chat.system.transform`

作用：在系统提示里注入最小 CrewBee 运行时说明。

当前注入内容包括：

- Team
- Entry Agent
- Active Owner
- Mode

这一步的意义不是完整提示组装，而是让 OpenCode 运行时知道当前会话在 CrewBee 视角下绑定到了哪里。

### 4.7 `experimental.session.compacting`

作用：在 OpenCode compaction 前向 `output.context` 追加 CrewBee continuity context，并为后续 checkpoint / todo 恢复保存最小事实。

---

## 5. `createOpenCodeBootstrap()` 到底做了什么

源码：`src/adapters/opencode/bootstrap.ts`

这是 OpenCode 静态装配主流程，负责把 TeamLibrary 编译成宿主能消费的结果。

### 输入

- `teamLibrary`
- `defaults`
- `availableTools`
- `existingConfig`
- `existingDefaultAgent`
- `sessionID`
- `selectedHostAgent`
- `selectedTeamId`
- `selectedSourceAgentId`
- `selectedMode`

### 输出

- `adapter`
- `projection`
- `projectedAgents`
- `toolDomainPlan`
- `configPatch`
- `mergedConfig`
- `mergeResult`
- `collisions`
- `sessionBinding`

### 主步骤

```text
TeamLibrary
  -> createTeamLibraryProjection()
  -> createOpenCodeAgentConfigs()
  -> detectOpenCodeProjectionCollisions()
  -> filterSafeProjectedAgents()
  -> resolveBindingAgent()
  -> createSessionRuntimeBinding() (optional)
  -> createOpenCodeAgentConfigPatch()
  -> applyOpenCodeAgentConfigPatch() (optional)
```

其中 `resolveBindingAgent()` 的默认路径是：

1. 先看宿主当前选中的 agent
2. 再看显式传入的 `teamId + sourceAgentId`
3. 都没有时，回退到默认 Team，并由 `pickDefaultUserSelectableAgent()` 选择默认入口

而 `pickDefaultUserSelectableAgent()` 当前的语义是：

- formal leader 若为 user-selectable，则优先成为默认入口
- 否则按 runtime projection 的稳定顺序选择第一个可选 agent

它的定位很明确：

- **不是** OpenCode 插件入口
- **不是** runtime hook 实现
- **而是** OpenCode 适配层的静态装配主函数

---

## 6. OpenCode Agent 是怎么生成的

源码：`src/adapters/opencode/projection.ts`

每个 `ProjectedAgent` 会被映射成一份 `OpenCodeAgentConfig`。

主要映射内容：

- `configKey`
- `publicName`
- `mode`
- `hidden`
- `description`
- `prompt`
- `permission`
- `resolvedModel`
- `resolvedTooling`

其中几个关键规则：

1. `user-selectable` -> `primary`
2. `internal-only` -> `subagent` + `hidden`
3. `agent_runtime` 会被映射成 `model / temperature / top_p / variant / options`
4. Agent 请求工具会先走 `permission-mapper.ts` 的宿主工具名映射
5. OpenCode 最终可见列表顺序不是由 CrewBee 的插入顺序直接决定；CrewBee 主要控制 default agent 与 projected names

---

## 7. 当前 OpenCode MVP 的边界

已经实现：

- 真正的 OpenCode 插件入口
- 真实 config hook
- 真实消息阶段会话绑定
- 真实 system transform 注入
- 配置合并与 collision 控制
- delegation 三件套工具
- background delegation 的事件驱动收口
- compaction continuity 与 todo 恢复提示
- OpenCode 原生 `task` 的 alias 兼容层

尚未实现：

- 宿主无关的 Team-collaboration 执行编排
- 更丰富的 runtime timeline / replay
- 通用多宿主入口层

---

## 8. 建议阅读源码顺序

如果你要顺着运行流程读代码，建议顺序是：

1. `opencode-plugin.mjs`
2. `src/adapters/opencode/plugin.ts`
3. `src/adapters/opencode/bootstrap.ts`
4. `src/adapters/opencode/projection.ts`
5. `src/adapters/opencode/config-merge.ts`
6. `src/runtime/team-library-projection.ts`
7. `src/agent-teams/library.ts`

这条顺序最接近宿主真实调用链。
