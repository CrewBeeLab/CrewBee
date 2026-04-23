# OpenCode Agent Team 协作基础设施实现说明

## 1. 文档定位

本文档完整说明本次在 CrewBee 的 OpenCode 适配层中新增的 Agent Team 执行与协作基础设施。

本文档覆盖四类内容：

1. 功能定义：这次到底实现了哪些能力
2. 功能机制：这些能力在 OpenCode 插件运行时是如何运转的
3. 实现方案：代码结构、数据结构、状态流转、关键设计取舍
4. 验证结果：本次实现如何被测试和确认

本文档描述的是已经落地到当前仓库中的真实实现，而不是抽象设计草案。

相关源码入口：

- `src/adapters/opencode/plugin.ts`
- `src/adapters/opencode/delegation/tools.ts`
- `src/adapters/opencode/delegation/store.ts`
- `src/adapters/opencode/delegation/continuity.ts`
- `src/adapters/opencode/event-hook.ts`
- `src/adapters/opencode/tool-hooks.ts`
- `tests/opencode/delegate-task.test.mjs`

---

## 2. 实现目标

本次实现的目标是：

**为 CrewBee 的 Agent Team 在 OpenCode 宿主内提供最小可用、可持续、可恢复的协作基础设施，使 Team 成员之间可以进行稳定的会话级委派、后台跟踪、压缩后续接、结果收口和失败重试。**

更具体地说，要补齐三大能力面：

1. `delegate_task` / `delegate_status` / `delegate_cancel` 三个 CrewBee 插件工具
2. 会话 compaction / reopen 之后的 continuity 能力
3. 委派结果的结构化 hardening 能力

实现目标并不是做一个通用多 Agent 编排引擎，而是先把 CrewBee 在 OpenCode 里的 Team 内协作闭环打通。

---

## 3. 本次实现的功能总览

### 3.1 新增的对外能力

本次新增了 3 个可被 CrewBee agent 直接调用的插件工具：

- `delegate_task`
- `delegate_status`
- `delegate_cancel`

它们在运行时由 OpenCode 插件直接注册，源码位于 `src/adapters/opencode/delegation/tools.ts`，并通过 `src/adapters/opencode/plugin.ts` 接入插件的 `tool` hook。

### 3.2 新增的运行时保障能力

除工具本身外，还实现了这些运行时能力：

- delegated session 的持久化注册与状态跟踪
- foreground / background 两种委派执行模式
- background 委派的事件驱动完成态识别
- delegated session 的 resume 机制
- session compaction 前后的 prompt checkpoint 恢复
- parent session 名下的 delegated background task 摘要向 compaction context 注入
- todo snapshot 捕获与 compaction 后恢复
- no-text tail 识别与 checkpoint 再恢复
- `delegate_task` 结果自动追加 `resume_hint`
- `delegate_task` 失败结果自动追加 retry guidance
- 完成但无文本输出时的空输出提示

### 3.3 相关配套变更

为了让上述能力能真正被 Team 内成员使用，本次还补了三类配套集成：

- OpenCode 插件入口改为薄组合架构
- plugin tool registry 从 placeholder 改为 implemented
- Coding Team 内多个 agent 的工具请求与权限清单中加入 delegation 工具

相关文件：

- `src/runtime/registries/plugin-tools.ts`
- `src/runtime/registries/available-tools.ts`
- `src/agent-teams/embedded/coding-team/agents/coding-leader.ts`
- `src/agent-teams/embedded/coding-team/agents/coordination-leader.ts`
- `src/agent-teams/embedded/coding-team/agents/reviewer.ts`
- `src/agent-teams/embedded/coding-team/agents/principal-advisor.ts`

---

## 4. 功能边界与明确不做的事情

本次实现是为了追平 oh-my-opencode 在 Agent Team 协作基础设施上的基线能力，但不是无差别复制。

明确不做的内容如下：

### 4.1 不做 category 路由系统

没有引入 OMO 那种 category -> model / agent routing 机制。

当前实现里，`delegate_task` 只接受：

- `agent`
- `prompt`
- `session_id`
- `mode`

不接受 category，也不在 host 层做 category 到具体 runtime route 的映射。

### 4.2 不做 skill 注入参数

没有实现 OMO 风格的 `load_skills` 参数。

当前策略是：

- 主委派者只把目标、会话上下文和执行规则写进 envelope
- 被委派 agent 若需要 skill，自行根据任务决定加载

对应逻辑在 `src/adapters/opencode/delegation/prompt.ts` 的 `createDelegationEnvelope()` 中明确写入：

- `If you need a skill, decide and load it yourself based on the task`

### 4.3 不做 OpenCode 通用 bug recovery

本次 continuity 只覆盖和 CrewBee delegation 直接相关的恢复：

- prompt checkpoint 恢复
- delegated session continuity context 注入
- todo snapshot 恢复
- no-text tail 恢复

没有扩展到 OpenCode 宿主级通用异常恢复，例如：

- provider 级失败恢复
- thinking / tool_result 级宿主 bug recovery
- 任意 session 级崩溃补救

### 4.4 不把 child transcript 整段回注父会话

foreground 委派返回的是 child session 中锚点之后的最终 assistant 文本结果，不会把 child session 全部 transcript 粘回 parent。

