# CrewBee 0.1.12 迭代内容说明素材包

> 用途：提供给 ChatGPT / 写作者，用于撰写 CrewBee 0.1.12 release notes、推广文章、更新公告或技术博客。  
> 对比基线：从 `crewbee@0.1.10` 到当前准备发布的 `crewbee@0.1.12`。  
> 写作原则：以当前最新功能为准；中间过程、内部上下文维护材料、已废弃实现不作为对外功能点。  
> 发布注意：当前源码版本号在写作时仍可能显示为 `0.1.11`，正式发布前需要 bump 到 `0.1.12`。

---

## 1. 一句话总结

CrewBee 0.1.12 是一次从“能装、能用”走向“更好装、更透明、更可配置”的迭代：它把 OpenCode 用户的安装体验产品化，把内置 Coding Team 的模型配置从硬编码默认值升级为可见、可改、可 fallback、可诊断的体系，并进一步增强了 doctor、项目级 Team、配置安全和工程可维护性。

---

## 2. 推荐主标题方向

可选标题：

1. **CrewBee 0.1.12：更简单的 OpenCode 安装，更强的 Coding Team 模型配置**
2. **CrewBee 0.1.12 发布：一条命令完成安装，Coding Team 支持模型 fallback**
3. **从安装到模型选择：CrewBee 0.1.12 让 Agent Team 更可用、更透明**
4. **CrewBee 0.1.12：面向 OpenCode 的 Agent Team 框架继续进化**

推荐副标题：

> 新增产品化 setup 流程、OpenCode 检测与可选安装、配置备份与 doctor 检查、内置 Coding Team per-agent 模型配置、projection-time fallback 与 host-default 兜底。

---

## 3. 面向用户的核心变化

### 3.1 安装体验：从 install 命令升级到 setup 流程

0.1.10 之前，用户更接近在使用一个底层安装命令。0.1.12 开始，推荐路径变成：

```bash
npx crewbee@latest setup --with-opencode
```

这个命令代表的是一个完整 onboarding 流程，而不是单一安装动作。它会做这些事：

- 检查本机是否已经安装 OpenCode。
- 如果用户传入 `--with-opencode`，在需要时尝试安装 OpenCode。
- 从 npm registry 安装 CrewBee。
- 写入 OpenCode plugin 配置。
- 创建或修复 CrewBee 自己的 `crewbee.json`。
- 安装后默认运行 doctor。
- 输出下一步使用提示。

可以对外这样解释：

> CrewBee 现在把“安装 OpenCode 插件、配置 CrewBee、检查健康状态”合成一个更产品化的 setup 流程。新用户不需要理解内部插件路径，也不需要手动修改 OpenCode 配置。

### 3.2 升级体验：新增 update 入口

用户升级可以使用：

```bash
crewbee update
```

它的语义是：按 setup 的方式从 registry 获取最新 CrewBee，并强制刷新当前安装。对用户来说，更新路径更直接：

```text
安装：npx crewbee@latest setup --with-opencode
升级：crewbee update
检查：crewbee doctor
```

### 3.3 安全性：写配置前备份，失败可回滚

CrewBee 现在写入 OpenCode 配置时会更谨慎：

- 先读取现有 OpenCode 配置。
- 识别并迁移旧 CrewBee plugin entry。
- 写入稳定的 canonical plugin entry：`crewbee`。
- 写配置前创建备份。
- 后续步骤失败时恢复备份。
- dry-run 模式只输出计划，不改文件。

对外可以强调：

> CrewBee 不再要求用户手动编辑 OpenCode 配置，并且在写配置前会保留备份，减少安装失败导致配置损坏的风险。

### 3.4 不污染业务项目

CrewBee 的安装目标是 OpenCode 用户级 package workspace，而不是业务项目目录。对用户而言：

- 不需要把 CrewBee 安装到业务项目的 `node_modules`。
- 不要求修改业务仓库。
- 插件入口保持简单：`crewbee`。
- 安装、升级、卸载的目标更可预测。

可以写成：

> CrewBee 更像是 OpenCode 的用户级能力扩展，而不是某个业务项目的依赖。

---

## 4. OpenCode 集成增强

### 4.1 OpenCode 检测

