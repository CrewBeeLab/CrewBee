# CrewBee 项目级 Team 配置方案

## 1. 设计结论

P0 目标是让 CrewBee 同时支持 **全局 Team** 和 **项目 Team**，并让项目 Team 在当前项目中天然优先于全局 Team。

新的配置方案不引入第二套项目 Team 机制：

> **项目 Team 和全局 Team 在框架层都是同一种 Team 注册项。**

它们的差异只体现在配置来源与 source 语义：

| 维度 | 全局 Team | 项目 Team |
| --- | --- | --- |
| 配置文件位置 | OpenCode config root 下的 `crewbee.json` | 项目工作空间下的 `.crewbee/crewbee.json` |
| 路径解析基准 | OpenCode config root | 项目 `.crewbee` 目录 |
| scope 语义 | `global` | `project` |
| source 优先级 | 低于 project | 高于 global |
| `teams` schema | 相同 | 相同 |
| Team 文件结构 | 相同 | 相同 |
| 装配逻辑 | 相同 | 相同 |
| 装配时机 | 相同 | 相同 |

核心原则：

> **CrewBee 在 OpenCode bootstrap / config 阶段统一收集所有 `crewbee.json`，把其中的 `teams` 配置项统一归一化为 Team Registration，再进入同一套 Team 发现、解析、校验、装配、投影、默认 Agent 选择流程。项目配置不是新流程，只是更高优先级的配置来源。**

---

## 2. 与当前模板配置方案的关系

当前已存在随包发布的模板配置机制：

```text
templates/
  crewbee.json
  teams/
    general-team/
    template-team/
    wukong-team/
```

安装时，包内模板会被安装到 OpenCode config root：

```text
<OpenCodeConfigRoot>/
  crewbee.json
  teams/
    general-team/
    template-team/
    wukong-team/
```

本方案在这个机制之上迭代：

1. 全局配置继续使用安装后的 `<OpenCodeConfigRoot>/crewbee.json`。
2. 项目配置新增 `<worktree>/.crewbee/crewbee.json`。
3. 两者使用完全相同的 `teams` schema。
4. `@teams/...` 的语义统一为：去掉 `@` 后，相对于当前 `crewbee.json` 所在目录。

因此：

```text
global  @teams/general-team
  -> <OpenCodeConfigRoot>/teams/general-team

project @teams/project-coding-team
  -> <worktree>/.crewbee/teams/project-coding-team
```

项目级 Team 不需要新的目录结构、模板格式、loader、validator、projection 或 prompt builder。

---

## 3. 配置文件位置

### 3.1 全局配置

全局配置位于 OpenCode 配置目录：

```text
~/.config/opencode/crewbee.json
```

Windows 通常是：

```text
C:\Users\<你的用户名>\.config\opencode\crewbee.json
```

