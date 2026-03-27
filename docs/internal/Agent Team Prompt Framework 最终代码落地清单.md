# Agent Team Prompt Framework 最终代码落地清单

## 目标

在保留低耦合结构化 Prompt Pipeline 的前提下，让最终 Agent prompt 更接近旧版本的执行语义组织方式。

核心原则：

- 少量语义一等 section
- 通用结构处理
- 结构渲染
- Profile 决定 Agent / Team 的表达骨架
- 框架主要管理格式、加载、投影、排序、渲染

---

## 一、最终主链路

```text
Definition
-> Load
-> Normalize
-> Catalog Build
-> Prompt Projection
-> Prompt Plan
-> Render
-> OpenCode Prompt Assembly
```

---

## 二、代码落地清单

### 1. Core / Prompt Model

文件：

- `src/core/index.ts`
- `src/core/prompt-model.ts`

落地要求：

- 保留 `PromptProjectionSpec`
- 保留 `PromptValue / PromptNode / PromptCatalog / PromptPlan`
- `AgentTeamDefinition.policy` 为必填
- `AgentProfileSpec` 以一等 section 建模：
  - `personaCore`
  - `responsibilityCore`
  - `corePrinciple`
  - `scopeControl`
  - `ambiguityPolicy`
  - `supportTriggers`
  - `collaboration`
  - `repositoryAssessment`
  - `taskTriage`
  - `delegationReview`
  - `todoDiscipline`
  - `completionGate`
  - `failureRecovery`
  - `operations`
  - `outputContract`
  - `templates`
  - `guardrails`
  - `heuristics`
  - `antiPatterns`
  - `toolSkillStrategy`
  - `extraSections`

### 2. Loader

文件：

- `src/loader/profile-loader.ts`
- `src/loader/markdown-body-loader.ts`

落地要求：

- frontmatter / yaml 只接受 `snake_case`
- `projection_schema` 直接报错
- `prompt_projection` 只支持：
  - `include`
  - `exclude`
  - `labels`
- Team 分离：
  - `team.manifest.yaml`
  - `team.policy.yaml`
- markdown body 按 `## Heading` 切 section

### 3. Normalize

文件：

- `src/normalize/normalize-value.ts`
- `src/normalize/normalize-document.ts`
- `src/normalize/build-team-prompt-source.ts`

落地要求：

- 只做 trim / 去空 / 递归统一
- 不做 renderer 绑定
- Team Contract 压缩为：
  - `working_rules`
  - `approval_safety`

### 4. Catalog / Projection / Plan / Render

文件：

- `src/catalog/build-prompt-catalog.ts`
- `src/projection/apply-prompt-projection.ts`
- `src/plan/build-prompt-plan.ts`
- `src/render/structural-renderer.ts`

落地要求：

- Catalog 只建通用节点树
- Projection 只按 path 投影
- Render 只按结构渲染
- Agent Prompt Plan 使用固定公共执行语义骨架顺序：
  - `persona_core`
  - `responsibility_core`
  - `core_principle`
  - `scope_control`
  - `ambiguity_policy`
  - `support_triggers`
  - `collaboration`
  - `repository_assessment`
  - `task_triage`
  - `delegation_review`
  - `todo_discipline`
  - `completion_gate`
  - `failure_recovery`
  - `operations`
  - `output_contract`
  - `templates`
  - `guardrails`
  - `heuristics`
  - `anti_patterns`
  - `tool_skill_strategy`

### 5. OpenCode Adapter

文件：

- `src/adapters/opencode/prompt-builder.ts`

落地要求：

- 不再依赖 projection schema
- 不再依赖 renderer registry
- 不再从 prompt builder 内拆 `execution_policy`
- 只拼：
  - `## Team Contract`
  - `## Agent Contract`

### 6. Team / Profile Files

文件：

- `AgentTeams/*/team.policy.yaml`
- `AgentTeams/*/agents/*.agent.md`
- `src/agent-teams/embedded/coding-team/agents/*.ts`

落地要求：

- Team policy 独立成 `team.policy.yaml`
- Coding Team embedded profiles 直接使用一等 section
- 不再把 prompt 主语义挂在 `executionPolicy`

---

## 三、模块改造顺序