这条边界很重要，因为它避免了：

- 父上下文被整段子会话污染
- compaction 时上下文膨胀
- tool / thought / intermediate chatter 被当作交付内容泄漏

### 4.5 compaction 只采用 merge 模式

在 `experimental.session.compacting` hook 中，只会向 `output.context` 追加 CrewBee continuity context，不会设置 `output.prompt` 去替换 OpenCode 默认 compaction prompt。

源码见 `src/adapters/opencode/compaction-hook.ts`。

---

## 5. OpenCode 插件里的整体架构变化

### 5.1 插件入口从单体逻辑改为组合式 hook 架构

OpenCode 插件入口在 `src/adapters/opencode/plugin.ts`。

当前插件启动时会做这些初始化：

1. 加载默认 TeamLibrary
2. 校验 TeamLibrary
3. 构建初始 bootstrap 与 alias index
4. 创建 `bindings` map
5. 创建 `DelegateStateStore`
6. 组装 OpenCode hooks

返回的 hooks 包括：

- `config`
- `tool`
- `event`
- `chat.message`
- `tool.definition`
- `tool.execute.before`
- `tool.execute.after`
- `experimental.chat.system.transform`
- `experimental.session.compacting`

这意味着本次 delegation 基础设施不是外挂的一组函数，而是已经被嵌进 OpenCode 插件生命周期。

### 5.2 delegation 相关模块划分

本次实现把 delegation 逻辑拆到了独立目录：`src/adapters/opencode/delegation/`

模块职责如下：

- `types.ts`：定义工具输入输出、状态、checkpoint、continuity state 等类型
- `store.ts`：状态持久化与内存缓存
- `resolve-agent.ts`：目标 agent 解析与 self-delegate 判定
- `prompt.ts`：委派 envelope、checkpoint、session title、model 选择
- `output.ts`：child session 输出提取、anchor 计算、no-text tail 检测
- `tool-result.ts`：委派结果的 JSON 序列化与失败结果构造
- `sdk-response.ts`：统一兼容 SDK 返回 `{ data }` 包裹或裸值
- `continuity.ts`：compaction continuity、checkpoint 恢复、todo snapshot、no-text 恢复
- `tools.ts`：三个插件工具的真实实现

这套拆分的意义是：

- 插件入口只做接线
- event / continuity / tool result / runtime state 各自独立
- 后续扩展通知、manager 可视化、更多宿主适配时更容易复用

---

## 6. 委派工具的功能定义

### 6.1 `delegate_task`

`delegate_task` 是 Agent Team 协作的核心入口，用于把当前 parent session 中的任务委派给 Team 内另一个成员。

参数定义位于 `src/adapters/opencode/delegation/types.ts`：

```ts
export interface DelegateTaskArgs {
  agent?: string;
  prompt: string;
  session_id?: string;
  mode?: "foreground" | "background";
}
```

其能力包括：

- 指定目标 agent
- 指定 delegated objective
- 可新建 child session，也可续用已有 delegated session
- 支持 foreground 执行
- 支持 background 执行
- 返回结构化 JSON 结果

返回结构：

```ts
export interface DelegateTaskResult {
  status: "running" | "completed" | "failed";
  session_id: string;
  task_ref?: string;
  message?: string;
  error_code?: DelegateTaskErrorCode;
  resume_supported?: boolean;
  resume_hint?: string;
}
```

### 6.2 `delegate_status`

`delegate_status` 用于查询某个 background 委派任务的当前状态。

参数：

```ts
export interface DelegateStatusArgs {
  task_ref: string;
}
```

返回：

```ts
export interface DelegateStatusResult {
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  session_id?: string;
  task_ref: string;
  message?: string;
}
```

### 6.3 `delegate_cancel`

`delegate_cancel` 用于取消 background delegation。

参数：

```ts
export interface DelegateCancelArgs {
  task_ref: string;
}
```

返回：

```ts
export interface DelegateCancelResult {
  ok: boolean;
  task_ref: string;
  session_id?: string;
  message: string;
}
```

---

## 7. `delegate_task` 的运行机制

### 7.1 目标 agent 解析机制

`delegate_task` 在真正发起子会话之前，先通过 `resolveDelegateAgent()` 解析目标 agent。

解析顺序位于 `src/adapters/opencode/delegation/resolve-agent.ts`：

1. 先按 projected canonical agent id 查找
2. 再按 alias index 查找

这样做的意义是：

- 允许直接使用 canonical agent id 进行委派
- 允许依赖 alias index 做兼容性解析与 host 轮转后的稳定定位

### 7.2 self-delegate 防护

如果当前 parent session 已经绑定到某个 CrewBee agent，那么 `delegate_task` 不允许把任务委派回当前 active agent 本身。

判定逻辑在 `isSelfDelegate()`：

- 当前会话存在 binding
- `binding.selectedAgentId === target.canonicalAgentId`

满足时返回 `self_delegate_forbidden`。

这样可以避免：

- 自己把任务再委派给自己，形成空转
- 主会话与子会话语义上失去边界

### 7.3 child session 创建与续用机制

`delegate_task` 的 session 解析逻辑在 `resolveChildSession()`。

它支持两种路径：