示例：

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/general-team", "enabled": false, "priority": 1 }
  ]
}
```

### 3.2 项目配置

项目配置位于当前 OpenCode 工作项目的 `.crewbee` 目录：

```text
<project-worktree>/.crewbee/crewbee.json
```

示例：

```json
{
  "teams": [
    { "path": "@teams/project-coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/project-research-team", "enabled": true, "priority": 1 }
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
        project-executor.agent.md
        project-reviewer.agent.md
        TEAM.md
```

---

## 4. Team 目录结构保持不变

无论是全局 Team 还是项目 Team，一支文件型 Team 仍然是一个目录。

当前实现只读取 Team 目录根部文件：

```text
ProjectCodingTeam/
  team.manifest.yaml
  team.policy.yaml
  project-leader.agent.md
  project-executor.agent.md
  project-reviewer.agent.md
  TEAM.md
```

必需文件：

```text
team.manifest.yaml
team.policy.yaml
至少一个 *.agent.md
```

可选文件：

```text
TEAM.md
README.md
```

约束不变：

> `*.agent.md` 必须和 `team.manifest.yaml`、`team.policy.yaml` 放在同一层目录。P0 不扫描 `agents/`、`docs/` 等子目录中的 Agent 文件。

---

## 5. `crewbee.json` Schema 保持同构

全局 `crewbee.json` 和项目 `.crewbee/crewbee.json` 使用相同 schema。

### 5.1 最小结构

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/ResearchOpsTeam", "enabled": true, "priority": 1 }
  ]
}
```

### 5.2 Team entry 字段

| 字段 | 必需 | 说明 |
| --- | ---: | --- |
| `id` | 与 `path` 二选一 | 加载内置 Team |
| `path` | 与 `id` 二选一 | 加载文件型 Team，指向 Team 目录 |
| `enabled` | 否 | 是否启用，默认 `true` |
| `priority` | 否 | 同一配置来源内的排序值，数字越小优先级越高 |

约束：

```text
同一个 entry 只能写 id 或 path，不能同时写。
```

P0 不新增 `scope`、`source`、`extends`、`include` 等配置字段。`scope` 是框架根据配置文件来源派生出来的运行时语义，不由用户在 `crewbee.json` 中手写。

---

## 6. 路径解析规则保持一致

`path` 的规则不变，但基准目录必须变为“当前 `crewbee.json` 所在目录”。

### 6.1 全局配置里的路径

配置文件：

```text
~/.config/opencode/crewbee.json
```

配置：

```json
{ "path": "@teams/ResearchOpsTeam" }
```

实际解析为：

```text
~/.config/opencode/teams/ResearchOpsTeam
```

### 6.2 项目配置里的路径

配置文件：

```text
<project-worktree>/.crewbee/crewbee.json
```

配置：

```json
{ "path": "@teams/ProjectCodingTeam" }
```

实际解析为：

```text
<project-worktree>/.crewbee/teams/ProjectCodingTeam
```

### 6.3 支持的路径形式

```json
{ "path": "@teams/ProjectCodingTeam" }
{ "path": "teams/ProjectCodingTeam" }
{ "path": "~/CrewBeeTeams/ProjectCodingTeam" }
{ "path": "E:/CrewBeeTeams/ProjectCodingTeam" }
```

| 写法 | 含义 |
| --- | --- |
| `@teams/xxx` | 去掉 `@` 后，相对于当前 `crewbee.json` 所在目录 |
| `teams/xxx` | 相对于当前 `crewbee.json` 所在目录 |
| `~/xxx` | 相对于用户 home 目录 |
| 绝对路径 | 按原样使用 |

---

## 7. 统一装配流程

实现上不要拆成两套流程：

```text
加载全局 Team
加载项目 Team
合并两套 TeamLibrary
```

应统一为：

```text
收集配置来源
  -> 归一化为 Team Registration
  -> 统一发现 Team 目录 / 内置 Team
  -> 统一解析 Team Package
  -> 统一校验
  -> 统一冲突处理
  -> 统一生成 Effective TeamLibrary
  -> 统一 Runtime Projection
  -> 统一 OpenCode Config Patch
```

推荐概念模型：

```text
crewbee.json
  -> Team Registration Source
  -> Team Registration
  -> Team Package
  -> Effective TeamLibrary
  -> Projected Teams / Projected Agents
  -> OpenCode Agents
```

全局配置和项目配置只是产生不同 `scope`、`baseDir`、`precedence` 的 Team Registration Source。

---

## 8. Source 语义

每个 `crewbee.json` 都会被视为一个配置来源。

### 8.1 全局 source

```text
source scope: global
source baseDir: OpenCode config root
source configPath: <OpenCodeConfigRoot>/crewbee.json
source precedence: lower than project
```

### 8.2 项目 source

```text
source scope: project
source baseDir: <project-worktree>/.crewbee
source configPath: <project-worktree>/.crewbee/crewbee.json
source precedence: higher than global
```

### 8.3 scope 的作用

`scope` 只用于：

- 路径解析诊断
- 冲突处理
- 默认 Agent 选择
- doctor / debug 输出
- 运行时状态展示

`scope` 不应该引入新的 Team 解析逻辑、Agent 解析逻辑、Prompt 生成逻辑或 OpenCode projection 逻辑。

---

## 9. 优先级规则

当前已有 `priority` 语义保持不变：

```text
数字越小，优先级越高。
```

新方案只增加 source 维度。

### 9.1 同一 source 内

同一个 `crewbee.json` 中：

```json
{
  "teams": [
    { "path": "@teams/A", "priority": 0 },
    { "path": "@teams/B", "priority": 1 }
  ]
}
```

`A` 优先于 `B`。

### 9.2 跨 source 时

跨 source 时，先比较 source precedence，再比较 entry priority。

排序规则：

```text
1. project source > global source
2. 同一 source 内，priority 数字越小越高
3. 同一 source 且 priority 相同，按配置文件中的声明顺序
4. 最后按稳定 id 排序兜底
```

因此：

```text
project priority 1
global priority 0
```

最终仍然是：

```text
project Team 优先
```

原因是项目 Team 对当前项目具有更高 source precedence。

---

## 10. 默认 Agent 选择规则

默认 Agent 的选择不做项目专属逻辑，而是在 Effective TeamLibrary 中统一计算。

### 10.1 默认 Team 候选排序

默认 Team 候选排序：

```text
1. project source 的 enabled Team
2. global source 的 enabled Team
3. 同一 source 内按 priority 从小到大
4. 同一 priority 按配置声明顺序
5. 最后按稳定 id 排序兜底
```

### 10.2 默认 Agent 选择

选出默认 Team 后：

```text
1. 优先使用该 Team 的 formal leader
2. 如果 formal leader 不可作为 OpenCode 入口，则使用该 Team 的 projected default agent
3. 如果仍不可用，则使用该 Team 第一个 user-selectable Agent
4. 如果该 Team 没有可用入口，则跳过，尝试下一个 Team
```

### 10.3 用户手动选择不被覆盖

项目默认 Agent 只影响：

```text
OpenCode 实例初始化时的默认 Agent
新 session 的默认入口
```

如果用户在 OpenCode 中手动切换 Agent，CrewBee 不应该在后续 `chat.message` 阶段强行切回项目默认 Agent。

---

## 11. Team ID 冲突规则

冲突处理统一基于 source precedence、entry priority 和声明顺序。

### 11.1 同一个 Team ID 同时出现在 global 和 project

例如：

```text
global crewbee.json:
  coding-team

project .crewbee/crewbee.json:
  coding-team
```

结果：

```text
project scope 的 coding-team 获胜
```

OpenCode 中只投影一个有效 `coding-team`。

诊断信息应说明：

```text
project team "coding-team" shadows global team "coding-team"
```

### 11.2 同一 source 内出现相同 Team ID

例如同一个项目配置里：

```json
{
  "teams": [
    { "path": "@teams/A", "priority": 0 },
    { "path": "@teams/B", "priority": 1 }
  ]
}
```

但 `A` 和 `B` 的 `team.manifest.yaml` 里 `id` 相同。

结果：

```text
priority 更小的 entry 获胜
失败者被跳过
输出 warning
```

如果 priority 也相同，则按配置声明顺序，第一个获胜。

### 11.3 projected agent id 冲突

Team ID 冲突应在 TeamLibrary 层先解决。只有进入 Effective TeamLibrary 的 Team 才参与 Runtime Projection。

如果两个不同 Team 仍产生相同 canonical agent id，继续复用现有 canonical id normalization / validation 机制处理，不为 project source 单独实现一套冲突规则。

---

## 12. 内置 Team 的处理

当前配置支持：

```json
{ "id": "coding-team", "enabled": true, "priority": 0 }
```

新方案保持该能力。

### 12.1 全局配置引用内置 Team

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 }
  ]
}
```

表示全局启用内置 Coding Team。

### 12.2 项目配置引用内置 Team

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 }
  ]
}
```

