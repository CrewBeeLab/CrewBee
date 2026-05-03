# CrewBee Agent Team 与 Provider/Model 配置现状调研

> 目的：为后续设计“内置 Coding Team 的默认 provider/model 与环境适配 / fallback 方案”提供当前工程事实。本文只描述现状，不提出最终实现方案。

## 1. 当前配置体系总览

CrewBee 当前的 Team 配置链路是：

```text
crewbee.json
  -> Team Registration Source
  -> Team Registration
  -> AgentTeamDefinition
  -> TeamLibrary
  -> TeamLibraryProjection
  -> OpenCode Agent Config Patch
  -> OpenCode cfg.agent / cfg.default_agent
```

核心实现位置：

- `src/agent-teams/filesystem.ts`：读取全局 / 项目级 `crewbee.json`，归一化 Team 注册项，加载文件型 Team。
- `src/agent-teams/library.ts`：加载内置 Team 与文件型 Team，排序、去重、shadow 处理、校验并生成 `TeamLibrary`。
- `src/runtime/team-library-projection.ts`：把 `TeamLibrary` 投影成 `ProjectedTeam` / `ProjectedAgent`。
- `src/adapters/opencode/projection.ts`：把 `ProjectedAgent` 投影成 OpenCode Agent 定义，包含 `model`、`temperature`、`top_p`、`variant`。
- `src/adapters/opencode/bootstrap.ts` 与 `src/adapters/opencode/config-hook.ts`：在 OpenCode config hook 中生成并写回 `cfg.agent` 和默认 Agent。

当前没有独立的 model resolver、provider 可用性检测、fallback chain 或运行时 API 错误 fallback。provider/model 主要来自 Team manifest 的 `agent_runtime`。

## 2. Agent Team 的配置方式

### 2.1 内置 Team 配置方式