#### 路径 A：新建 child session

当未提供 `session_id` 时：

1. 调用 `client.session.create({ body: { parentID, title } })`
2. 创建一条 `DelegatedSessionRecord`
3. 写入 store

#### 路径 B：续用已有 delegated session

当提供 `session_id` 时，会进行严格校验：

1. session 必须存在于 CrewBee store 中
2. 该 session 必须由当前 parent session 创建
3. 该 session 必须绑定到相同的 source agent
4. 通过 `client.session.get()` 再确认 host 里 session 真实存在

不满足时返回：

- `invalid_session_id`
- `agent_session_mismatch`

这保证了 `session_id` 是 **主 continuity ID**，但只能在正确 parent / agent 关系里被恢复。

### 7.4 delegated title 生成

child session title 由 `createDelegatedTitle()` 生成：

```text
<agent>: <truncated prompt>
```

例如：

```text
reviewer: Review the current implementation.
```

这个 title 有两个作用：

- 在 OpenCode session 列表里可读
- 续用 delegated session 时具备稳定语义

### 7.5 delegation envelope 机制

真正传给 child session 的 prompt 不是用户原始 prompt，而是由 `createDelegationEnvelope()` 包装后的 delegation envelope。

核心字段包括：

- 当前 CrewBee team member 身份
- `Parent session`
- `Delegated session`
- delegated objective
- execution rules
- return shape

它解决的问题是：

- 子 agent 知道自己是在 continuation，而不是全新独立任务
- 子 agent 知道只处理被委派 objective，不扩 scope
- 子 agent 结果格式更稳定，便于父会话消费

### 7.6 model 解析机制

委派时 child session 使用什么 model，由 `resolveDelegateModel()` 负责：

1. 若 target agent 本身配置了 `resolvedModel`，优先用 target 自己的 model
2. 否则 fallback 到 parent session checkpoint 里保存的 model

这样保证：

- 有 agent 级显式模型配置时遵循 agent 自身配置
- 无显式配置时 continuity 仍尽量保持一致

### 7.7 checkpoint 写入机制

每次发起 delegation 前，都会调用 `createCheckpoint()`，把以下信息写入 store：

- `agent.configKey`
- `sourceAgentId`
- `model`
- `runtimeConfig.requestedTools`

它是 compaction / reopen 后恢复 prompt 执行环境的基础。

---

## 8. foreground 与 background 两种执行模式

### 8.1 foreground 模式

默认执行模式是 `foreground`。

也就是说，当调用者没有传 `mode` 时，`delegate_task` 会直接同步等待 child session 返回结果。

`runForeground()` 的流程是：

1. 调用 `getSessionAnchor()` 记录发起前 child session 的 message anchor
2. 解析 model
3. 构造 delegation envelope
4. 保存 checkpoint
5. 调用 `client.session.prompt()` 同步执行 child session
6. 调用 `extractAssistantText()` 提取 anchor 之后的最新 assistant 文本
7. 组装 `DelegateTaskResult`

foreground 的返回语义是：

- `status = completed`
- `session_id = child session id`
- `message = child session 产出的最终 assistant 文本`
- `resume_supported = true`

这是一种“委派但立即收口”的模式，适合：

- 结果需要马上被当前 agent 消费
- 子任务较短
- 不需要后台观察

### 8.2 background 模式

当 `mode = "background"` 时，`delegate_task` 不等待 child 完成，而是立即返回一个后台 task handle。

流程如下：

1. 记录当前 child session 的 message anchor
2. 构造 `DelegateTaskRecord`
3. 写入 store，初始状态为 `queued`
4. 启动 `promptAsync`，如果 SDK 不提供则 fallback 到 `prompt`
5. 立即返回：

```json
{
  "status": "running",
  "session_id": "...",
  "task_ref": "cbt_...",
  "message": "Delegated session launched in background.",
  "resume_supported": true
}
```

这里有两个关键设计：

#### 设计 1：launch 成功不等于最终完成

background 的完成态不是通过 launch 阶段的 try/catch 判断，而是以后续 session events 为主。

这正是本次实现的一个硬约束。

#### 设计 2：`task_ref` 与 `session_id` 分离

- `session_id`：child session 的 continuity ID，用于 resume
- `task_ref`：当前一次后台执行的 handle，用于 status / cancel

也就是说，同一个 `session_id` 可以经历多轮 background resume，而每一轮都是新的 `task_ref`。

---

## 9. background registry 与持久化机制

### 9.1 为什么需要 runtime store

如果 background delegation 只存在于内存里，会有三个问题：

1. 插件进程重启后状态丢失
2. compaction / reopen 后无法恢复背景上下文
3. 同一个 delegated session 多轮续用时无法做稳定关联

所以本次实现引入了 `DelegateStateStore`。

### 9.2 持久化位置

`DelegateStateStore` 的持久化文件路径为：

```text
<resolveInstallRoot()>/runtime/<sha1(worktree)>.json
```

代码位于 `src/adapters/opencode/delegation/store.ts`。

这里有两个关键点：

- 使用 `resolveInstallRoot()`，不在业务仓库内写 runtime 文件
- 按 worktree 做 hash 分片，不同项目互不污染

### 9.3 store 的根数据结构

