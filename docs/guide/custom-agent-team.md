# 自定义设计一套 Agent Team（最佳实践）

## 1. 这份文档是给谁的

这份文档面向两类人：

1. **想在 CrewBee 里新增一支 Team 的设计者**
2. **想把自己团队的工作方式固化成 Agent Team 的使用者**

目标不是讲抽象概念，而是：

> **告诉你如何基于当前仓库的真实实现，一步一步设计并落地一套可运行的 Agent Team。**

---

## 2. 先理解当前实现里的“一个 Team 到底是什么”

在当前 CrewBee 里，一套 Team 本质上就是一个目录，里面放四类东西：

```text
AgentTeams/<YourTeam>/
  team.manifest.yaml
  team.policy.yaml
  TEAM.md
  <agent-1>.agent.md
  <agent-2>.agent.md
  <agent-3>.agent.md
```

说明：

- `team.manifest.yaml`：定义这支 Team 是谁、Leader 是谁、成员有哪些、默认工作流是什么
- `team.policy.yaml`：定义这支 Team 的共享规则、安全边界、质量底线
- `TEAM.md`：写给人看的 Team 说明文档
- `*.agent.md`：每个 Agent 的定义文件

> 当前实现里，`*.agent.md` 和 `TEAM.md` 必须和 `team.manifest.yaml`、`team.policy.yaml` 放在同一目录，不再使用 `agents/` 或 `docs/` 子目录。

---

## 3. 设计一支 Team 时，先回答这 5 个问题

在写任何文件前，先把下面 5 个问题回答清楚。

### 3.1 这支 Team 解决什么类型的问题？

例如：

- 软件开发与修复
- 文档写作与调研
- 产品方案分析
- 复杂事务推进
- 项目管理与协调

这一点决定：

- Team 的 `mission`
- Team 的 `scope`
- Agent 的职责分工

### 3.2 谁是 formal leader？

CrewBee 当前设计里，每支 Team 都必须有一个 **formal leader**。

它意味着：

- 这是 Team 的默认入口
- 这是默认的收口责任人
- 这是用户最自然会选择的 Agent

所以不要把 leader 设计成一个“看起来高级，但平时没人该用”的角色。

### 3.3 团队里需要哪些成员？

建议从“最小可用集合”开始，而不是一上来设计很多角色。

通常一个 Team 最少只需要：

- 1 个 leader
- 1~3 个专项支持成员

例如：

#### Coding Team 最小集合
- `leader`
- `executor`
- `reviewer`

#### General Team 最小集合
- `leader`
- `researcher`
- `writer`

### 3.4 这支 Team 的共享规则是什么？

共享规则放在 `team.policy.yaml`，不是分散写进每个 Agent。

比如：

- 指令优先级
- 哪些事必须确认
- 哪些行为禁止
- 最低质量底线
- 团队共通工作规则

### 3.5 Agent Prompt 里最重要的决策菜单是什么？

当前实现里，Agent 最好不要把关键行为都塞进一个大块策略字段。

而应在 Agent Profile 层直接定义高价值 section，例如：

- `core_principle`
- `scope_control`
- `ambiguity_policy`
- `support_triggers`
- `task_triage`
- `delegation_review`
- `completion_gate`
- `failure_recovery`

这些 section 本身就是模型的“决策菜单”。

---

## 4. 最佳实践总原则

在当前项目里，自定义 Team 时建议遵循以下原则。

### 4.1 先做一支小 Team，再扩展

不要一开始设计 10 个 Agent。

先做：

- 1 个 leader
- 2~4 个 support agents

跑通之后，再逐步扩展。

### 4.2 Team 先清晰，再求花哨

优先保证：

- 谁是 leader
- 各成员职责边界
- 默认 workflow
- Team policy

而不是先写大量风格化 prompt 文本。

### 4.3 Agent 的差异主要由 Profile 体现

不要依赖框架去“猜”这个 Agent 更像 planner 还是 reviewer。

要在 Agent Profile 里直接定义：