### Phase 1：收敛框架主链路

1. 固化 `PromptValue / PromptNode / PromptPlan`
2. 固化 snake_case-only loader
3. 固化 structural render
4. 固化 Team policy -> Team Contract

### Phase 2：固化 Prompt 语义骨架

1. 在 Prompt Plan 中固化 Agent 公共 section 顺序
2. Team 只保留：
   - `working_rules`
   - `approval_safety`
3. extra section 自动排到骨架后面

### Phase 3：Profile 收敛

1. Embedded Coding Team profiles 改成一等 section
2. 文件型 Team profiles 改成一等 section
3. `prompt_projection` 改成直接引用新 path

### Phase 4：移除过渡兼容

1. 删除 prompt builder 中任何 execution_policy prompt 映射
2. 删除 embedded helper 中的 execution_policy 拆分
3. 将 parser 中旧写法支持降为 legacy/helper，最终可继续删除

---

## 四、Coding Team Profile 迁移模板

### 旧写法

```ts
executionPolicy: {
  corePrinciple: [...],
  scopeControl: [...],
  ambiguityPolicy: [...],
  supportTriggers: [...],
  repositoryAssessment: [...],
  taskTriage: {...},
  delegationPolicy: [...],
  reviewPolicy: [...],
  todoDiscipline: [...],
  completionGate: [...],
  failureRecovery: [...],
}
```

### 新写法

```ts
corePrinciple: [...],
scopeControl: [...],
ambiguityPolicy: [...],
supportTriggers: [...],
repositoryAssessment: [...],
taskTriage: {...},
delegationReview: {
  delegation_policy: [...],
  review_policy: [...],
},
todoDiscipline: [...],
completionGate: [...],
failureRecovery: [...],
```

### Agent prompt_projection 迁移

#### 旧写法

```yaml
prompt_projection:
  include:
    - execution_policy.core_principle
    - execution_policy.task_triage
    - execution_policy.delegation_policy
    - execution_policy.review_policy
```
```

#### 新写法

```yaml
prompt_projection:
  include:
    - core_principle
    - task_triage
    - delegation_review.delegation_policy
    - delegation_review.review_policy
```
```

### Team prompt_projection 迁移

#### 旧写法

```yaml
prompt_projection:
  include:
    - governance
```
```

#### 新写法

```yaml
prompt_projection:
  include:
    - working_rules
    - approval_safety
```
```

---

## 五、Coding Team 设计模板

对执行型 agent，推荐最小骨架：

```yaml
persona_core:
responsibility_core:
core_principle:
scope_control:
ambiguity_policy:
support_triggers:
collaboration:
task_triage:
delegation_review:
todo_discipline:
completion_gate:
failure_recovery:
operations:
output_contract:
guardrails:
heuristics:
anti_patterns:
```

可按 agent 特性增加：

- `repository_assessment`
- `templates`
- `tool_skill_strategy`
- `extra_sections.*`

---

## 六、验收清单

### Prompt 结构

- Team Contract 只有：
  - `Working Rules`
  - `Approval & Safety`
- Agent Contract 中：
  - `Responsibility Core` 后紧接 `Core Principle`
  - `Support Triggers` 与 `Collaboration` 靠近
  - `Operations` 位于 `Completion Gate / Failure Recovery` 后

### 框架约束

- render 不依赖字段专属 renderer
- projection 不依赖 projection schema
- normalize 不绑定 renderer
- new extra top-level section 无需改 schema 即可进入 prompt

### 工程验证

- `npm run typecheck`
- `npm test`
- coding-leader prompt snapshot / section check
- minimal agent prompt check
- extra section prompt check

---

## 七、当前仓库已完成状态

已落地：

- Team policy 已独立为 `team.policy.yaml`
- Team policy 已强制要求存在
- Prompt 主链路已是结构化流水线
- structural renderer 已成为主渲染器
- Prompt Plan 已使用公共执行语义骨架
- embedded Coding Team 已从 prompt 主链路视角迁到一等 section 表达

仍可继续收尾：

- 逐步删除 parser 中对旧 `execution_policy` 文件型定义的 legacy 支持
- 将所有外部 Team 文档示例完全改成最终一等 section 写法
