# OpenCode Runtime Simulator

语言：[English](./opencode-runtime-simulator.md) | 中文

## 1. 目的

这个 simulator 只用于本地测试和理解机制。

它用于模拟 CrewBee 当前的 OpenCode runtime path：

- plugin module loading
- plugin initialization
- config hook execution
- message-stage session binding
- system prompt transform injection

它不是生产 runtime 的一部分，也不会包含在已发布的 package files 中。

重要说明：simulator 只记录 OpenCode 可见的一侧。它不会暴露 CrewBee 内部结构，例如 projected TeamLibrary data 或 bootstrap internals。

---

## 2. 文件位置

- simulator entry：`simulators/opencode-runtime.mjs`
- npm script：`npm run simulate:opencode`
- 一键 batch script：`simulators/run-opencode-runtime.bat`

simulator 位于 `src/` 之外，因此不会参与 TypeScript build output。

已发布 package 仍只包含来自以下位置的 runtime 文件：

- `dist/`
- `opencode-plugin.mjs`

simulator 不在 `src/` 中，也不在 `files` allowlist 中，因此会从发布产物中排除。

---

## 3. 它模拟什么

simulator 遵循当前实现边界，而不是完整 OpenCode 产品。

它会模拟：

1. 加载 `opencode-plugin.mjs`
2. 按类似 OpenCode plugin loading 的方式枚举 exported plugin functions
3. 使用 mocked plugin input 初始化 plugin hooks
4. 对本地 config object 运行 `config` hook
5. 为 session 选择 agent
6. 运行 `chat.message`
7. 运行 `experimental.chat.system.transform`
8. 打印 resulting config、binding、logs 和 injected system lines

它只从 host 侧行为出发：

- 加载 plugin exports
- 初始化 hooks
- 把 OpenCode-like config object 传给 `config` hook
- 把 OpenCode-like message event 传给 `chat.message`
- 把 OpenCode-like system transform event 传给 `experimental.chat.system.transform`

---

## 4. 它不模拟什么

它不模拟：

- 完整 OpenCode event bus
- tool execution hooks
- 真实 LLM requests
- session persistence
- 当前 CrewBee hooks 之外的完整 host runloop

这是有意为之。目标是测试和理解 CrewBee 当前 implementation surface，而不是重建 OpenCode。

---

## 5. 使用方式

基础运行：

```bash
npm run simulate:opencode
```

该命令会先执行 fresh build，然后用当前 compiled output 运行 simulator。

每次运行会把 artifacts 写到带 timestamp 的目录：

```text
simulators/runs/<timestamp>/
```

如果同名 timestamp 目录已存在，simulator 会自动追加数字后缀。

选择指定 agent：

```bash
npm run simulate:opencode -- --agent coding-leader
```

打印 JSON 而不是人类可读文本：

```bash
npm run simulate:opencode -- --json
```

使用不同 worktree root：

```bash
npm run simulate:opencode -- --worktree E:/path/to/worktree
```

使用自定义 output root：

```bash
npm run simulate:opencode -- --outdir E:/tmp/crewbee-sim-runs
```

Windows 一键运行：

```bat
simulators\run-opencode-runtime.bat
```

---

## 6. 输出结构

每次运行会写入这些文件：

- `plugin-load.json`：加载了哪些 plugin exports，以及每个 export 返回了哪些 hooks
- `config.before.json`：plugin mutation 前的 host config
- `config.after.json`：plugin mutation 后的 host config
- `agents/index.json`：per-agent output directories 的索引
- `agents/<agent-key>/agent.json`：每个 agent 的 OpenCode-visible config，prompt 会单独抽出
- `agents/<agent-key>/prompt.md`：保留 headings 和 line breaks 的原始 prompt text
- `chat.message.input.json`：模拟 message hook input
- `chat.message.output.json`：message hook output object
- `system.input.json`：模拟 system transform input
- `system.output.json`：OpenCode 看到的 resulting system output
- `logs.json`：通过 `client.app.log` 发出的 plugin logs
- `summary.json`：紧凑 host-side summary
- `summary.txt`：人类可读 summary

这使它同时适用于：

- 测试当前实现从 host 侧看是否符合预期
- 理解 OpenCode 如何看到 plugin loading、config injection 和 runloop-stage effects