- 它是谁
- 它负责什么
- 它默认如何行动
- 它如何协作

### 4.4 Prompt Projection 只做“裁剪”，不要当成主设计工具

`prompt_projection` 的作用是：

- 控制哪些 section 进入 prompt
- 调整显示 label

它不应该替代 Team / Agent 本身的定义设计。

### 4.5 Collaboration 要面向“可委派”来写

在当前实现中，Collaboration 会结合 Team Manifest 的成员信息，生成：

- `Id`
- `Description`
- `When To Delegate`

所以 Team Manifest 中 `members` 的：

- `responsibility`
- `delegate_when`
- `delegate_mode`

必须写清楚。

---

## 5. 第一步：创建 Team 目录

假设你要创建一支新 Team：`ResearchOpsTeam`

目录结构如下：

```text
AgentTeams/
  ResearchOpsTeam/
    team.manifest.yaml
    team.policy.yaml
    TEAM.md
    researchops-leader.agent.md
    evidence-researcher.agent.md
    report-writer.agent.md
```

建议：

- Team 目录名使用 `PascalCase` 或稳定名称
- Agent 文件名使用 `kebab-case.agent.md`
- YAML/frontmatter 字段全部使用 `snake_case`

---

## 6. 第二步：先写 `team.manifest.yaml`

`team.manifest.yaml` 负责定义 Team 的工程主入口。

### 6.0 字段含义说明（给第一次写的人）

如果你第一次接触这些英文字段，可以直接按下面理解。

#### 顶层字段说明

| 字段 | 中文意思 | 实际作用 | 怎么写 |
| --- | --- | --- | --- |
| `id` | Team 唯一标识 | 给系统识别这支 Team 用 | 稳定、简短、不要经常改，例如 `researchops-team` |
| `version` | 定义版本 | 标识这份 Team 定义的版本 | 初期直接写 `1.0.0` 即可 |
| `name` | 展示名称 | 给人看、给宿主显示 | 写可读名称，如 `ResearchOpsTeam` |
| `description` | 一句话简介 | 说明这支 Team 是干什么的 | 用一句话说清用途 |
| `mission` | 团队目标 | 说明这支 Team 总体想完成什么 | 写目标和成功标准 |
| `scope` | 团队边界 | 说明能做什么、不能做什么 | 分成 `in_scope` / `out_of_scope` |
| `leader` | formal leader | 指定默认入口 Agent 和主要收口者 | 必填 |
| `members` | 成员清单 | 说明团队里有哪些角色、各自职责与适用时机 | 当前实现里非常重要 |
| `workflow` | 默认工作流 | 说明这支 Team 常见的推进节奏 | 用阶段列表表达 |
| `governance` | 治理信息 | 定义团队级静态治理信息 | 可先按模板写 |
| `tags` | 标签 | 给 Team 打标签 | 可选，2~5 个即可 |

#### `mission` 字段说明

| 字段 | 中文意思 | 怎么写 |
| --- | --- | --- |
| `objective` | 团队总目标 | 用一句话写这支 Team 想达成什么 |
| `success_definition` | 团队成功标准 | 写成列表，描述“什么算做好了” |

#### `scope` 字段说明

| 字段 | 中文意思 | 怎么写 |
| --- | --- | --- |
| `in_scope` | 属于范围内的任务 | 列出这支 Team 应该处理的任务类型 |
| `out_of_scope` | 不属于范围内的任务 | 列出不应该交给这支 Team 的任务 |

#### `leader` 字段说明

| 字段 | 中文意思 | 怎么写 |
| --- | --- | --- |
| `agent_ref` | leader 对应的 Agent id | 必须和某个 `*.agent.md` 的 `id` 一致 |
| `responsibilities` | leader 的职责列表 | 用 3~5 条写清 leader 的责任 |

#### `members` 字段说明

`members` 是一个“以 agent id 为 key 的 map”，例如：

```yaml
members:
  evidence-researcher:
    responsibility: 定位资料、提取证据
    delegate_when: 需要事实核对时
    delegate_mode: 只读研究委派
```