表示当前项目把内置 Coding Team 作为项目级注册项使用。

这不复制 Team 定义，也不创建项目专属装配逻辑。

它只是：

```text
同一份内置 Team 定义
以 project source 的身份进入统一装配流程
```

因此它会优先于全局 Team 成为当前项目默认候选。

---

## 13. 推荐目录布局

### 13.1 全局 Team

```text
~/.config/opencode/
  crewbee.json
  teams/
    ResearchOpsTeam/
      team.manifest.yaml
      team.policy.yaml
      researchops-leader.agent.md
      evidence-researcher.agent.md
      report-writer.agent.md
      TEAM.md
```

全局配置：

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/ResearchOpsTeam", "enabled": true, "priority": 1 }
  ]
}
```

### 13.2 项目 Team

```text
MyProject/
  .crewbee/
    crewbee.json
    teams/
      ProjectCodingTeam/
        team.manifest.yaml
        team.policy.yaml
        project-leader.agent.md
        project-executor.agent.md
        project-reviewer.agent.md
        TEAM.md
```

项目配置：

```json
{
  "teams": [
    { "path": "@teams/ProjectCodingTeam", "enabled": true, "priority": 0 }
  ]
}
```

### 13.3 同时使用全局和项目 Team

最终 effective Team 集合：

```text
project:
  ProjectCodingTeam