setup 和 doctor 都会检测 OpenCode 是否可用：

```text
opencode --version
```

如果检测成功，doctor 会展示 OpenCode 是否存在、路径和版本。OpenCode 不存在时，doctor 会认为环境不健康。

### 4.2 可选安装 OpenCode

当用户使用：

```bash
npx crewbee@latest setup --with-opencode
```

CrewBee 会在缺少 OpenCode 时尝试执行类似命令：

```bash
npm install -g opencode-ai --no-audit --no-fund
```

如果安装命令成功，但当前终端仍无法识别 `opencode`，CrewBee 会提示用户打开新终端并验证 `opencode --version`。

这解决了一个常见问题：全局 npm 包安装后，PATH 可能要重开终端才生效。

---

## 5. 内置 Coding Team 模型配置重大升级

这是 0.1.12 最值得重点宣传的功能之一。

### 5.1 之前的问题

内置 Coding Team 以前有默认 provider/model，但它更接近硬编码默认值。问题是：

- 用户不一定配置了对应 provider。
- 用户可能没有权限访问某些模型。
- 所有环境都硬依赖同一组默认模型并不鲁棒。
- 用户想改内置 Coding Team 的模型，需要复制或 shadow 整支 Team，成本高。
- 模型配置结果不够透明，用户不知道最终 OpenCode agent 到底用了哪个模型。

### 5.2 现在的设计

CrewBee 0.1.12 让内置 Coding Team 在 `crewbee.json` 中显式展开每个 Agent 的默认模型：

```jsonc
{
  "id": "coding-team",
  "enabled": true,
  "priority": 0,
  "model_preset": "sota-2026-05",
  "fallback": "builtin-role-chain",
  "fallback_to_host_default": true,
  "agents": {
    "coding-leader": {
      "model": "openai/gpt-5.5"
    },
    "coordination-leader": {
      "model": "openai/gpt-5.5"
    },
    "coding-executor": {
      "model": "openai/gpt-5.5"
    },
    "codebase-explorer": {
      "model": "openai/gpt-5.4-mini"
    },
    "web-researcher": {
      "model": "google/gemini-3.1-pro-preview"
    },
    "reviewer": {
      "model": "anthropic/claude-opus-4-7"
    },
    "principal-advisor": {
      "model": "anthropic/claude-opus-4-7"
    },
    "multimodal-looker": {
      "model": "google/gemini-3.1-pro-preview"
    }
  }
}
```

这段配置有几个重要含义：

- `model_preset` 表示这是一组 CrewBee 版本化推荐模型。
- `fallback` 表示启用内置角色 fallback chain。
- `fallback_to_host_default` 表示最后可以回到 OpenCode 默认模型。
- `agents` 让每个 Agent 的模型都直接可见、可改。

### 5.3 默认模型按角色分配

内置 Coding Team 不再像“所有角色共用同一个默认模型”。它按角色选择不同模型：

| Agent | 默认模型 | 面向任务 |
| --- | --- | --- |
| `coding-leader` | `openai/gpt-5.5` | 主线 owner、复杂代码任务、上下文持有、最终收口 |
| `coordination-leader` | `openai/gpt-5.5` | 高模糊任务、范围收束、计划和协调 |
| `coding-executor` | `openai/gpt-5.5` | 明确实现、修复、调试、局部重构 |
| `codebase-explorer` | `openai/gpt-5.4-mini` | 快速定位代码入口、调用链、相似实现 |
| `web-researcher` | `google/gemini-3.1-pro-preview` | 官方文档、外部资料、版本差异研究 |
| `reviewer` | `anthropic/claude-opus-4-7` | 独立审查、风险识别、完成标准检查 |
| `principal-advisor` | `anthropic/claude-opus-4-7` | 架构判断、复杂权衡、高阶建议 |
| `multimodal-looker` | `google/gemini-3.1-pro-preview` | 图片、PDF、截图、架构图、多模态理解 |

可以对外表达为：

> CrewBee 的 Coding Team 不只是多个 prompt，而是一组有角色分工的工程协作 Agent。0.1.12 开始，模型配置也按角色设计。

### 5.4 用户可以直接修改单个 Agent 的模型