字段解释：

| 字段 | 中文意思 | 实际作用 | 怎么写 |
| --- | --- | --- | --- |
| `responsibility` | 这个成员在 Team 里的职责 | 当前会进入 Collaboration prompt | 一句话写它主要干什么 |
| `delegate_when` | 什么时候应该委派给它 | 当前会进入 Collaboration prompt | 写成“什么情况下找它” |
| `delegate_mode` | 应该怎样委派给它 | 帮助保持协作方式稳定 | 写“只读研究委派 / 叶子实现委派 / 成稿委派”这类说明 |

#### `workflow` 字段说明

| 字段 | 中文意思 | 怎么写 |
| --- | --- | --- |
| `stages` | 工作流阶段列表 | 用简单列表写出团队常见推进顺序 |

#### `governance` 字段说明

| 字段 | 中文意思 | 怎么写 |
| --- | --- | --- |
| `instruction_precedence` | 指令优先级 | 冲突时先听谁的，一般保持固定顺序 |
| `approval_policy` | 审批规则 | 写哪些事必须确认、哪些低风险小事可自主决定 |
| `forbidden_actions` | 禁止行为 | 写绝对不能做的事 |
| `quality_floor` | 最低质量底线 | 写这支 Team 至少要满足什么验证要求 |
| `working_rules` | 团队共通工作规则 | 写 Team 共通规则，不写个体特例 |

### 6.0A 内容如何编写

如果你担心“字段会写，但不知道内容该怎么写”，可以用下面这个简单标准：

- `description` / `objective`：一句话说清用途
- `responsibility`：一句话说清这个角色主要干什么
- `delegate_when`：一句话说清什么时候找它
- `delegate_mode`：一句话说清怎么委派它
- `success_definition`：写成可以判断的结果条件，不要写空话

### 6.1 最小模板

```yaml
id: researchops-team
version: 1.0.0
name: ResearchOpsTeam
description: 面向调研、证据整理、方案输出与事务推进的团队

mission:
  objective: 以清晰、可验证、可执行的方式完成调研与方案交付
  success_definition:
    - 最终结论清晰
    - 关键证据充分
    - 输出可直接使用

scope:
  in_scope:
    - research
    - analysis
    - writing
    - ops-style coordination
  out_of_scope:
    - large-scale coding implementation

leader:
  agent_ref: researchops-leader
  responsibilities:
    - 接收用户任务
    - 判断研究路径与交付形态
    - 决定咨询、委派或自执行
    - 负责最终汇报与收口

members:
  researchops-leader:
    responsibility: 默认主执行 owner；负责研究路径、收束结论与最终交付。
    delegate_when: 绝大多数调研、分析、报告型任务。
    delegate_mode: 自己持有主链路，只把专项工作分给 support agents。

  evidence-researcher:
    responsibility: 定位资料、收集证据、提取关键信息。
    delegate_when: 需要外部资料检索、文档查证、事实核对时。
    delegate_mode: 只读研究委派，要求返回结论、证据、链接与边界。

  report-writer:
    responsibility: 将已有结论整理成结构化文稿。
    delegate_when: 需要把已收敛结论整理成清晰交付物时。
    delegate_mode: 成稿委派，要求对齐结构、语气与输出格式。

workflow:
  stages:
    - 接单
    - 澄清问题
    - 证据收集
    - 分析与收束
    - 输出草稿
    - 检查与总结

governance:
  instruction_precedence:
    - platform rules
    - repository rules
    - team rules
    - agent rules
    - task rules
  approval_policy:
    required_for:
      - destructive actions
      - external side effects
      - commit
    allow_assume_for:
      - low-risk local decisions
  forbidden_actions:
    - fabricate evidence
    - claim done without verification
  quality_floor:
    required_checks:
      - evidence
      - consistency
    evidence_required: true
  working_rules:
    - leader is the primary interface
    - support agents report back to the active owner

tags:
  - research
  - analysis
  - writing
```

### 6.2 书写建议