`DelegateStateData` 定义如下：

```ts
export interface DelegateStateData {
  version: 1;
  tasks: Record<string, DelegateTaskRecord>;
  sessions: Record<string, DelegatedSessionRecord>;
  continuity: Record<string, ContinuityState>;
}
```

三大部分分别负责：

- `tasks`：一次 background 执行的记录
- `sessions`：delegated session 与 parent / agent 的绑定
- `continuity`：checkpoint、todos、compactedAt、noTextTailCount

### 9.4 关键记录类型

#### `DelegatedSessionRecord`

```ts
export interface DelegatedSessionRecord {
  sessionID: string;
  parentSessionID: string;
  sourceAgentId: string;
  configKey: string;
  lastTaskRef?: string;
}
```

作用：

- 记录这个 child session 属于哪个 parent
- 记录绑定到哪个 Team 成员
- 通过 `lastTaskRef` 把 session event 关联到“最新一轮 background 任务”

#### `DelegateTaskRecord`

```ts
export interface DelegateTaskRecord {
  taskRef: string;
  sessionID: string;
  parentSessionID: string;
  parentMessageID: string;
  sourceAgentId: string;
  configKey: string;
  description: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  startedAt: number;
  completedAt?: number;
  lastError?: string;
  lastUpdateAt: number;
  message?: string;
  anchor: number;
}
```

作用：

- 代表一次具体 background delegation 执行
- 记录 parent message、agent、状态、输出、错误、锚点
- 供 `delegate_status` 和 `delegate_cancel` 使用

#### `ContinuityState`

```ts
export interface ContinuityState {
  checkpoint?: DelegateCheckpoint;
  todos?: TodoSnapshot[];
  compactedAt?: number;
  noTextTailCount?: number;
}
```

作用：

- 保存 session 的 prompt checkpoint
- 保存 compaction 前 todo snapshot
- 记录最近一次 compacted 时间
- 跟踪 no-text tail 次数

### 9.5 `lastTaskRef` 的意义

这是本次实现里一个非常关键的设计。

因为 delegated session 可以被重复续用，所以同一个 `sessionID` 可能关联多个历史 `task_ref`。

如果事件只按 `sessionID` 找任务，会出现：

- 第二轮 resume 完成时，却把第一轮 task 标记为完成
- 或者 background status 查询错位

现在 `putTask()` 会在 `sessions[sessionID]` 上更新 `lastTaskRef`，因此 event hook 总是优先把 session event 关联到最新一轮 background 执行。

---

## 10. background 状态机与事件驱动机制

### 10.1 为什么必须走 event 驱动

本次实现明确要求：

**background 状态变更必须以 session events 为主，不能只靠 launch 时的 try/catch 判定完成态。**

原因是：

- launch 成功只能说明 prompt 已提交
- child session 真正开始执行、进入 idle、报错、被删除，都发生在之后
- try/catch 只能覆盖 transport 层 launch 失败，不能覆盖真实运行时状态

### 10.2 event hook 落点

事件主逻辑位于 `src/adapters/opencode/event-hook.ts`。

插件在 `plugin.ts` 中通过 `event: createEventHook(ctx, store)` 注册。

### 10.3 事件到状态的映射

当前实现处理这些事件：

#### `session.status`

- 若 `status.type === "busy"`：把对应 task 标记为 `running`
- 若 `status.type === "idle"`：触发 background 完成收口

#### `session.idle`

- 触发 background 完成收口
- 触发 no-text tail 恢复检测

#### `session.error`

- 把 task 标记为 `failed`
- `message = "Delegated session failed."`
- `lastError = "session.error"`

#### `session.compacted`

- 标记 `compactedAt`
- 恢复 prompt checkpoint
- 尝试恢复 todo snapshot

#### `session.deleted`

- 如果 task 尚未 completed / failed，则标记为 `cancelled`
- 清理 session 级 continuity 状态

### 10.4 background 完成收口

background 完成收口逻辑在 `finalizeBackgroundTask()`。

它的步骤是：

1. 根据 `sessionID` 找到最新 task
2. 若 task 已经进入终态则跳过
3. 通过 `extractAssistantText(sessionID, anchor)` 提取 child session 新增 assistant 输出
4. 若读取失败，标记 failed
5. 若读取成功，标记 completed，并把 assistant 文本存入 `task.message`

这里的 `anchor` 很关键：

- 它是 background launch 之前的消息长度
- 最终提取的是“这轮 delegated run 新增的 assistant 文本”
- 避免误读 session 历史旧消息

### 10.5 background 状态流转

当前实现的状态机可概括为：

```text
delegate_task(background)
  -> queued
  -> session.status busy -> running
  -> session.idle / session.status idle -> completed
  -> session.error -> failed
  -> delegate_cancel / session.deleted -> cancelled
  -> launch transport error -> failed
```

其中终态是：

- `completed`
- `failed`
- `cancelled`

---

## 11. `delegate_status` 与 `delegate_cancel` 的机制

### 11.1 `delegate_status`

`delegate_status` 只读取 store，不访问 child session 本体。

执行逻辑：

1. 用 `task_ref` 从 store 取 task
2. 若不存在，返回 failed-like status result
3. 若存在，返回当前 `status`、`session_id`、`message`