内置 Team 通过 `crewbee.json` 中的 `id` 引用：

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 }
  ]
}
```

加载逻辑：

- `src/agent-teams/filesystem.ts` 将 `{ "id": "coding-team" }` 归一化为 `ConfiguredEmbeddedTeamSource`。
- `src/agent-teams/library.ts` 的 `loadEmbeddedTeam()` 只识别 `BUILTIN_CODING_TEAM_ID`，并调用 `createEmbeddedCodingTeam()`。
- 内置 Coding Team 的完整 Team manifest、policy 与 agent 列表定义在 `src/agent-teams/embedded/coding-team.ts` 及 `src/agent-teams/embedded/coding-team/agents/*`。

全局配置缺失或安装修复时，CrewBee 会默认加入内置 `coding-team`：

- `createDefaultCrewBeeConfig()` 默认返回 `teams: [{ id: "coding-team", enabled: true, priority: 0 }]`。
- packaged 模板 `templates/crewbee.json` 也默认启用 `coding-team`，其它模板 Team 默认 disabled。
- global source 配置缺失时，`listConfiguredTeamSourcesFromDescriptor()` 会用 `createDefaultCodingTeamSource()` 兜底。

### 2.2 文件型 Team：模板目录 + YAML/Markdown 配置

文件型 Team 是一个目录，当前只读取目录根部文件：

```text
<TeamDir>/
  team.manifest.yaml
  team.policy.yaml
  <agent-1>.agent.md
  <agent-2>.agent.md
  TEAM.md        # optional
  README.md      # optional
```

必需文件：

- `team.manifest.yaml`
- `team.policy.yaml`
- 至少一个 `*.agent.md`

当前实现不会扫描 `agents/`、`docs/` 等子目录中的 Agent 文件。对应实现是 `loadTeamDefinitionFromDirectoryWithIssues()`：读取 manifest、policy，并枚举 Team 根目录下的 `*.agent.md`。

文件型 Team 通过 `crewbee.json` 中的 `path` 引用：

```json
{
  "teams": [
    { "path": "@teams/general-team", "enabled": false, "priority": 1 }
  ]
}
```

随包模板位于：

```text
templates/
  crewbee.json
  teams/
    general-team/
    template-team/
    wukong-team/
```

安装 / 修复时，模板 Team 会复制到 OpenCode config root 下的 `teams/` 目录。

### 2.3 `team.manifest.yaml`

`team.manifest.yaml` 定义 Team 本体：

- `id` / `version` / `name` / `description`
- `mission`
- `scope`
- `leader.agent_ref`
- `members`
- `workflow.stages`
- `governance`
- `agent_runtime`
- `tags`
- `prompt_projection`

解析实现是 `src/agent-teams/parsers.ts` 的 `mapTeamManifest()`。其中 `agent_runtime` 会被解析成 `TeamManifest.agentRuntime`。

### 2.4 `team.policy.yaml`

`team.policy.yaml` 定义 Team 共享规则，当前用于 Team Contract / prompt projection：

- `instruction_precedence`
- `approval_policy`
- `forbidden_actions`
- `quality_floor`
- `working_rules`
- `prompt_projection`

解析实现是 `src/agent-teams/parsers.ts` 的 `mapTeamPolicy()`。

### 2.5 `*.agent.md`

Agent 文件使用 Markdown + frontmatter 风格定义。核心字段包括：

- metadata：`id`、`kind`、`version`、`name`
- `persona_core`
- `responsibility_core`
- 执行语义：`core_principle`、`scope_control`、`ambiguity_policy`、`support_triggers`、`task_triage`、`delegation_review`、`completion_gate`、`failure_recovery`
- `collaboration`
- `runtime_config`
- `output_contract`
- `entry_point`
- `prompt_projection`

注意：当前 Agent 自身的 `runtime_config` 管的是工具、权限、skills、instructions、MCP、memory、hooks 等运行能力；不包含 provider/model。provider/model 在 Team manifest 的 `agent_runtime` 中统一配置。

## 3. 全局配置、项目配置与不同工程使用不同 Team

### 3.1 配置文件位置

CrewBee 当前支持两个同构配置来源：

| 作用域 | 配置文件 | 路径解析基准 | source precedence |
| --- | --- | --- | --- |
| global | `<OpenCodeConfigRoot>/crewbee.json` | OpenCode config root | 低 |
| project | `<project-worktree>/.crewbee/crewbee.json` | `<project-worktree>/.crewbee` | 高 |

常见全局路径：

```text
~/.config/opencode/crewbee.json
```

Windows 常见路径：

```text
C:\Users\<user>\.config\opencode\crewbee.json
```

项目级路径：

```text
<project-worktree>/.crewbee/crewbee.json
```

### 3.2 `crewbee.json` 当前 schema

当前 `crewbee.json` 的有效 Team entry 字段只有：

| 字段 | 说明 |
| --- | --- |
| `id` | 引用内置 Team，例如 `coding-team` |
| `path` | 引用文件型 Team 目录 |
| `enabled` | 是否启用，默认 `true` |
| `priority` | 同一 source 内排序值，数字越小越优先 |

约束：同一个 entry 只能写 `id` 或 `path`，不能同时写。

当前 `crewbee.json` 不支持 provider/model override、Team override、Agent override、extends、include 或 per-agent runtime patch。

### 3.3 路径解析规则

`path` 支持：

```json
{ "path": "@teams/ProjectCodingTeam" }
{ "path": "teams/ProjectCodingTeam" }
{ "path": "~/CrewBeeTeams/ProjectCodingTeam" }
{ "path": "E:/CrewBeeTeams/ProjectCodingTeam" }
```

规则：

- `@teams/xxx`：去掉 `@` 后，相对于当前 `crewbee.json` 所在目录。
- `teams/xxx`：相对于当前 `crewbee.json` 所在目录。
- `~/xxx`：相对于用户 home。
- 绝对路径：按原样使用。

因此，同样的 `@teams/foo` 在全局和项目配置下解析到不同目录：

```text
global  @teams/foo -> <OpenCodeConfigRoot>/teams/foo
project @teams/foo -> <project-worktree>/.crewbee/teams/foo
```

### 3.4 不同工程配置不同 Team

不同工程通过各自 worktree 下的 `.crewbee/crewbee.json` 配置不同 Team。例如：

```json
{
  "teams": [
    { "path": "@teams/project-coding-team", "enabled": true, "priority": 0 },
    { "id": "coding-team", "enabled": true, "priority": 1 }
  ]
}
```

对应目录：

```text
<project-worktree>/
  .crewbee/
    crewbee.json
    teams/
      project-coding-team/
        team.manifest.yaml
        team.policy.yaml
        project-leader.agent.md
```

加载排序规则：

1. project source 优先于 global source。
2. 同一 source 内按 `priority` 从小到大。
3. 同一 source 且 priority 相同，按 `crewbee.json` 中声明顺序。

Team ID 冲突时，先加载的 Team 获胜。典型场景：项目级 Team 使用与全局 Team 相同的 manifest id 时，会 shadow 全局 Team。实现位置是 `src/agent-teams/library.ts` 的 `usedTeamIds` 逻辑。

## 4. Provider/Model 当前在哪里配置

### 4.1 类型定义

provider/model 的核心类型是 `AgentRuntimeModelConfig`：

```ts
export interface AgentRuntimeModelConfig {
  provider: string;
  model: string;
  temperature?: number;
  topP?: number;
  variant?: string;
  options?: Record<string, unknown>;
}
```

它挂在 `TeamManifest.agentRuntime?: Record<string, AgentRuntimeModelConfig>` 上。

### 4.2 文件型 Team 的配置字段

文件型 Team 在 `team.manifest.yaml` 中配置 `agent_runtime`：

```yaml
agent_runtime:
  leader:
    provider: openai
    model: gpt-5.5
    temperature: 0.25
    top_p: 0.9
    variant: generalist-orchestrator
    options:
      reasoning_effort: high
```

解析规则：

- `provider` 必填。
- `model` 必填。
- `temperature` 可选，直接 `Number(...)`。
- `top_p` 或 `topP` 可选，映射为 `topP`。
- `variant` 可选。
- `options` 可选，原样浅拷贝为对象。

实现位置：`src/agent-teams/parsers.ts` 的 `mapAgentRuntime()`。

校验规则：当前只校验 `agent_runtime` 的 key 是否指向 Team 内存在的 Agent；不存在时产生 warning。当前不校验 provider/model 是否存在、是否可连接、参数是否被 provider 支持。

### 4.3 内置 Coding Team 的 provider/model 配置位置

内置 Coding Team 的 provider/model 直接硬编码在：

```text
src/agent-teams/embedded/coding-team.ts
```

当前位置是 `createEmbeddedCodingTeam()` 中的 `manifest.agentRuntime`：

```ts
agentRuntime: {
  "coding-leader": { provider: "openai", model: "gpt-5.5", temperature: 0.2, topP: 0.85, variant: "long-context" },
  "coordination-leader": { provider: "openai", model: "gpt-5.5", temperature: 0.15, topP: 0.75 },
  "coding-executor": { provider: "openai", model: "gpt-5.5", temperature: 0.25, topP: 0.9 },
  "codebase-explorer": { provider: "openai", model: "gpt-5.5", temperature: 0.1, topP: 0.8 },
  "web-researcher": { provider: "openai", model: "gpt-5.5", temperature: 0.2, topP: 0.85 },
  reviewer: { provider: "openai", model: "gpt-5.5", temperature: 0.15, topP: 0.75 },
  "principal-advisor": { provider: "openai", model: "gpt-5.5", temperature: 0.15, topP: 0.75 },
  "multimodal-looker": { provider: "openai", model: "gpt-5.5", temperature: 0.2, topP: 0.85 },
}
```

这意味着当前内置 Coding Team 对 `openai/gpt-5.5` 是硬依赖式投影：只要启用内置 `coding-team`，OpenCode agent config 中就会写入这些模型字段。

### 4.4 其它模板 Team 的 provider/model 配置

随包模板 Team 也在各自 `team.manifest.yaml` 的 `agent_runtime` 中配置 provider/model。例如：

- `templates/teams/general-team/team.manifest.yaml`
- `templates/teams/template-team/team.manifest.yaml`

它们当前也默认使用 `provider: openai`、`model: gpt-5.5`。

## 5. Provider/Model 如何投影到 OpenCode

### 5.1 Agent ID 归一化对 `agent_runtime` 的影响

Team 加载后会执行 `normalizeTeamAgentIds()`。它会把 Agent source id 归一化为 canonical id，并同步重写：

- `manifest.leader.agentRef`
- `manifest.members`
- `manifest.agentRuntime`
- Agent metadata / collaboration refs

因此，投影阶段使用的是 canonical agent id：

```ts
const runtimeOverride = agent.sourceTeam.manifest.agentRuntime?.[agent.canonicalAgentId];
```

对内置 `coding-team` 来说，`coding-leader` 等 id 本身已经符合 canonical 结果，因此保持不变。对文件型 Team 来说，如果 Team id 前缀会被补入 Agent id，`agent_runtime` key 也会被同步重写。

### 5.2 OpenCode Agent Config 中的 resolvedModel

`src/adapters/opencode/projection.ts` 的 `createOpenCodeAgentConfig()` 读取：

```ts
agent.sourceTeam.manifest.agentRuntime?.[agent.canonicalAgentId]
```

如果存在 runtime override，就生成：

```ts
resolvedModel: {
  providerID: runtimeOverride.provider,
  modelID: runtimeOverride.model,
  temperature: runtimeOverride.temperature,
  topP: runtimeOverride.topP,
  variant: runtimeOverride.variant,
  options: runtimeOverride.options,
  source: "team-manifest",
}
```

如果不存在，就不生成 `resolvedModel`。

### 5.3 写入 OpenCode agent 定义

`createOpenCodeAgentDefinition()` 会把 `resolvedModel` 写成 OpenCode agent definition 字段：

```ts
model: agent.resolvedModel
  ? `${agent.resolvedModel.providerID}/${agent.resolvedModel.modelID}`
  : undefined,
temperature: agent.resolvedModel?.temperature,
top_p: agent.resolvedModel?.topP,
variant: agent.resolvedModel?.variant,
options: createManagedCrewBeeAgentOptions({
  teamId: agent.teamId,
  canonicalAgentId: agent.canonicalAgentId,
  existingOptions: agent.resolvedModel?.options,
}),
```

重要现状：

- 如果 `agent_runtime` 存在，OpenCode agent definition 一定写入 `model: "provider/model"`。
- 如果 `agent_runtime` 不存在，`model`、`temperature`、`top_p`、`variant` 都是 `undefined`，OpenCode 会使用宿主默认模型。
- 当前 CrewBee 不检查该 provider/model 是否在用户 OpenCode 环境中可用。
- 当前 CrewBee 不根据 OpenCode 当前 UI-selected model 或用户默认 model 动态改写 Team model。

### 5.4 Config Hook 写回 OpenCode

OpenCode config hook 链路：

```text
createConfigHook()
  -> createOpenCodeBootstrap()
  -> createOpenCodeAgentConfigs()
  -> createOpenCodeAgentConfigPatch()
  -> applyOpenCodeAgentConfigPatch()
  -> cfg.agent = merged agents
  -> current.default_agent = merged default_agent
```

`applyOpenCodeAgentConfigPatch()` 会：

- 删除旧的 CrewBee managed agent 中不再存在的 key。
- 插入新的 CrewBee agent。
- 更新已有 CrewBee managed agent。
- 遇到同名外部 agent 时跳过，避免覆盖非 CrewBee agent。

默认 Agent 由 `bootstrap.ts` 选择：优先 selected host agent / explicit selected team-agent；否则按 TeamLibrary 排序选择默认 Team 的 user-selectable leader。

## 6. 当前用户如何影响内置 Coding Team 的 provider/model

当前用户可以间接影响，但没有直接 override 机制。

### 6.1 可行方式 A：禁用内置 Coding Team，使用文件型替代 Team

用户可以在项目 `.crewbee/crewbee.json` 或全局 `crewbee.json` 中启用自己的文件型 Team，并设置更高优先级。但如果仍启用内置 `coding-team`，它仍会被投影，只是默认入口可能不是它。

项目示例：

```json
{
  "teams": [
    { "path": "@teams/project-coding-team", "enabled": true, "priority": 0 },
    { "id": "coding-team", "enabled": false, "priority": 1 }
  ]
}
```

限制：这不是“配置内置 Coding Team 的 provider/model”，而是用另一支文件型 Team 替代它。用户需要复制 / 维护整套 Team 定义。

### 6.2 可行方式 B：项目 Team shadow 全局同名 Team

项目级文件型 Team 可以使用 manifest id `coding-team`，从而 shadow 全局 / 内置 `coding-team`。加载时 project source precedence 更高，同 ID 后加载的 global Team 会被跳过。

项目示例：

```json
{
  "teams": [
    { "path": "@teams/coding-team", "enabled": true, "priority": 0 }
  ]
}
```

其中：

```text
<project-worktree>/.crewbee/teams/coding-team/team.manifest.yaml
```

的 `id` 写成：

```yaml
id: coding-team
```

限制：仍需要复制内置 Coding Team 的全部 manifest、policy、agent 文件；不是轻量 override。

### 6.3 当前不可行：只在 `crewbee.json` 中覆盖内置 Coding Team 的 model

当前 `crewbee.json` entry schema 不支持：

```json
{
  "id": "coding-team",
  "agent_runtime": {
    "coding-leader": { "provider": "anthropic", "model": "claude-sonnet" }
  }
}
```

也不支持：

```json
{
  "models": { ... },
  "teams": { ... }
}
```

这些字段会被当前 loader 忽略或视为未知配置，不会进入 `AgentTeamDefinition`。

## 7. 与 fallback 方案设计相关的现状约束

### 7.1 当前 provider/model 是 Team manifest 的静态字段

当前设计把 provider/model 视为 Team 定义的一部分，而不是独立的用户环境适配层。实现上 `OpenCodeResolvedModelConfig.source` 只有 `"team-manifest"`。

后续如果要支持 fallback，需要决定是在以下哪个层次插入 resolver：

```text
Team manifest agentRuntime
  -> model resolver / override / fallback
  -> OpenCodeResolvedModelConfig
  -> OpenCode Agent Definition
```

### 7.2 不写 model 字段即可回退到 Host Default

当前投影代码已经天然支持“没有 resolvedModel 时不写 model”。这为 Host Default 兜底提供了低侵入实现点：只要 resolver 在无法确认可用模型时返回 `undefined`，OpenCode agent definition 就不会带 `model` 字段。

### 7.3 内置 Coding Team 目前无法被轻量配置

内置 Coding Team 的 `agentRuntime` 直接在 TypeScript 中硬编码。用户不能通过 `crewbee.json` 对内置 Team 的单个 Agent model 做 patch，只能替换整支 Team 或禁用它。

这正是后续功能设计需要补齐的关键点：允许用户配置内置 `coding-team` 的 provider/model，同时避免把内置推荐模型变成硬依赖。

### 7.4 当前没有 provider 可用性来源

当前代码没有读取 OpenCode provider/model registry、用户认证状态、环境变量或 models.dev metadata。也没有 doctor 输出“模型解析路径”。

后续 fallback 方案如果要做“环境解析”，需要新增可用性来源或采用保守策略：无法确认可用时不写 model，交给 Host Default。

### 7.5 当前参数不会做 capability 归一化

`temperature`、`top_p`、`variant`、`options` 当前会按 Team manifest 原样投影。没有按 provider/model 能力移除不支持字段的逻辑。

如果后续引入跨 provider fallback，需要考虑参数兼容：例如某些 provider 不支持 `variant`、某些模型不支持特定 `options.reasoning_effort`。

## 8. 后续设计可用的最小插入点

基于现状，后续 provider/model 默认与适配功能可以考虑这些插入点：

1. **配置 schema 层**：扩展 `crewbee.json`，支持全局 / 项目级 model 配置、Team override、Agent override。
2. **Team 加载层**：在 `loadDefaultTeamLibrary()` 或加载内置 Team 后，对 `manifest.agentRuntime` 做 override patch。
3. **Projection 层**：在 `createOpenCodeAgentConfig()` 中，把 `runtimeOverride` 交给 model resolver，输出 `resolvedModel | undefined`。
4. **Doctor / diagnostics 层**：扩展 `doctor` 和 config hook log，输出每个 Agent 的期望 profile、实际 model、fallback/host-default 原因。

其中 Projection 层最贴近“是否写入 OpenCode model 字段”的决策；配置 schema 层最贴近“用户如何覆盖内置 Coding Team”的需求。

## 9. 关键文件索引

| 主题 | 文件 |
| --- | --- |
| 内置 Coding Team manifest / agentRuntime | `src/agent-teams/embedded/coding-team.ts` |
| 内置 Coding Team agents | `src/agent-teams/embedded/coding-team/agents/*` |
| Team / Agent 核心类型 | `src/core/index.ts` |
| `crewbee.json` 读取与 Team source 归一化 | `src/agent-teams/filesystem.ts` |
| TeamLibrary 加载、排序、shadow | `src/agent-teams/library.ts` |
| YAML / Agent MD 解析 | `src/agent-teams/parsers.ts` |
| Team 校验 | `src/agent-teams/validation.ts` |
| Agent canonical id 与 `agentRuntime` key 重写 | `src/agent-teams/canonical-agent-id.ts` |
| Runtime projection | `src/runtime/team-library-projection.ts` |
| OpenCode agent projection / model 字段写入 | `src/adapters/opencode/projection.ts` |
| OpenCode bootstrap / 默认 Agent | `src/adapters/opencode/bootstrap.ts` |
| OpenCode config hook | `src/adapters/opencode/config-hook.ts` |
| OpenCode config merge | `src/adapters/opencode/config-merge.ts` |
| packaged `crewbee.json` | `templates/crewbee.json` |
| 模板 Team | `templates/teams/*` |
| 自定义 Team 指南 | `docs/guide/custom-agent-team.md` |
| 项目级 Team 配置指南 | `docs/guide/project-team-config.md` |