例如，用户希望 reviewer 不使用 Claude，而使用 OpenAI：

```jsonc
"agents": {
  "reviewer": {
    "model": "openai/gpt-5.5"
  }
}
```

用户希望 leader 使用 Claude：

```jsonc
"agents": {
  "coding-leader": {
    "model": "anthropic/claude-opus-4-7"
  }
}
```

这相比以前更简单：不需要复制内置 Team，也不需要维护一套 fork 版 Team 文件。

### 5.5 `host-default`：交还给 OpenCode 默认模型

如果用户希望某个 Agent 完全使用 OpenCode 默认模型，可以写：

```jsonc
"agents": {
  "reviewer": {
    "model": "host-default"
  }
}
```

这表示：

```text
CrewBee 不给这个 OpenCode agent 写 model 字段。
OpenCode 使用自己的默认模型或用户当前选择的模型。
```

这很重要，因为不同用户的 OpenCode 环境可能不同。有些用户已经配置好自己的默认 provider/model，CrewBee 不应该强迫覆盖。

---

## 6. Model Resolver：模型选择不再是黑箱

### 6.1 核心逻辑

CrewBee 0.1.12 新增了 projection-time model resolution。它不负责调用 LLM，而是在生成 OpenCode agent config 之前决定：

```text
这个 Agent 应该写入哪个 model？
还是不写 model，让 OpenCode 使用 Host Default？
```

核心决策顺序：

```text
crewbee.json 中的 per-agent override
  -> Team manifest 中 agent_runtime.<agent>
  -> Team manifest 中 agent_runtime.$default
  -> 内置 Coding Team 的角色 fallback chain，或自定义 Team 的 fallback_models
  -> host-default
```

简化伪代码：

```ts
resolveModel(agent) {
  candidates = []

  candidates.add(userConfiguredModel)
  candidates.add(teamManifestAgentModel)
  candidates.add(teamManifestDefaultModel)
  candidates.add(roleFallbackModels)

  for (candidate of candidates) {
    if (candidate === "host-default") return omitOpenCodeModelField()
    if (candidate is available) return writeOpenCodeModel(candidate)
  }

  return omitOpenCodeModelField()
}
```

### 6.2 fallback 的含义

本次 fallback 是 **projection-time / config-time fallback**。

它能做：

- 根据配置和候选列表选择一个模型。
- 在提供可用模型列表时跳过不可用模型。
- 最后回退到 host-default。
- 生成 doctor trace 解释选择过程。

它不做：

- LLM API 调用失败后的运行时自动重试。
- 自动发现所有用户真实可用 provider/model。
- 接管 OpenCode 的运行时模型调用逻辑。

写文章时可以说：

> CrewBee 0.1.12 先解决“配置生成阶段的鲁棒性”：不要把内置推荐模型变成用户环境的硬依赖。如果无法确认或无法选择合适模型，CrewBee 可以不写 model，让 OpenCode 使用自己的默认模型。

不要说：

> CrewBee 已经实现 API 报错后自动切模型重试。

### 6.3 Doctor 中的可观测性

doctor 现在可以展示每个 Agent 的模型解析结果，例如：

```text
Model Resolution:
- coding-team/coding-leader: openai/gpt-5.5
  configured: openai/gpt-5.5
  source: crewbee-json
  fallback: builtin-role-chain
  fallback_to_host_default: true

- coding-team/reviewer: host-default
  configured: host-default
  source: host-default
  fallback: builtin-role-chain
  fallback_to_host_default: true
  reason: host-default selected explicitly
```

这让用户知道：

- 模型来自哪里。
- fallback 是否启用。
- 最后是否写入了 OpenCode model 字段。
- 某些候选为什么被跳过。

---

## 7. 自定义 Team 的模型 fallback

0.1.12 不只增强内置 Coding Team，也增强了文件型自定义 Team 的模型配置。

### 7.1 旧写法继续兼容

已有 Team 可以继续使用：

```yaml
agent_runtime:
  leader:
    provider: openai
    model: gpt-5.5
```

这表示最终模型是：

```text
openai/gpt-5.5
```

### 7.2 新写法支持 provider/model 字符串

也可以直接写：