它的作用是把 background registry 作为稳定查询面暴露给 agent。

### 11.2 `delegate_cancel`

`delegate_cancel` 的机制是：

1. 用 `task_ref` 找到 task
2. 如果 task 不存在，返回 `ok = false`
3. 如果 task 已经是终态，返回 `ok = false`
4. 调用 `client.session.abort({ path: { id: sessionID } })`
5. **只有 abort 成功时**，才把 task 标记为 `cancelled`
6. abort transport 失败时，直接返回失败，不做乐观取消

这是本次实现中的一个明确收紧：

- 不允许只因为调用了 cancel，就假设 delegated session 一定被取消
- host abort 失败时，task 仍保持原状态，避免出现“表面 cancelled、实际仍在跑”的假状态

---

## 12. 结果 hardening 机制

### 12.1 为什么需要 hardening

`delegate_task` 是 Team 内协作工具，它的调用方通常是另一个 agent，而不是人类直接阅读。

所以返回值必须尽量：

- 结构化
- 可重试
- 可恢复
- 在边界情况下仍能给下一步动作提示

这部分逻辑位于 `src/adapters/opencode/tool-hooks.ts` 的 `createToolExecuteAfterHook()`。

它只拦截 `delegate_task` 的输出，并在 JSON 结果层做后处理。

### 12.2 空输出 warning

`withEmptyWarning()` 处理以下情况：

- `status === "completed"`
- `message` 为空或全空白

这时会把 message 改写为：

```text
Delegated session completed, but no text output was returned. Inspect the delegated session via `session_id` or `task_ref` if needed.
```

作用是避免调用方把“完成但无文本”误以为“结果正常”。

### 12.3 retry guidance

`withRetryGuidance()` 会根据 `error_code` 追加重试指导文案。

支持的错误码仅限：

- `missing_agent`
- `unknown_agent`
- `invalid_session_id`
- `agent_session_mismatch`
- `unsupported_mode`
- `self_delegate_forbidden`

每个错误码都有固定 remediation 文案，例如：

- `unknown_agent` -> `Fix: use a valid CrewBee member id or projected alias.`
- `invalid_session_id` -> `Fix: use a delegated session_id previously returned by delegate_task.`

最终 message 中会被拼接一段：

```text
[delegate_task CALL FAILED - RETRY REQUIRED]
Error: <error_code>
Fix: ...
Example: delegate_task(agent="reviewer", prompt="continue review")
```

这样失败不是死胡同，而是对调用 agent 可执行的修复提示。

### 12.4 `resume_hint`

`withResumeHint()` 会为成功或 running 的结果自动追加 `resume_hint`。

逻辑：

- 失败结果不追加
- 没有 `session_id` 不追加
- 已有 `resume_hint` 不重复追加

追加形式类似：

```text
to continue: delegate_task(session_id="<id>", agent="...", prompt="...")
```

其意义是：

- 强化 `session_id` 作为 continuity ID 的语义
- 鼓励 resume，而不是重复新建 delegated session

---

## 13. compaction continuity 机制

### 13.1 问题背景

OpenCode 会对 session 进行 compaction。

对于单 agent 会话，compaction 只影响上下文压缩；但对于 Team delegation 来说，compaction 还会影响三类状态：

1. delegated session 历史是否还可被继续引用
2. 当前 agent / model / tools 的执行上下文是否还能恢复
3. todo 列表是否被清空

因此本次实现了基于 hook + store 的 continuity 机制。

### 13.2 compaction hook 的职责

`experimental.session.compacting` 由 `src/adapters/opencode/compaction-hook.ts` 实现。

它做两件事：

1. `captureTodoSnapshot()`
2. `output.context.push(buildCompactionContext(...))`

也就是说：

- compaction 发生前先把 todo 列表读出来存进 store
- 再把 CrewBee continuity context 作为 merge context 追加进压缩输入

### 13.3 continuity context 里写了什么

`buildCompactionContext()` 当前会生成一个结构化提示骨架，包括：

1. User Requests / Final Goal
2. Work Completed
3. Remaining Tasks
4. Active Working Context
5. Explicit Constraints
6. Agent Verification State
7. Delegated Agent Sessions

其中最关键的是末尾的 runtime-carried delegated sessions 列表，例如：

```text
- reviewer | completed | Review the current implementation. | session_id=ses-child-1 | resume, don't restart
```

这里要特别注意，当前 carry-over 的真实来源不是“所有 child session 的完整注册表”，而是 `store.getTasksByParent(sessionID)` 返回的 **当前 parent session 名下 background delegation task 摘要**。

因此它的真实语义是：

- 该 parent session 曾经发起过哪些 delegated background task
- 这些 task 当前是什么状态
- 它们对应的 delegated `session_id` 是什么

它的目标不是注回全部 transcript，也不是精确重建所有 child session 元数据，而是告诉压缩后的主会话：

- 你已有可继续引用的 delegated background work 摘要
- 每条摘要关联哪个 agent、什么状态、哪个 `session_id`
- 要继续时请 resume，不要 restart

### 13.4 prompt checkpoint 恢复

当 `session.compacted` 事件发生后，`recoverPromptCheckpoint()` 会执行一次静默的 checkpoint refresh。

