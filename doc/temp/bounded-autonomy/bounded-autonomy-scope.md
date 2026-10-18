# 《有边界的自主性》写作范围

## 这篇文章要回答什么

文章解释 Odyssey 为什么不在“完全确定的 Workflow”和“完全自主的 Agent”之间二选一，而是使用 Thinking Ownership 把不同类型的决定放进明确边界；并说明 Agent Action、Task、Branch、Loop、Tool 与 Variable 如何共同表达这种边界。

核心判断：

> 自主性不是一个 Agent 的全局开关。它应当被分配到具体行动、控制结构、状态和资源使用位置中。

## 纳入首稿

1. 为什么“Workflow 或 Agent”的二选一不够；
2. Thinking Ownership 的三类责任与 System 状态；
3. Agent Action、Task、Branch、Loop 各自承担什么决定；
4. 为什么 Tool 是能力资源，而不是独立 Workflow 决策节点；
5. Variable 所有权如何限制 Tool 与 Agent Action 的写入；
6. 为什么 Loop 是结构化迭代，而不是任意图循环；
7. 结构可见性与模型私有推理之间的边界；
8. 这种设计的收益、代价与开放问题。

## 不纳入首稿

- Research Assistant 或其他尚未确认的端到端案例；
- 执行引擎已完成或节点已实际运行的声明；
- 模型私有 Chain of Thought 的展示；
- Tool Template 的 Workspace 级复用范围；
- 两份 Built-in Tool Specification 的版本裁决；
- 未设计完成的异常处理、并行节点或 Human Input；
- 用节点颜色推导执行先后顺序。

## 事实基线

| 对象 | Thinking Ownership / 责任 | 当前稳定边界 |
| --- | --- | --- |
| Task | User-managed | 用户预先配置 Tool 顺序；Task 不进行开放式规划 |
| Agent Action | Agent-managed | 在 Goal、Knowledge Space、Toolbox 与状态权限边界内进行开放式判断 |
| Branch | Shared / structured control | 条件与出口显式可见；根据状态选择一条路径，不进行任意规划 |
| Loop | Shared / structured control | 显式封装迭代、内部子流程与退出边界；禁止嵌套 Loop，内部保持无环 |
| Tool | 能力资源 | 在 Agent Action 中由 Agent 选择使用；在 Task 中由用户预先排列，不独立承担 Workflow 路由 |
| Variable | 状态边界 | System、User-managed、Shared、Agent-managed 四组决定 Tool 和 Agent Action 的读写权限 |

## 已解决冲突

早期 `odyssey-domain-model-draft.md` 曾禁止 Agent Action 位于 Loop 内。后续已接受的 `odyssey-v1-design-constraints.md` 与当前 `Canvas Execution Model.md` 均允许 Loop 内包含 Agent Action、Task 与 Branch，因此首稿采用后续约束，不沿用早期草案规则。

## 写作护栏

- Thinking Ownership 讨论谁承担决定，不代表谁拥有对象或数据库记录；
- 绿色、黄色、红/粉色表示责任，不表示执行顺序或运行状态；
- Agent-managed 不表示 Agent 可以突破用户定义的 Schema、资源和控制边界；
- Shared 不应被简化为“每个决定都由人和模型共同作出”；
- 可见的是设计结构、权限和显式状态，不是完整内部推理；
- 本文解释当前设计，不用当前代码完成度组织叙事。

## 中文稿验收清单

- [x] 读者能区分 Agent 与 Agent Action；
- [x] 读者能区分 Agent Action 与 Task；
- [x] Branch 与 Loop 没有被写成开放式 Agent 推理；
- [x] Tool 没有被写成独立 Workflow 节点；
- [x] Variable 权限矩阵与当前规范一致；
- [x] Loop 采用后续已接受约束；
- [x] 没有暗示模型 Chain of Thought 可见；
- [x] 没有依赖 Research Assistant 案例；
- [x] River Review 通过；
- [x] 根据 River 批注替换 Configure 状态主图、前移 Variable Panel，并补充 Agent Action 设计图；
- [x] 配图和图注通过 River Review。

## 当前设计依据

- Figma `62:2`：Research Agent — Workflow Canvas；
- Figma `119:2`：Agent Workflow Canvas — Agent Variables；
- Figma `166:2`：Agent Workflow Canvas — Focus Mode；
- Figma `194:33`：Agent Workflow Canvas — Reusable Tools；
- Figma `132:2`：Agent Workflow Canvas — Create Variable（Agent Action 当前字段设计）；
- Figma `177:33`：Agent Workflow Canvas — Tool Configuration (Knowledge Retrieval)；
- Figma `477:157`：Focus Mode / Loop Expanded Inline + Configuration；
- `odyssey/doc/architecture/execution/Canvas Execution Model.md`；
- `odyssey/doc/architecture/domain/odyssey-v1-design-constraints.md`；
- `odyssey/doc/product/feature-specifications/variables/odyssey-agent-variable-ui-spec.md`；
- `doc/foundations/first-release-terminology.md`；
- `doc/foundations/visibility-language-guidelines.md`。