```yaml
agent_runtime:
  leader:
    model: openai/gpt-5.5
```

这种写法更接近 OpenCode 的模型表达。

### 7.3 支持 `$default`

可以给整支 Team 设置默认模型：

```yaml
agent_runtime:
  $default:
    model: host-default
    fallback_to_host_default: true

  researcher:
    model: google/gemini-3.1-pro-preview
```

含义：

- `researcher` 使用自己的模型。
- 其他没有显式配置的 Agent 使用 `$default`。
- `$default` 可以是具体模型，也可以是 `host-default`。

### 7.4 支持 `fallback_models`

自定义 Team 作者可以为某个 Agent 提供 fallback chain：

```yaml
agent_runtime:
  research-leader:
    model: openai/gpt-5.5
    fallback_models:
      - anthropic/claude-opus-4-7
      - google/gemini-3.1-pro-preview
    fallback_to_host_default: true
```

解析顺序是：

```text
primary model
  -> fallback_models 按顺序尝试
  -> host-default
```

### 7.5 自定义 Team 的用户覆盖

用户也可以在 `crewbee.json` 中对文件型 Team 的 Agent 模型做覆盖：

```jsonc
{
  "teams": [
    {
      "path": "@teams/research-team",
      "enabled": true,
      "priority": 0,
      "agents": {
        "research-leader": {
          "model": "anthropic/claude-opus-4-7"
        }
      }
    }
  ]
}
```

对外可以概括为：

> Team 作者可以定义推荐模型和 fallback，用户可以在自己的环境配置里覆盖模型。Team 定义与用户环境适配被分开了。

---

## 8. Doctor 与 Validate 的增强

### 8.1 Doctor 现在检查更多内容

`crewbee doctor` 的定位从“安装是否存在”升级为“当前 OpenCode + CrewBee + Team 配置是否健康”。它会展示：

- OpenCode 是否可用。
- OpenCode 路径和版本。
- CrewBee config 文件状态。
- Install root 状态。
- Package workspace 是否存在。
- CrewBee package 是否安装。
- Plugin file 是否存在。
- 是否有历史 legacy package residue。
- OpenCode plugin entry 是否是 canonical entry。
- 当前 CrewBee plugin entries。
- 当前 project worktree。
- 加载了多少 Team。
- Team definition 是否健康。
- Team validation issues。
- Model Resolution trace。

OpenCode 不存在会让 doctor 返回 unhealthy，这能帮助用户尽早发现环境问题。

### 8.2 项目级 Team 诊断

CrewBee 支持全局 Team 配置和项目级 Team 配置。项目级配置通常位于当前项目的 `.crewbee` 目录下。

用户可以检查某个项目的 Team 状态：

```bash
crewbee doctor --project-worktree /path/to/project
crewbee validate --project-worktree /path/to/project
```

这对于多项目使用不同 Agent Team 的用户很重要。

---

## 9. 文档和项目呈现

0.1.12 周期也更新了大量文档素材：

- README 英文版。
- README 中文版。
- 安装指南英文版。
- 安装指南中文版。
- 项目级 Team 配置指南。
- 自定义 Team 指南。
- 内置 Coding Team 设计说明。

文档整体更强调：

```text
CrewBee = Agent Team 定义框架 + Runtime Projection 层 + OpenCode Host Adapter
```

对文章可用的表达：

> CrewBee 不是简单的一组 prompt，也不是另一个重型 agent runtime。它更像是 Agent Team 的定义层、投影层和宿主适配层。当前重点宿主是 OpenCode。

---

## 10. 工程质量和维护性提升

这部分可在 release notes 中简写，但写技术文章时可以展开。

### 10.1 安装层职责拆分

安装相关逻辑被拆成更清晰的职责：

- OpenCode config 读写、备份、恢复。
- CrewBee plugin entry 迁移和 canonical entry 生成。
- npm package 安装、卸载、legacy cleanup。
- OpenCode CLI 检测和可选安装。
- setup / install / update / uninstall / doctor 的不同入口。

这样做的价值：

- 更容易测试。
- 更容易定位安装问题。
- 更容易保持旧入口兼容。
- 更适合未来继续扩展更多 host adapter 或安装策略。

### 10.2 OpenCode Adapter 边界更清晰