调用形式：

```ts
ctx.client.session.prompt({
  path: { id: sessionID },
  body: {
    agent: checkpoint.agent,
    model: checkpoint.model,
    noReply: true,
    tools: Object.fromEntries(checkpoint.tools.map(...)),
    parts: [{ type: "text", text: "[CrewBee internal prompt checkpoint refresh]" }],
  },
})
```

这里恢复的是：

- agent configKey
- model
- tool 可用性

这样 compaction 之后，session 再继续执行时仍尽量维持压缩前的执行环境。

### 13.5 todo snapshot 捕获与恢复

#### 捕获

todo snapshot 的捕获通过：

```ts
ctx.client.session.todo({ path: { id: sessionID } })
```

读取当前 todo 列表后写入 `continuity.todos`。

#### 恢复

这里本次实现有一个非常关键的真实发现：

- OpenCode SDK 暴露了 `session.todo()` 读取接口
- 但没有公开的 todo 写入接口
- 也不存在可稳定 import 的 `opencode/session/todo` 模块

因此当前恢复方案不是直接调用 host 内部 writer，而是：

1. 先读取当前 todo 列表
2. 如果当前列表非空，说明 host 已保留 todos，不做恢复
3. 如果当前列表为空，则通过 `session.prompt()` 注入一段内部恢复提示
4. 提示要求模型立刻使用 `TodoWrite` 工具按 snapshot 恢复 todo 列表

这里和 checkpoint restore 是两条不同机制：

- checkpoint restore 使用 `noReply: true`，目的是静默刷新 agent/model/tools 执行环境
- todo restore 使用真实的 `session.prompt(... noReply: false)`，目的是让模型真的执行 `TodoWrite`

也就是说，todo restore 不是“宿主内部静默写回”，而是一次明确的恢复性调度。

恢复提示由 `formatTodoRestorePrompt()` 生成，形如：

```text
[CrewBee internal] Session compaction cleared your todo list.
Please restore it immediately using the TodoWrite tool. Todos to restore:

- [in_progress][high] Ship feature

Restore all todos now. Do not reply with text — only call TodoWrite.
```

这是在当前 OpenCode SDK 真实能力边界内唯一稳定可行的恢复路径。

### 13.6 no-text tail 恢复

如果 compaction 之后 child / parent session 末尾出现“最新 assistant message 为空文本”的情况，会导致会话看起来像执行了但没有实质输出。

本次实现通过 `recoverNoTextTail()` 做检测：

1. 读取 `continuity.compactedAt`
2. 找出 compaction 之后最新 assistant message
3. 若文本为空，增加 `noTextTailCount`
4. 若连续两次都为空，则再次触发 `recoverPromptCheckpoint()`

这样做的思路是：

- 第一次空尾巴先记录
- 第二次仍空才判定执行环境可能失真
- 再次刷新 checkpoint，尝试把会话拉回到可继续工作状态

---

## 14. 会话绑定、系统提示与 delegation 的关系

### 14.1 `chat.message` 负责 parent session 的绑定建档

`src/adapters/opencode/chat-message-hook.ts` 的职责不是直接做 delegation，而是：

1. 在真实消息到来时解析当前 session 对应的 projected agent
2. 建立 `SessionRuntimeBinding`
3. 把 binding 放进 `bindings` map
4. 同时为该 session 保存 checkpoint

这一步的意义是：

- parent session 一旦开始工作，就拥有 active owner 语义
- 后续 `delegate_task` 才能做 self-delegate 防护
- compaction 后才能恢复 parent 的 prompt 环境

### 14.2 system transform 注入 runtime binding

`src/adapters/opencode/system-transform-hook.ts` 会把以下最小 binding 信息压进系统提示：

- Team
- Entry Agent
- Active Owner
- Mode

这不是 delegation 本身的执行逻辑，但它提供了 Team runtime 的最小宿主可见语义背景。

---

## 15. 工具注册、可见性与 agent 授权

### 15.1 plugin tool registry 更新

`src/runtime/registries/plugin-tools.ts` 中原先的 placeholder 已被替换为真实 implemented tool：

- `delegate_task`
- `delegate_status`
- `delegate_cancel`

每个工具都标记为：

- `source = "crewbee-plugin"`
- `status = "implemented"`
- `visibility = "agent-addressable"`

### 15.2 available tools fallback 修复

`src/runtime/registries/available-tools.ts` 做了一个非常重要的修复：

当宿主尚未显式提供 tool metadata 时，不再让 plugin tool 隐身，而是返回：

- `tools = pluginTools`
- `source = "default-placeholder"`
- `hasExplicitTools = false`

这避免了一个很隐蔽的问题：

- 新增的 delegation 工具已经在插件层实现
- 但如果 host tool list 为空，agent 侧仍可能“看不见”这些工具

### 15.3 `task` 工具的 alias 集成

本次不只是新增了 `delegate_*` 工具，也补齐了 CrewBee 和 OpenCode 内建 `task` 工具之间的兼容层。

具体有两部分：

#### `tool.definition`

`createToolDefinitionHook()` 会在 OpenCode 原生 `task` 工具描述后追加 CrewBee subagent alias help lines，告诉模型：