#### `leader.agent_ref`
必须对应一个真实存在的 `*.agent.md` 文件 id。

#### `members`
是当前实现里的重点字段，不只是展示用。

它会影响：

- Team 结构校验
- Team 的运行时描述
- Collaboration 最终 prompt 输出

所以每个成员的：

- `responsibility`
- `delegate_when`
- `delegate_mode`

都建议写得具体、可操作。

---

## 7. 第三步：写 `team.policy.yaml`

这个文件定义 Team 的共享规则，并直接决定 Team Contract 的生成内容。

### 7.0 字段含义说明（给第一次写的人）

| 字段 | 中文意思 | 实际作用 | 怎么写 |
| --- | --- | --- | --- |
| `kind` | 文档类型 | 当前固定为 `team-policy` | 直接照写 |
| `version` | policy 版本 | 标识这份规则文件版本 | 初期直接写 `1.0.0` |
| `instruction_precedence` | 指令优先级 | 冲突时先听谁的 | 一般固定写 `platform -> repository -> team -> agent -> task` |
| `approval_policy` | 审批规则 | 哪些事必须确认，哪些小事可自主判断 | 写 `required_for` 和 `allow_assume_for` |
| `forbidden_actions` | 禁止行为 | 红线列表 | 写绝对不能做的事情 |
| `quality_floor` | 最低质量要求 | 规定至少做到什么程度 | 例如证据、诊断、测试、构建 |
| `working_rules` | 团队共通工作规则 | 描述 Team 统一工作方式 | 写 Team 共通规则 |
| `prompt_projection` | Team Contract 暴露范围 | 控制最终 Team prompt 显示什么 | 当前一般固定写 `working_rules` 和 `approval_safety` |

#### `approval_policy` 字段说明

| 字段 | 中文意思 | 怎么写 |
| --- | --- | --- |
| `required_for` | 哪些事必须确认 | 写高风险动作，例如 destructive actions / commit |
| `allow_assume_for` | 哪些事允许自主判断 | 只写低风险、局部、小范围决策 |

#### `quality_floor` 字段说明

| 字段 | 中文意思 | 怎么写 |
| --- | --- | --- |
| `required_checks` | 必需检查项 | 写 Team 最低验证要求，如 `tests`、`build`、`evidence` |
| `evidence_required` | 是否必须给证据 | `true` / `false` |

### 7.0A 内容如何编写

写 `team.policy.yaml` 时，用一句话概括就是：

> 写 Team 的共通底线，不写某个 Agent 的个人风格。

例如：

- 适合写这里：`fabricate evidence`
- 不适合写这里：`leader should be calm and philosophical`

### 7.1 最小模板

```yaml
kind: team-policy
version: 1.0.0

instruction_precedence:
  - platform rules
  - repository rules
  - team rules
  - agent rules
  - task rules

approval_policy:
  required_for:
    - destructive actions
    - external side effects
    - commit
  allow_assume_for:
    - low-risk local decisions

forbidden_actions:
  - fabricate evidence
  - claim done without verification
  - ignore hard constraints

quality_floor:
  required_checks:
    - evidence
    - consistency
  evidence_required: true

working_rules:
  - leader is the primary interface
  - support agents report back to the active owner
  - final user-facing summary comes from the role holding closure responsibility

prompt_projection:
  include:
    - working_rules
    - approval_safety
```

### 7.2 最佳实践

- Team 共享规则放这里，不要重复写到每个 Agent 文件
- 写“底线”和“共通规则”，不要写某个 Agent 的个体特例
- 当前 Team Prompt 会压缩为：
  - `Working Rules`
  - `Approval & Safety`

所以这里的内容最好本身就适合被模型直接理解

---

## 8. 第四步：先设计 Leader Agent

在当前 CrewBee 里，**先把 leader 设计好**，比先设计所有 support agents 更重要。

### 8.1 Leader 必须回答的 6 个问题

Leader Agent 至少要回答：

1. 我是谁
2. 我负责什么
3. 我默认怎么行动
4. 我什么时候委派 / 评审 / 提问 / 停下
5. 什么算完成
6. 失败时怎么恢复

