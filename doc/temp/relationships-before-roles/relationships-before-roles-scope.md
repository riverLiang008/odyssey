# 《关系先于角色》写作范围

## 这篇文章要回答什么

文章解释 Odyssey 为什么不先要求设计者定义 Planner、Reviewer、Worker 等 Agent 角色，而是先选择 Agent 之间的关系结构；并用当前四种内置 Pattern 说明“关系不变量”和“可变 Slot”如何同时存在。

核心判断：

> Pattern 固定的是一组关系不变量，不是 Agent 的名称、能力，也不是 Figma 缩略图里展示的 Slot 数量。

## 纳入首稿

1. 角色优先设计为什么会过早固化系统假设；
2. Pattern、Agent Slot、Agent 三者的边界；
3. Slot 数量改变时，哪些关系仍然不变；
4. 四种内置 Pattern 的结构、适用场景和不适用场景；
5. 为什么 V1 在创建 OdyJourney 时选择 Pattern，并且不把切换 Pattern 当作普通布局操作；
6. 该设计的收益、代价与仍需验证的问题。

## 不纳入首稿

- Research Assistant 或其他尚未完成的案例；
- 模型运行时的私有推理；
- 自定义自由连线 Pattern；
- 执行引擎、调度算法和性能结论；
- 把未来设想写成当前能力；
- 用 persisted key `diamond_loop` 作为公开名称。

## 四种 Pattern 的事实基线

| Pattern | Slot 数量 | 结构不变量 | 允许的结构操作 |
| --- | --- | --- | --- |
| Solo Component | 固定 1 | 一个孤立 Slot，没有内部 Agent Route | 不增加、不删除、不重排 |
| Linear Sequence | 可变 | Slot 形成有序序列，Route 由顺序派生 | 增加、删除、重排 |
| Hub and Spoke | 可变 | 一个 Hub 必须保留；其余 Slot 为 Spoke | 增加、删除 Spoke；不把拓扑解释成线性重排 |
| Circular Loop | 可变，至少 2 | 唯一入口、单向有序环、末尾回到入口、无分支与汇合 | 增加、删除、重排；由 Pattern 规则原子重建 Route |

## 写作护栏

- “适合”表示结构上的合理匹配，不表示经过 Benchmark 证明性能更好；
- Circular Loop 只定义关系闭环，不自动回答何时停止；
- Agent Slot 是结构位置，不等于预设 Agent 类型；
- Figma 图中的节点数量是关系示意，不是固定基数；
- Pattern 的线表示系统级 Agent 关系，不是单个 Agent Workflow 内部的控制流；
- 文档讲设计思想，不以当前代码完成度组织叙事。

## 中文稿验收清单

- [x] 读者能用一句话区分 Pattern、Agent Slot 与 Agent；
- [x] 四种 Pattern 都有明确的结构、不变量、适用场景与边界；
- [x] 动态 Slot 没有被误写成任意自由连线；
- [x] Circular Loop 没有被误写成 branch-and-merge；
- [x] 没有引入未设计的 Research Assistant 案例；
- [x] 没有把设计适配判断写成 Benchmark 结论；
- [x] River Review 通过；
- [x] 四种 Pattern 配图与 Figma 当前设计逐图核对；
- [x] River Review 通过配图后的中文稿。

## 设计依据

- `odyssey/doc/architecture/domain/odyssey-v1-design-constraints.md`；
- `odyssey/doc/architecture/domain/diamond-loop-pattern-decision.md`；
- `odyssey/doc/product/OdyJourney.md`；
- Figma `OdyJourney — Create Journey Modal`（节点 `417:33`）；
- 已验收样章《为什么是双层 Canvas》中的 System Pattern 与 Agent Slot 定义。