- 哪些 alias 可用于 CrewBee 子成员
- 在 CrewBee 内部委派时优先使用 source-agent alias

#### `tool.execute.before`

`createToolExecuteBeforeHook()` 会在真正执行 OpenCode 原生 `task` 之前，把参数里的 `subagent_type` alias 重写为 projected `configKey`。

这样做的意义是：

- 模型可以继续使用更稳定的 CrewBee 语义 alias
- 宿主最终收到的仍是 OpenCode 可执行的 projected agent key

因此，本次基础设施不只是新增了三件 delegation 工具，也把 CrewBee 的 agent 语义和 OpenCode 原生 `task` 路由打通了。

### 15.4 Coding Team 中的授权补齐

以下 agent 的 `runtimeConfig.requestedTools` 和 permission 已加入 delegation 三件套：

- `coding-leader`
- `coordination-leader`
- `reviewer`
- `principal-advisor`

这样 Team 内常见 owner、协调者、评审者和顾问都能显式发起 / 查询 / 取消委派。

---

## 16. 错误模型与约束设计

### 16.1 固定错误码集合

当前 `delegate_task` 只允许返回以下错误码：

- `missing_agent`
- `unknown_agent`
- `invalid_session_id`
- `agent_session_mismatch`
- `unsupported_mode`
- `self_delegate_forbidden`

这是一个刻意收窄的错误面，目的是让上层 agent 更容易写出稳定的 retry 逻辑。

### 16.2 各错误码对应语义

#### `missing_agent`

调用者没有提供 `agent`。

#### `unknown_agent`

给定的 agent 标识无法解析到任何 CrewBee projected agent / alias。

#### `invalid_session_id`

给定的 `session_id` 不存在、不是已知 delegated session，或不属于当前 parent session。

#### `agent_session_mismatch`

尝试用一个原本绑定给 A agent 的 delegated session 去续跑 B agent。

#### `unsupported_mode`

传入了非 `foreground` / `background` 的 mode。

#### `self_delegate_forbidden`

当前会话 active owner 试图把任务再委派给自己。

### 16.3 为什么不开放更多错误码

这里没有把所有 host 级异常都暴露成 error_code，是因为本次设计的目标是：

- 把 CrewBee 自己能稳定识别和修复的调用错误结构化
- 把其余 host 级 transport / runtime 错误保留在 message / lastError 层

这样 error model 更稳定，不会把 host 内部异常细节扩散成上层 contract。

---

## 17. 典型时序

### 17.1 foreground delegation 时序

```text
Parent session
  -> delegate_task(agent, prompt)
  -> resolve agent
  -> create or resume child session
  -> save checkpoint
  -> session.prompt(child)
  -> extract assistant text from child(anchor..)
  -> return structured result to parent
```

### 17.2 background delegation 时序

```text
Parent session
  -> delegate_task(agent, prompt, mode=background)
  -> resolve agent
  -> create or resume child session
  -> create task_ref + persist DelegateTaskRecord(status=queued)
  -> launch promptAsync(child)
  -> return { status=running, session_id, task_ref }

Later:
OpenCode session events
  -> session.status busy   -> task running
  -> session.idle          -> extract output -> task completed
  -> session.error         -> task failed
  -> session.deleted       -> task cancelled
```

### 17.3 compaction continuity 时序

```text
Before compaction
  -> experimental.session.compacting
  -> capture current todos
  -> append CrewBee continuity context to output.context

After compaction
  -> session.compacted
  -> mark compactedAt
  -> recover prompt checkpoint
  -> if todos disappeared, prompt model to restore them via TodoWrite
  -> later on session.idle, detect no-text tail and re-refresh checkpoint if needed
```

---

## 18. 真实实现中的几个关键设计取舍

### 18.1 `session_id` 是 continuity ID，`task_ref` 是一次后台执行 handle

这是整个设计能稳定运行的核心之一。

如果把二者合一，会出现两个问题：

- 无法区分“同一个 delegated session 的多次 resume”
- `delegate_status` / `delegate_cancel` 无法表达“本轮后台执行”

现在的分工是：

- `session_id`：长期 continuity 身份
- `task_ref`：一次 background run 的瞬时控制柄

### 18.2 background 完成态由 event 决定，而不是 launch 决定

这是对 OpenCode 异步执行语义的尊重。

如果 launch 成功就认为任务完成，会把“已提交”和“已完成”混为一谈。

当前实现只有在读取到后续 session event 后才更新终态，因此状态更可靠。

### 18.3 continuity 只注入摘要，不注入 child transcript

这项取舍解决了上下文污染问题。

compaction 时真正需要保留的是：

- 有哪些 delegated sessions
- 哪些工作已完成
- 哪些还可 resume

而不是把子会话原始内容再次注入父上下文。

### 18.4 todo 恢复采用 prompt 驱动而不是内部 import

早期思路是尝试动态导入 host 内部 todo writer，但实际验证后发现：

- 当前环境下没有稳定可用的 `opencode/session/todo` 模块
- `@opencode-ai/sdk` 只提供 read，不提供 write

因此改成“提示模型用 TodoWrite 自己恢复”的策略，保证实现基于真实可用能力，而不是脆弱的 host 内部路径。