### 8.1A Agent 文件里的字段是什么意思

下面是第一次写 Agent 文件时最容易卡住的字段说明。

#### Metadata

| 字段 | 中文意思 | 怎么写 |
| --- | --- | --- |
| `id` | Agent 唯一标识 | 稳定、简短、不要经常改 |
| `kind` | 文档类型 | 当前一般写 `agent` |
| `version` | Agent 定义版本 | 先写 `1.0.0` |
| `name` | 显示名称 | 给人看、给宿主显示 |

#### `persona_core`

它回答：

> 这个 Agent 是怎样的一种做事者？

| 字段 | 中文意思 | 怎么写 |
| --- | --- | --- |
| `temperament` | 气质 | 如“稳健、务实、强推进” |
| `cognitive_style` | 思考方式 | 如“先探索再收束”“先证据后结论” |
| `risk_posture` | 风险姿态 | 如“evidence-first”“controlled” |
| `communication_style` | 沟通风格 | 如“简洁直接”“结构化” |
| `persistence_style` | 推进风格 | 写遇阻时的默认推进方式 |
| `decision_priorities` | 默认价值排序 | 用列表写优先保护什么 |

#### `responsibility_core`

它回答：

> 这个 Agent 负责什么，不负责什么？

| 字段 | 中文意思 | 怎么写 |
| --- | --- | --- |
| `description` | 一句话职责描述 | 最重要的一句，直接说它是干什么的 |
| `use_when` | 什么时候应该调用它 | 写适用场景 |
| `avoid_when` | 什么时候不该调用它 | 写不适用场景 |
| `objective` | 主要目标 | 一句话写它的核心目标 |
| `success_definition` | 成功标准 | 写成可判断的条件列表 |
| `non_goals` | 不负责什么 | 明确非目标 |
| `in_scope` | 职责范围内事项 | 列出它主要负责的事项 |
| `out_of_scope` | 职责范围外事项 | 列出它不负责的事项 |

#### 一等执行语义 section

这些字段是 prompt 里的核心“决策菜单”：

| 字段 | 中文意思 | 它回答的问题 |
| --- | --- | --- |
| `core_principle` | 核心原则 | 默认怎么行动 |
| `scope_control` | 范围控制 | 什么能做、什么不能顺手做 |
| `ambiguity_policy` | 歧义处理 | 遇到不清楚的事怎么办 |
| `support_triggers` | 支援触发条件 | 什么时候该找别的 Agent |
| `task_triage` | 任务分流 | 不同类型任务怎么处理 |
| `delegation_review` | 委派与评审 | 什么时候委派 / 什么时候评审 |
| `completion_gate` | 完成闸门 | 什么算完成 |
| `failure_recovery` | 失败恢复 | 做不通时怎么办 |

#### `collaboration`

它回答：

> 这个 Agent 默认跟谁协作？

当前最常用写法：

```yaml
collaboration:
  default_consults:
    - evidence-researcher
  default_handoffs:
    - report-writer
```

说明：

- 这里只要写目标 agent 的 `id`
- 不需要手写长描述
- 当前实现会结合 Team Manifest 自动补出最终 Collaboration 清单

#### `runtime_config`

它回答：

> 这个 Agent 运行时需要哪些工具和权限？

| 字段 | 中文意思 | 怎么写 |
| --- | --- | --- |
| `requested_tools` | 希望宿主暴露的工具 | 如 `read`、`glob`、`grep` |
| `permission` | 工具权限规则 | 写 `allow / deny / ask` 规则 |

#### `output_contract`

它回答：

> 这个 Agent 默认应如何输出结果？

| 字段 | 中文意思 | 怎么写 |
| --- | --- | --- |
| `tone` | 语气 | 如“concise and structured” |
| `default_format` | 默认格式 | 如“summary with evidence” |
| `update_policy` | 更新策略 | 如“milestone-only” |

### 8.1B 内容如何编写

如果你不知道“内容到底怎么写才像一个好 Agent”，可以记住这三条：