global:
  coding-team
  ResearchOpsTeam
```

默认 Agent：

```text
ProjectCodingTeam 的 formal leader
```

---

## 14. OpenCode 插件生命周期

### 14.1 装配时机

项目 Team 必须在 OpenCode config / bootstrap 阶段参与装配。

正确时机：

```text
OpenCode plugin config/bootstrap
  -> 读取 ctx.worktree
  -> 收集 global crewbee.json
  -> 收集 project .crewbee/crewbee.json
  -> 统一装配 Effective TeamLibrary
  -> 统一生成 OpenCode agent config
```

不要在 `chat.message` 阶段才补项目 Team。

原因：

- OpenCode agent 列表需要提前生成
- 默认 Agent 需要提前确定
- alias / projected id / delegation binding 需要统一生成
- session binding 需要基于同一个 projection 结果

### 14.2 `ctx.worktree` 的职责

`ctx.worktree` 只负责定位项目配置：

```text
<ctx.worktree>/.crewbee/crewbee.json
```

之后项目配置产生的 Team Registration 就和全局配置产生的 Team Registration 一样处理。

不要让 `ctx.worktree` 渗透到 Team 解析、Prompt 生成、OpenCode projection 等后续流程中。

### 14.3 缓存策略

因为 Effective TeamLibrary 与项目有关，所以不能使用单一全局缓存。

推荐缓存维度：

```text
OpenCode config root + worktree
```

P0 可以不做热更新。

当用户修改：

```text
.crewbee/crewbee.json
team.manifest.yaml
team.policy.yaml
*.agent.md
```

需要重启 OpenCode 或重新启动 OpenCode server。

---

## 15. 错误处理与降级

### 15.1 项目配置不存在

行为：

```text
只加载全局 crewbee.json
保持现有行为
```

### 15.2 项目配置 JSON 格式错误

行为：

```text
跳过项目配置
输出 warning
继续使用全局 Team
OpenCode 不应启动失败
```

项目配置错误不应触发全局 `crewbee.json` 自修复，也不应在项目目录自动创建默认配置。

### 15.3 项目 Team 路径不存在

行为：

```text
跳过该 Team entry
输出 warning
继续处理其它 entry
```

### 15.4 项目 Team 校验失败

例如：

- 缺少 `team.manifest.yaml`
- 缺少 `team.policy.yaml`
- 没有任何 `*.agent.md`
- leader 引用不存在

行为：

```text
跳过该 Team
输出 validation warning
继续处理其它 Team
```

### 15.5 所有项目 Team 都失败

行为：

```text
回退到全局 Team
OpenCode 仍可用
```

### 15.6 全局配置缺失或损坏

全局配置继续沿用当前安装 / 启动自修复策略：

```text
缺失或无效时，用包内 templates/crewbee.json 生成 / 修复 <OpenCodeConfigRoot>/crewbee.json
必要时同步 templates/teams 到 <OpenCodeConfigRoot>/teams
```

项目配置不自动创建，避免 CrewBee 在用户项目中产生隐藏文件副作用。

---

## 16. 诊断输出

为了让用户知道当前项目到底加载了哪些 Team，建议 doctor / debug 输出 effective config。

示例：

```text
CrewBee Effective Team Configuration