### 18.5 插件入口采用薄组合，而不是让 `plugin.ts` 继续膨胀

因为 delegation 涉及：

- 工具
- 事件
- compaction
- system transform
- 结果后处理
- runtime registry

如果都堆在一个文件里，后续维护和测试都会迅速失控。

本次拆分之后，每一块能力都已经有清晰落点。

---

## 19. 测试与验证

### 19.1 新增测试文件

测试位于 `tests/opencode/delegate-task.test.mjs`。

### 19.2 已覆盖的关键场景

当前测试覆盖了以下场景：

1. foreground delegation 返回结构化结果并带 `resume_hint`
2. background delegation 通过 session events 完成收口，并进入 compaction context
3. `delegate_cancel` 正确取消 background delegation
4. 复用 delegated session 时，background 状态总是更新到最新 `task_ref`
5. `delegate_task` 失败时自动追加 retry guidance
6. `session.compacted` 触发 prompt checkpoint 恢复
7. `session.compacted` 后若 todo 列表为空，会发出 todo restore prompt

### 19.3 验证结果

本次实现落地时，验证结果为：

- `npm run typecheck` 通过
- `npm run build` 通过
- `npm test` 通过
- 当前相关测试总数为 `24/24` 通过

### 19.4 已确认的真实能力边界

通过对安装环境中 OpenCode 相关包的核对，已确认：

- `@opencode-ai/plugin` 提供插件 hook 面
- `@opencode-ai/sdk` 提供 session API 客户端
- SDK 暴露 `session.todo()` 读取接口
- SDK 没有公开 todo 写入接口
- 当前运行环境不存在稳定可 import 的 `opencode/session/todo`

这也是 todo 恢复策略调整为 prompt 驱动恢复的原因。

---

## 20. 当前实现文件清单

### 20.1 新增文件

- `src/adapters/opencode/delegation/types.ts`
- `src/adapters/opencode/delegation/store.ts`
- `src/adapters/opencode/delegation/resolve-agent.ts`
- `src/adapters/opencode/delegation/prompt.ts`
- `src/adapters/opencode/delegation/output.ts`
- `src/adapters/opencode/delegation/tool-result.ts`
- `src/adapters/opencode/delegation/continuity.ts`
- `src/adapters/opencode/delegation/tools.ts`
- `src/adapters/opencode/delegation/sdk-response.ts`
- `src/adapters/opencode/config-hook.ts`
- `src/adapters/opencode/chat-message-hook.ts`
- `src/adapters/opencode/system-transform-hook.ts`
- `src/adapters/opencode/compaction-hook.ts`
- `src/adapters/opencode/event-hook.ts`
- `src/adapters/opencode/tool-hooks.ts`
- `tests/opencode/delegate-task.test.mjs`

### 20.2 关键修改文件

- `src/adapters/opencode/plugin.ts`
- `src/runtime/registries/plugin-tools.ts`
- `src/runtime/registries/available-tools.ts`
- `src/agent-teams/embedded/coding-team/agents/coding-leader.ts`
- `src/agent-teams/embedded/coding-team/agents/coordination-leader.ts`
- `src/agent-teams/embedded/coding-team/agents/reviewer.ts`
- `src/agent-teams/embedded/coding-team/agents/principal-advisor.ts`

---

## 21. 当前仍保留的限制与后续可扩展方向

### 21.1 当前限制

尽管基础设施已经可用，但仍有几个边界需要明确：

#### 1. 没有 manager 级可视化视图

当前 background registry 已持久化，但还没有单独的 manager/debug UI 去展示：

- 当前有哪些 delegated tasks
- 各自状态是什么
- 哪些 delegated sessions 可 resume

#### 2. todo 恢复依赖模型执行 `TodoWrite`

因为 SDK 没有公开写接口，所以恢复不是宿主强写，而是提示模型恢复。

这意味着恢复可靠性取决于：

- 当前 agent 是否有 `TodoWrite` 工具
- 模型是否遵循恢复提示

#### 3. 没有 parent completion notification 机制

background task 完成后，当前实现会更新 registry，但不会主动向 parent session 注入通知消息。

调用方如果想知道完成，需要：

- 轮询 `delegate_status`
- 或依赖上层 manager / agent 自己建立轮询策略

### 21.2 后续可扩展方向

后续若继续增强，可以考虑：

1. 增加 parent session completion notification
2. 增加 manager/debug 视图，展示 persisted background registry
3. 增加更多 host-specific continuity 恢复策略
4. 如果未来 OpenCode SDK 暴露 todo write API，则把 prompt 恢复改成显式 API 恢复

---

## 22. 一句话总结

本次实现把 CrewBee 在 OpenCode 里的 Team 协作，从“只有静态 agent 投影”推进到了“具备真实 delegation、background 跟踪、compaction continuity、结果 hardening 的可运行基础设施”。

它不是一个泛化的多 Agent 平台，也没有扩张到 OMO 的全部能力，而是先把 Team 内最关键的闭环打通：

- 能委派
- 能续跑
- 能跟踪
- 能取消
- 能压缩后继续
- 能在失败和空输出边界上给出可恢复信号

对当前 CrewBee 来说，这已经构成了 Agent Team 执行与成员协作的第一版真正运行时基础设施。