1. **人格写行为风格，不写文学人设**
2. **职责写边界和目标，不写空泛夸赞**
3. **执行语义 section 直接回答‘怎么做事’**

### 8.2 Leader 推荐最小骨架

```yaml
id: researchops-leader
kind: agent
version: 1.0.0
name: ResearchOps Leader

persona_core:
  temperament: steady and structured
  cognitive_style: clarify then converge
  risk_posture: evidence-first
  communication_style: concise and decision-oriented
  persistence_style: keeps pushing until a usable result exists
  decision_priorities:
    - clarity
    - correctness
    - usability

responsibility_core:
  description: 调研型 Team 的默认入口与主执行 owner，负责问题澄清、研究路径决策、结论收束与最终交付。
  use_when:
    - 需要研究、分析、方案或文稿输出
  avoid_when:
    - 纯代码实现任务
  objective: 在约束内产出结构清晰、证据充分、可直接使用的结论或文稿
  success_definition:
    - 结论明确
    - 证据充分
    - 输出可直接使用
  non_goals:
    - 不负责大型代码实现
  in_scope:
    - research
    - analysis
    - writing
  out_of_scope:
    - heavy coding

core_principle:
  - 先澄清问题，再收束路径，再形成可用结果。
  - 证据优先于猜测。

ambiguity_policy:
  - 默认先通过已有上下文缩小歧义。
  - 只有关键歧义会显著改变结果时才提问。

support_triggers:
  - 涉及事实查证、资料搜索时优先找 evidence-researcher。
  - 涉及成稿整理时优先找 report-writer。

collaboration:
  default_consults:
    - evidence-researcher
  default_handoffs:
    - report-writer

task_triage:
  simple:
    signals:
      - 已有充分材料
      - 只需轻量整理
    default_action: 直接分析并输出
  research_heavy:
    signals:
      - 需要外部证据
      - 事实尚未建立
    default_action: 先调 evidence-researcher 再收束

completion_gate:
  - 结论已形成
  - 核心证据已给出
  - 输出形式可直接使用

failure_recovery:
  - 证据不足时先补证据，不伪造结论。
  - 路径不成立时切换研究路径后重新收束。

runtime_config:
  requested_tools:
    - read
    - glob
    - grep
  permission:
    - permission: read
      pattern: "*"
      action: allow
    - permission: glob
      pattern: "*"
      action: allow
    - permission: grep
      pattern: "*"
      action: allow

output_contract:
  tone: concise and structured
  default_format: summary with evidence
  update_policy: milestone-only

entry_point:
  exposure: user-selectable
  selection_label: leader
  selection_description: 研究与方案类任务的默认入口

prompt_projection:
  include:
    - persona_core
    - responsibility_core
    - core_principle
    - ambiguity_policy
    - support_triggers
    - collaboration
    - task_triage
    - completion_gate
    - failure_recovery
    - output_contract
```

---

## 9. 第五步：再设计 support agents

Leader 设计好后，再逐个补 support agents。

原则：

- 每个 support agent 只负责一类清晰工作
- 不要让 support agent 角色过于模糊
- 不要让所有 support agents 都“什么都能做”

### 9.1 例子：evidence-researcher

```yaml
id: evidence-researcher
kind: agent
version: 1.0.0
name: Evidence Researcher

persona_core:
  temperament: careful and evidence-oriented
  cognitive_style: search, compare, verify
  risk_posture: conservative on unsupported claims
  communication_style: factual and compact
  persistence_style: keeps searching until a solid evidence set is formed
  decision_priorities:
    - evidence
    - traceability
    - recency

responsibility_core:
  description: 负责资料搜索、事实核对、证据提取与外部信息整理。
  use_when:
    - 需要外部资料
    - 需要事实查证
  avoid_when:
    - 需要最终汇报与结论收口
  objective: 提供可核验的研究结论和证据链接
  success_definition:
    - 返回关键结论
    - 提供证据来源
    - 说明边界与不确定性
  non_goals:
    - 不负责最终文稿定稿
  in_scope:
    - search
    - evidence collection
  out_of_scope:
    - final synthesis

core_principle:
  - 证据优先于猜测。

collaboration:
  default_consults: []
  default_handoffs: []

runtime_config:
  requested_tools:
    - read
    - grep
  permission:
    - permission: read
      pattern: "*"
      action: allow
    - permission: grep
      pattern: "*"
      action: allow

output_contract:
  tone: factual
  default_format: findings with evidence
  update_policy: only when useful evidence is ready
```