OpenCode config root:
  ~/.config/opencode

Worktree:
  /Users/yong/work/MyProject

Global config:
  ~/.config/opencode/crewbee.json

Project config:
  /Users/yong/work/MyProject/.crewbee/crewbee.json

Loaded sources:
  [project] /Users/yong/work/MyProject/.crewbee/crewbee.json
  [global]  ~/.config/opencode/crewbee.json

Effective teams:
  1. [project] project-coding-team priority=0
  2. [global]  coding-team priority=0
  3. [global]  researchops-team priority=1

Default agent:
  [project-coding-team] project-leader

Warnings:
  none
```

如果发生 shadow：

```text
Warnings:
  project team "coding-team" shadows global team "coding-team"
```

---

## 17. Doctor 能力建议

现有 doctor 可以继续检查全局安装。

新增项目检查模式：

```text
crewbee doctor --project .
```

输出重点：

```text
1. 当前识别到的 worktree
2. 是否存在 .crewbee/crewbee.json
3. 项目配置 JSON 是否有效
4. 项目 Team path 是否存在
5. 项目 Team package 是否有效
6. 项目 Team 是否成功进入 Effective TeamLibrary
7. 当前默认 Agent 是谁
8. 是否发生 shadow / collision / fallback
```

这用于排查：

```text
为什么项目 Team 没有出现？
为什么默认 Agent 还是全局 Team？
为什么某个 Team 被跳过？
为什么 OpenCode 里看到的 Agent 名称冲突？
```

---

## 18. 示例场景

### 18.1 只有全局配置

```text
~/.config/opencode/crewbee.json
```

项目没有：

```text
<project>/.crewbee/crewbee.json
```

结果：

```text
只加载全局 Team
默认 Agent 使用全局最高优先级 Team 的 leader
```

### 18.2 项目配置存在一个项目 Team

项目配置：

```json
{
  "teams": [
    { "path": "@teams/ProjectCodingTeam", "enabled": true, "priority": 0 }
  ]
}
```

结果：

```text
全局 Team 仍然可用
ProjectCodingTeam 优先于全局 Team
默认 Agent 是 ProjectCodingTeam 的 formal leader
```

### 18.3 项目配置显式使用内置 Coding Team

项目配置：

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 }
  ]
}
```

结果：

```text
使用内置 coding-team
但该注册项属于 project source
因此优先于 global source 中的 coding-team
默认 Agent 是 coding-team 的 formal leader
```

### 18.4 项目 Team 覆盖全局同名 Team

全局：

```json
{
  "teams": [
    { "path": "@teams/CodingTeam", "enabled": true, "priority": 0 }
  ]
}
```

项目：

```json
{
  "teams": [
    { "path": "@teams/CodingTeam", "enabled": true, "priority": 0 }
  ]
}
```

如果两个 Team 的 manifest id 都是：

```text
coding-team
```

结果：

```text
项目 coding-team 生效
全局 coding-team 被 shadow
OpenCode 中只出现一个 coding-team
```

---

## 19. 兼容性要求

### 19.1 旧全局配置继续有效

已有：

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/ResearchOpsTeam", "enabled": true, "priority": 1 }
  ]
}
```

不需要修改。

没有项目 `.crewbee/crewbee.json` 时，行为与当前版本一致。

### 19.2 Team 文件结构不变

仍然是：

```text
TeamDir/
  team.manifest.yaml
  team.policy.yaml
  *.agent.md
  TEAM.md