OpenCode 相关逻辑进一步分层：

- bootstrap 负责整体投影和默认 agent 选择。
- projection 负责生成 OpenCode agent definition。
- model resolver 负责模型选择。
- config hook 负责把结果写入 OpenCode config。
- doctor 负责展示结果和健康状态。

对外可说：

> CrewBee 没有把模型 fallback 逻辑塞进 prompt 或散落在 hook 里，而是单独放在 model resolution 层，让 OpenCode projection 保持简单。

### 10.3 内置 Coding Team 定义更易维护

内置 Coding Team 的 Agent profile 构造、runtime 参数、模型默认值等进一步显式化。这样未来更新某个 Agent 的职责、工具权限、模型选择或 fallback chain 时，不需要在多处隐式逻辑中查找。

### 10.4 自动依赖更新工作流

新增自动更新 OpenCode plugin 依赖的 GitHub workflow：

- 定期检查 `@opencode-ai/plugin` 最新版本。
- 有变化时更新依赖。
- 自动运行 typecheck、build、tests。
- 创建 PR。

这体现项目仍在持续跟进 OpenCode 生态变化。

---

## 11. 测试覆盖增强

0.1.12 周期强化了这些测试场景：

- setup 参数解析。
- setup dry-run 输出。
- doctor 输出。
- OpenCode 缺失时 doctor unhealthy。
- registry / local 安装路径。
- 用户级 package workspace。
- legacy package residue 检测。
- OpenCode config backup / restore。
- plugin entry 迁移。
- 默认 `crewbee.json` 模板。
- packaged Team templates。
- plugin startup 时自动创建 / 修复 config。
- project Team 优先级。
- project Team shadow global Team。
- invalid project config fallback 到 global Team。
- 内置 Coding Team per-agent model override。
- `host-default` 不写 OpenCode model 字段。
- builtin role fallback chain。
- 文件型 Team `fallback_models`。

最新已知验证记录：

```text
npm run typecheck 通过
npm test 通过，90 passed / 0 failed
```

正式发布前建议重新运行：

```bash
npm run typecheck
npm run build
npm test
```

---

## 12. 可直接使用的 Release Notes 草稿

### 12.1 英文短版

```md
## CrewBee 0.1.12

CrewBee 0.1.12 focuses on smoother OpenCode onboarding and a more transparent model configuration story for the built-in Coding Team.

### Highlights

- New recommended setup flow: `npx crewbee@latest setup --with-opencode`.
- Optional OpenCode detection and installation during setup.
- Safer OpenCode config updates with backup and rollback.
- New `crewbee update` entry for registry-based upgrades.
- Built-in Coding Team now ships with visible per-agent model defaults in `crewbee.json`.
- Users can override each Coding Team agent model directly in `crewbee.json`.
- `host-default` lets OpenCode keep control of the model when desired.
- Projection-time model fallback supports role-aware built-in chains and file-team `fallback_models`.
- `crewbee doctor` now reports model resolution traces.
- Updated bilingual docs and stronger install / doctor / model fallback test coverage.

Note: model fallback in this release happens during OpenCode agent config projection. It is not runtime provider API-error retry.
```

### 12.2 中文短版

```md
## CrewBee 0.1.12

CrewBee 0.1.12 重点提升 OpenCode 用户的安装体验，并让内置 Coding Team 的模型配置变得更透明、更可控、更鲁棒。

### 亮点

- 新推荐安装方式：`npx crewbee@latest setup --with-opencode`。
- setup 阶段支持 OpenCode 检测与可选安装。
- 写 OpenCode 配置前自动备份，失败可回滚。
- 新增 `crewbee update` 作为升级入口。
- 内置 Coding Team 默认在 `crewbee.json` 中展开 per-agent 模型配置。
- 用户可以直接在 `crewbee.json` 中修改每个 Coding Team Agent 的模型。
- 支持 `host-default`，让 OpenCode 使用自己的默认模型。
- 支持 projection-time 模型 fallback：内置角色 fallback chain、自定义 Team `fallback_models`、Host Default 兜底。
- `crewbee doctor` 现在可以展示每个 Agent 的模型解析路径。
- 中英文文档、安装指南和测试覆盖进一步增强。

注意：本版本的模型 fallback 是配置生成阶段的 fallback，不是 provider API 报错后的运行时自动重试。
```