---

## 10. 第六步：写 `TEAM.md`

这个文件是给人看的，不是给 parser 读的。

它的目的主要是帮助你和团队成员快速理解这支 Team。

### 10.1 推荐模板

```md
# ResearchOpsTeam

## Mission
面向调研、证据整理、报告输出与轻量事务推进。

## Leader
- researchops-leader：默认入口与主执行 owner

## Members
- evidence-researcher：负责资料搜索与证据提取
- report-writer：负责将结论整理成清晰交付物

## Default Workflow
1. 用户把任务交给 leader
2. leader 判断是否先澄清问题
3. leader 决定自己做、咨询还是委派
4. support agents 返回结果给 leader
5. leader 收束并对用户输出最终结果

## Design Notes
- Team Contract 使用 Working Rules / Approval & Safety
- Agent Profile 采用 top-level semantic sections
- Collaboration 会生成可直接委派的 agent 清单
```

---

## 11. 第七步：验证你的 Team 是否符合当前实现

### 11.1 最低检查点

请逐条确认：

- 有 `team.manifest.yaml`
- 有 `team.policy.yaml`
- 至少有一个 `*.agent.md`
- `leader.agent_ref` 对应真实 agent id
- `members` 中列出的 agent 都真实存在
- YAML key 全部使用 `snake_case`
- 没有使用 `projection_schema`

### 11.2 推荐自查问题

#### Team 层
- 这支 Team 的 mission 是否清晰？
- formal leader 是否明确？
- members 是否职责明确？

#### Agent 层
- leader 是否能独立完成主链路？
- support agents 是否边界清晰？
- collaboration 是否可操作？

#### Prompt 层
- 关键执行语义是否直接定义为 top-level section？
- `prompt_projection` 是否只是做裁剪，而不是替代定义设计？

---

## 12. 常见错误

### 错误 1：把 Team 设计成一堆平级角色，没有明确 leader

后果：
- 默认入口不清楚
- 收口责任不清楚

### 错误 2：把关键行为都塞进一个大块字段里

例如把：
- 歧义处理
- 委派规则
- 完成标准
- 失败恢复

全塞进一个笼统字段。

更好的做法是直接写成 top-level section。

### 错误 3：`members` 只写名字，不写职责和委派时机

这样会导致最终 Collaboration 清单信息不足。

### 错误 4：support agent 角色过多、边界模糊

一开始请优先做“小而清楚”的 Team。

### 错误 5：把 README / TEAM.md 当成真正的逻辑来源

当前实现里，真正的逻辑来源仍然是：

- `team.manifest.yaml`
- `team.policy.yaml`
- `*.agent.md`

`TEAM.md` 是解释文档，不是执行配置。

---

## 13. 最佳实践总结

如果你要在当前 CrewBee 项目中自定义一套 Team，最推荐的步骤就是：

1. **先确定 Team 要解决什么问题**
2. **先选定 formal leader**
3. **先写 `team.manifest.yaml`**
4. **再写 `team.policy.yaml`**
5. **优先设计好 leader agent**
6. **再逐个补 support agents**
7. **写好 `members.responsibility / delegate_when / delegate_mode`**
8. **最后补 `TEAM.md` 给人看**
9. **用最小 Team 跑通，再扩展角色**

最重要的一条是：

> **先把 Team 结构、Leader、成员边界和关键执行语义设计清楚，再去调 prompt 文本细节。**

这也是当前 CrewBee 框架下，自定义设计一套 Agent Team 的最佳实践。
