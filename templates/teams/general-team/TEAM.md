# General Team

## Mission
General Team 面向调研、分析、写作、决策支持与通用事务执行，适合非代码主导型任务。

## Leader
- `Task Lead`：接收任务，决定是澄清、委派还是直接执行，并负责整合最终结果。

## Members
- `Researcher`：负责信息收集与素材整理。
- `Analyst`：负责结构化分析与比较判断。
- `Writer`：负责起草主输出。
- `Editor`：负责压缩表达并提升可读性。
- `Operator`：负责推进步骤性或事务性工作。

## Default Workflow
1. Human gives the task to Task Lead.
2. Task Lead clarifies, delegates, or executes directly.
3. Supporting agents work through Session Context.
4. Task Lead consolidates and reports back.

## Working Mode
- Human requests normally enter through `Task Lead`.
- Coordination stays leader-driven, with one active owner holding the main context chain.
- Session Context is the primary communication medium.
- Explicit routing or contract files are intentionally unnecessary for this Team.

## Structure Principles
- Keep one active owner on the main context chain at a time.
- Research, analysis, drafting, editing, and operator work stay separated by default; the leader absorbs them only when that is simpler.
- Final user-facing closure belongs to the leader.

## Current Assumptions
- Session Context is the primary communication medium.
- Explicit routing files are not required.
- Explicit contract files are not required.
- The team stays lightweight and avoids Coding Team execution ceremony.
