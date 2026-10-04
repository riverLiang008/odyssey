# 《为什么是双层 Canvas》独立冷读验收记录

> Date: 2026-10-04  
> Reviewer: Independent Codex  
> Initial result: Revise — 1 P1, 3 P2  
> Editing authority: Reviewer supplied findings only; document changes remain with the primary authoring task.

## P1 — Pattern Slot / Agent Slot 未对齐

问题：冻结术语表以 `Pattern Slot` 表示 Pattern 中的稳定位置，样章却将核心路径全部写成 `Agent Slot`，容易让读者误以为 Slot 从属于 Agent。

处理：

- 首次出现时改为 `Pattern Slot`，并明确当前 UI 使用 `Agent Slot`；
- 领域论证、跨层路径和代价部分统一使用 `Pattern Slot`；
- 只有直接描述界面标签或图片 Alt Text 时保留 `Agent Slot`。

状态：Resolved，等待复核。

【River】Slot 是 agent 在 pattern 中的位置。统一术语是不是更好？—— btw 是不是可以在样章中加入一个 section term explaination? —— 专门解释文中出现的术语的含义？

最终决定（2026-10-04）：面向读者统一使用 `Agent Slot`，定义为“Agent 在 Pattern 中占据的稳定位置”；`Pattern Slot` 只作为领域模型和数据资料中的对应名称出现。样章在设计来源之前增加简短的「本文术语」速查表。

## P2 — Benchmark 提示像内部编辑备注

问题：正文中的“待 Benchmark 核验”和“后续将……”打断主线，并在证据完成前引入 Coze、Dify。

处理：从公开样章正文与设计来源中移除该提示；Benchmark 约束继续保留在内部范围与计划文档中。

状态：Resolved，等待复核。

【River】是的，应该在正文中移除所有提示。

## P2 — “常见 Builder 路径”超出现有证据

问题：尚未完成 Benchmark 时，不应把条件性的设计问题概括为行业普遍事实。

处理：改为条件句——“当一个可视化 AI Builder 以 Workflow 为基本编辑单位时……”。

状态：Resolved，等待复核。

## P2 — Journey Canvas 对象关系含混

问题：“展示 Pattern、Execution、Behavior 和 Agent 之间的关系”容易被理解成四种平级对象，并超出图 2 直接支持的内容。

处理：改为 System configuration 的层级表述：它包含 Guardrail、Execution 与 Behavior；Pattern 在 Execution 中定义协作拓扑和 Pattern Slot。

状态：Resolved，等待复核。

【River】Guardrail 是 Execution 的一种。Execution 是横向，Behavior 是纵向（可以看 OdyJourney 的 UI 设计）Pattern 存在于 Execution 中，Guardrail Execution 是系统固定的 pattern (linear) —— 可以去找一下 odyssey 开发仓库的文档，之前是有设计的。

最终决定（2026-10-04）：以 Guardrail 设计文档为准。Input Guardrail、Main Execution 与 Output Guardrail 组成横向执行链；Main Execution 使用用户选择的 System Pattern，两侧 Guardrail 使用系统固定的 `Single` Pattern；Execution Behavior 横切整条执行链，不属于 Main Execution，也不编码为 Pattern topology。

## 复核门禁

- Reviewer re-check: Approve with P2 follow-up
- P0 remaining: 0
- P1 remaining: 0
- P2 remaining: 0 — reviewer requested that three standalone `Behavior` references use the frozen term `Execution Behavior`; resolved on 2026-10-04.