```

P0 不引入：

```text
agents/
docs/
routing-map.yaml
handoff.contract.yaml
```

### 19.3 priority 语义不变

`priority` 仍然是：

```text
数字越小，优先级越高
```

只是新增 source precedence：

```text
project source 先于 global source
```

---

## 20. 实现顺序建议

按最小闭环实现：

```text
1. 保持现有 crewbee.json teams schema 不变
2. 在 OpenCode bootstrap / config 阶段读取 ctx.worktree
3. 增加项目配置候选路径：<worktree>/.crewbee/crewbee.json
4. 将 global crewbee.json 和 project crewbee.json 都解析为统一 Team Registration
5. 每个 Registration 附加 source scope、source baseDir、source precedence、配置声明顺序
6. 使用同一个 Team package loader 加载 id / path 对应的 Team
7. 使用同一个 validator 校验 Team
8. 按 source precedence + priority + 声明顺序做冲突处理
9. 生成 Effective TeamLibrary
10. 复用现有 Runtime Projection
11. 复用现有 OpenCode Config Patch
12. 默认 Agent resolver 改为基于 Effective Team 排序选择
13. 增加 diagnostics / doctor 输出
```

关键原则：

```text
不新增 project-only loader
不新增 project-only projection
不新增 project-only prompt builder
不新增 project-only OpenCode patch
```

---

## 21. 建议的内部类型边界

以下是设计边界，不要求暴露给用户。

```text
TeamConfigSource
  scope: global | project
  configPath
  baseDir
  precedence

TeamRegistration
  source
  raw entry: { id | path, enabled, priority }
  order
  resolvedTeamDir?      # path entry
  embeddedTeamId?       # id entry

LoadedTeamCandidate
  registration
  team?
  issues[]

EffectiveTeamLibrary
  teams[]               # 已按 source precedence / priority / order 冲突处理后输出
  loadIssues[]
  sources[]             # 供 diagnostics / doctor 展示
```

这些类型的目标是让 global / project 共享同一个 pipeline，而不是在外层合并两个已经装配好的 TeamLibrary。

---

## 22. 验收标准

### 22.1 配置兼容

- 旧全局 `crewbee.json` 不改也能继续工作
- 没有项目配置时，行为不变
- 项目配置使用同样的 `teams` schema

### 22.2 装配一致

- 全局 Team 和项目 Team 走同一个 parser
- 全局 Team 和项目 Team 走同一个 validator
- 全局 Team 和项目 Team 进入同一个 Effective TeamLibrary
- 全局 Team 和项目 Team 走同一个 Runtime Projection
- 全局 Team 和项目 Team 走同一个 OpenCode Config Patch

### 22.3 优先级正确

- 项目 Team 优先于全局 Team
- 同一 source 内 `priority` 数字越小越优先
- 项目 Team 与全局 Team 同名时，项目 Team shadow 全局 Team
- 项目最高优先级 Team 的 formal leader 成为默认 Agent

### 22.4 降级可靠

- 项目配置不存在时不报错
- 项目配置错误时回退全局 Team
- 项目 Team 校验失败时跳过该 Team
- OpenCode 不因项目 Team 问题不可用

### 22.5 用户体验清晰

- 用户只需要学一套 `crewbee.json`
- 项目 Team 的目录结构和全局 Team 完全一致
- doctor 能明确显示 effective Team 顺序和默认 Agent

---

## 23. P0 非目标

P0 不做以下事情：

- 项目 `.crewbee/crewbee.json` 自动创建
- 项目 `.crewbee/teams` 自动同步包内模板
- 配置热更新
- 多层 workspace 向上查找 `.crewbee`
- Team 配置继承 / include / extends
- project-only Team loader / validator / projection
- 子目录 Agent 扫描

这些能力可以后续迭代，但不应进入 P0，以避免引入不必要复杂度。

---

## 24. 最终定位

这个方案的本质是：

> **把项目级 Team 支持实现为同构 `crewbee.json` 的第二个配置来源，而不是实现为另一套项目专属 Team 系统。**

最终效果：

```text
global crewbee.json
project .crewbee/crewbee.json
        ↓
统一 Team Registration
        ↓
统一 Team 装配
        ↓
统一 Runtime Projection
        ↓
统一 OpenCode Agent 注入
```

项目 Team 只是：

```text
路径来源不同
scope 语义不同
source 优先级更高
```

除此之外，它与全局 Team 完全一样。