---

## 13. 可直接用于推广文章的结构

### 标题

CrewBee 0.1.12：让 OpenCode 的 Agent Team 更容易安装、更容易配置、更容易诊断

### 开头

CrewBee 是一个面向 OpenCode 的 Agent Team 框架。它的目标不是把所有事情塞进一个越来越长的 prompt，而是让不同任务拥有不同的 Agent Team、角色分工、协作规则和完成标准。

0.1.12 是 CrewBee 最近一段时间工作量的集中发布：安装体验被产品化，内置 Coding Team 的模型配置被显式化，fallback 和 doctor 让模型选择更鲁棒、更透明。

### 第一部分：安装从“命令”变成“流程”

介绍 `setup --with-opencode`，说明它会检查 OpenCode、安装 CrewBee、写配置、创建 `crewbee.json`、运行 doctor。

### 第二部分：配置更安全

介绍 backup / rollback / dry-run / canonical plugin entry。

### 第三部分：Coding Team 模型配置升级

解释每个 Agent 有不同默认模型，为什么 reviewer、explorer、leader、multimodal-looker 不应该都用同一个模型。

### 第四部分：用户可以自己控制

展示 `crewbee.json` 中修改单个 Agent model，以及 `host-default`。

### 第五部分：fallback 与 doctor

解释 projection-time fallback，展示 doctor trace 示例。

### 第六部分：自定义 Team 也受益

展示 `agent_runtime.$default` 和 `fallback_models`。

### 第七部分：项目仍在快速迭代

提到中英文文档、测试覆盖、OpenCode 依赖自动更新 workflow、工程边界更清晰。

### 结尾

CrewBee 0.1.12 让 Agent Team 从“可以被定义和投影”进一步走向“可以被普通用户安装、配置、诊断和长期使用”。这是 CrewBee 继续围绕 OpenCode 构建 Agent Team 生态的重要一步。

---

## 14. 对外宣传时必须注意的边界

不要这样说：

```text
CrewBee 已支持模型 API 报错后的自动运行时重试。
CrewBee 已自动发现用户所有可用 provider/model。
CrewBee 已完整接入 Models.dev catalog 做 provider routing。
```

应该这样说：

```text
CrewBee 支持 projection-time / config-time 模型 fallback。
CrewBee 可以在生成 OpenCode agent config 时决定写入模型或回退 host-default。
CrewBee 的 resolver 已预留 availableModels 过滤能力，但真实 provider catalog 接入属于后续工作。
```

不要把内部过程作为用户功能宣传：

- 内部上下文维护材料。
- 内部调研文档。
- 临时缓存或上下文更新。
- 中间 release commit。

可以把这些归为内部工程维护，不写进用户 release notes。

---

## 15. 发布前检查清单

- [ ] 确认版本号已经 bump 到 `0.1.12`。
- [ ] 运行 `npm run typecheck`。
- [ ] 运行 `npm run build`。
- [ ] 运行 `npm test`。
- [ ] 确认 npm dist-tag 目标是 `latest`。
- [ ] 确认 release notes 没有宣称 runtime API-error fallback。
- [ ] 确认 release notes 没有宣称真实 provider catalog 自动发现。
- [ ] 发布后查询 npm registry，确认 `crewbee@0.1.12` 已发布。

---

## 16. 给 ChatGPT 的建议提示词

如果要把本文交给 ChatGPT 写文章，可以使用：

```text
请基于以下素材，为 CrewBee 0.1.12 写一篇中文发布文章。

要求：
1. 面向 OpenCode 用户和对 Agent Team 感兴趣的开发者。
2. 重点突出：setup --with-opencode、一站式安装、配置备份与 doctor、内置 Coding Team per-agent 模型配置、host-default、projection-time fallback、自定义 Team fallback_models。
3. 不要宣传 runtime API error 自动重试，不要宣传真实 provider catalog 自动发现。
4. 文章风格要技术化但易读，结构清晰，有标题、小节、代码片段和总结。
5. 不要写内部文件路径，不要提内部 scaffold。
```
