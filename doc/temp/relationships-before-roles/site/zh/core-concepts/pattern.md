# 关系先于角色：为什么 Odyssey 从 Pattern 开始设计 Agent 系统

> Planner、Reviewer、Worker 描述的是 Agent 被配置成什么；Pattern 描述的是它们如何组成一个系统。

设计多 Agent 系统时，从角色列表开始很自然。

我们可以先创建一个 Planner，再加入几个 Worker，最后放一个 Reviewer。名字一旦出现，系统看起来就已经有了分工，读者也很容易想象它会怎样工作。

但角色名称经常比结构更早作出承诺。

`Planner` 暗示它位于其他 Agent 之前；`Manager` 暗示它拥有协调权；`Reviewer` 暗示工作会经过一个检查阶段。可这些假设究竟来自 Agent 本身，还是来自它在系统中的位置？如果 Reviewer 参与多轮修订，它还是流水线末端的一次检查吗？如果 Manager 只负责汇总信息，它一定要成为一种特殊 Agent 类型吗？

Odyssey 因此不把预设角色作为系统设计的第一步。创建 OdyJourney 时，设计者先选择一个 System Pattern，用它确定 Agent 之间最基本的关系形状，再把具体 Agent 配置到结构中的位置。

这就是 Odyssey 所说的：**关系先于角色。**

![创建 OdyJourney 时提供的四种 System Pattern](/images/design-decisions/relationships-before-roles/system-pattern-selection.png)

*图 1：当前设计提供 Hub and Spoke、Circular Loop、Linear Sequence 与 Solo Component 四种 System Pattern。卡片中的节点数量用于说明关系形状，不表示固定 Slot 数量。Figma 节点 `417:33`。*

## Pattern 不是一组角色模板

Pattern 不回答“这个 Agent 应该叫什么”，而是回答：

- 系统里有哪些稳定的协作位置；
- 这些位置之间允许形成什么关系；
- 信息或工作以什么基本方向经过这些位置；
- 当位置增加、删除或重排时，哪些规则必须继续成立。

因此，同一种 Pattern 可以承载完全不同的角色配置。

一个 Hub and Spoke 可以由“主编 + 多位专题作者”构成，也可以由“协调 Agent + 多个领域专家”构成。两者的目标、Prompt、Tool 和 Knowledge Space 都不同，但它们共享一个结构判断：一个中心位置与多个外围位置发生直接关系，外围位置之间不需要被强制排成流水线。

反过来，同一个名为 Reviewer 的 Agent 也可能出现在不同 Pattern 中。在 Linear Sequence 里，它可以是最后一个阶段；在 Circular Loop 里，它可以是推动下一轮修订的位置；在 Hub and Spoke 里，它也可能只是中心 Agent 咨询的一个专业节点。

角色名称并不能唯一决定关系。Odyssey 把二者拆开，让关系成为可以单独讨论和检查的设计对象。

## Agent Slot 是位置，不是 Agent 类型

Pattern 通过 Agent Slot 表达结构中的稳定位置。

可以把三者理解为：

```text
Pattern      定义关系规则
Agent Slot   是规则中的一个稳定位置
Agent        占据这个位置，并带来具体目标、Workflow 与资源
```

Agent Slot 可以为空，也可以由一个具体 Agent 占据。将 Agent 移到另一个 Slot，改变的是 Agent 在系统中的关系位置；它不会因此自动变成另一种预设 Agent 类型。

这种区分也解释了为什么 Pattern 中的 Slot 需要稳定身份。Slot 的意义不应依赖屏幕坐标、显示顺序或当前 Agent 名称。坐标可以随着布局重新计算，Agent 也可以被替换，但 Pattern 的 Route 仍然引用那个结构位置。

## 可变 Slot 不等于自由连线

Figma 使用少量节点来让四种 Pattern 能被快速辨认，但这些缩略图不是固定规模的模板。

除 Solo Component 外，当前 Pattern 都允许 Slot 数量在各自规则内变化。变化之后，系统会按照 Pattern 规则重新建立合法关系，而不是让设计者任意添加和删除 Route。

这一区别非常重要：

- **可变 Slot** 表示同一种关系原则可以容纳不同规模；
- **自由连线** 表示设计者可以改变关系原则本身。

Odyssey V1 选择前者。设计者可以改变结构的规模和占位 Agent，但不能在 Linear Sequence 中随手拉出一条分支，也不能把 Circular Loop 改成多入口的汇合图。未来的 Custom Pattern 可以讨论自由拓扑；当前四种 Pattern 的价值，正是让变化发生在可理解的边界内。

## 四种 Pattern，四种关系判断

### Solo Component：协作并不总是必要

```text
[ Slot ]
```

![Solo Component 的当前 Pattern 卡片](/images/design-decisions/relationships-before-roles/pattern-solo-component.png)

*图 2a：Solo Component 用一个独立节点表达固定的单 Agent 结构。图中的 `solo` 不是 Agent 名称，而是在强调该 Slot 不与其他 Agent Slot 建立内部 Route。Figma 节点 `419:77`。*

Solo Component 固定包含一个 Agent Slot，没有内部 Agent Route，也不允许增加、删除或重排 Slot。

它适合目标可以由一个 Agent 独立承担的工作：范围清楚、协作收益有限，或者设计者仍在验证一个 Agent 的内部 Workflow。选择 Solo 不是“还没来得及做成多 Agent”，而是明确判断：此处没有必要为协作引入额外的交接与协调成本。

它不适合那些必须拆分专业责任、需要独立复核，或天然包含多阶段交接的工作。此时把所有职责塞进一个 Agent，可能只是把系统复杂度藏进了一个更大的 Prompt 或 Workflow。

### Linear Sequence：阶段与交接具有明确顺序

```text
[ Slot 1 ] → [ Slot 2 ] → [ Slot 3 ] → …
```

![Linear Sequence 的当前 Pattern 卡片](/images/design-decisions/relationships-before-roles/pattern-linear-sequence.png)

*图 2b：Linear Sequence 的卡片用四个节点示意单向顺序。四个只是便于辨认关系形状的示例数量；实际 Slot 数量可变。Figma 节点 `419:67`。*

Linear Sequence 由一组有序 Slot 构成。设计者可以增加、删除和重排 Slot；每次顺序改变后，Route 都从新的 Slot 顺序派生。

它适合前一阶段的产物自然成为后一阶段输入的工作，例如依次完成收集、转换、检查和发布准备。这里最重要的不是 Agent 叫 Researcher 还是 Editor，而是工作存在可解释的阶段顺序和交接方向。

当任务需要频繁回到前一阶段、多个专家围绕同一中心并行贡献，或执行顺序本身无法稳定表达时，Linear Sequence 会开始变得勉强。用额外连线补救这些情况，会逐渐破坏“线性”本身的可读性。

### Hub and Spoke：一个中心协调多个独立方向

```text
            [ Spoke ]
                |
[ Spoke ] — [ Hub ] — [ Spoke ]
                |
            [ Spoke ]
```

![Hub and Spoke 的当前 Pattern 卡片](/images/design-decisions/relationships-before-roles/pattern-hub-and-spoke.png)

*图 2c：Hub and Spoke 的卡片突出一个中心节点与多个外围节点的直接关系。图中的四个 Spoke 是拓扑示意；Spoke 数量可变，但 Hub 必须保留。Figma 节点 `419:39`。*

Hub and Spoke 保留一个不可移除的 Hub，其余 Spoke 数量可以变化。Pattern 规则始终维持 Hub 与每个 Spoke 的直接关系，而不强制 Spoke 之间形成执行序列。

它适合由一个中心位置进行分派、汇总或协调，多个外围位置分别提供专业能力的工作。例如，一个协调 Agent 可以把不同问题交给多个领域 Agent，再将结果带回中心处理。Spoke 可以增加或删除，因为专业方向会随任务规模变化；Hub 必须保留，因为失去中心后，这套关系就不再是 Hub and Spoke。

它不适合真正依赖严格阶段交接的流水线，也不应该被理解成“Hub 天生是 Manager 类型”。Hub 表示拓扑中的中心责任；占据它的 Agent 具体如何协调，仍由该 Agent 的配置与 Workflow 决定。

### Circular Loop：修订是结构的一部分

```text
          [ Slot 2 ]
         ↗          ↘
[ Entry ]             [ Slot 3 ]
         ↖          ↙
          [ Slot 4 ]
```

![Circular Loop 的当前 Pattern 卡片](/images/design-decisions/relationships-before-roles/pattern-circular-loop.png)

*图 2d：Circular Loop 的卡片用四个节点示意单向闭环，并以不同的视觉标记指出唯一入口。四个是示例数量；实际结构至少需要两个 Slot。Figma 节点 `419:54`，其中环形示意子节点为 `423:37`。*

Circular Loop 至少包含两个 Slot，并且可以增加、删除和重排。它有一个明确入口；所有 Slot 组成一个有方向的有序环；最后一个 Slot 回到入口。它没有内置分支、并行路径或汇合语义。

它适合需要反复复核、修订和渐进完善的工作。当一次输出会自然触发下一轮检查与调整时，循环不是流程图上的例外，而是协作关系本身。

但 Circular Loop 只说明“下一步回到哪里”，不自动说明“什么时候停止”。最大轮次、退出条件、人工确认或其他执行策略属于 Execution Behavior 与未来运行机制需要回答的问题。把节点连成环，不能代替终止策略。

它也不适合一次通过的有序交付，或包含分支与汇合的复杂路由。为了兼容已有数据，内部持久化键可能仍为 `diamond_loop`；面向读者和设计者时，Odyssey 使用 **Circular Loop**，因为它更准确地描述当前语义。

## 放在一起看：固定什么，允许什么变化

| Pattern | Slot 规模 | 必须保持的关系 | 更适合 | 不适合 |
| --- | --- | --- | --- | --- |
| **Solo Component** | 固定 1 | 单一孤立位置，无内部 Agent Route | 聚焦的单 Agent 工作、验证局部 Workflow | 必须拆分责任或独立复核的工作 |
| **Linear Sequence** | 可变 | 单向有序序列，Route 随顺序派生 | 阶段化处理、明确交接 | 中心协调、频繁回环或分支汇合 |
| **Hub and Spoke** | 一个固定 Hub + 可变 Spoke | 每个 Spoke 与 Hub 保持直接关系 | 协调者带多个专业方向 | 严格顺序流水线 |
| **Circular Loop** | 可变，至少 2 | 唯一入口、单向闭环、末尾回到入口 | 复核、修订、迭代 | 一次性管线、分支与汇合 |

表中的“更适合”是设计上的结构匹配，不是 Benchmark 结论。Odyssey 目前没有据此宣称某种 Pattern 在某类任务上一定带来更高准确率、更低成本或更快速度。Pattern 首先帮助设计者把假设说清楚；效果仍需要在具体任务、Agent 配置和运行条件中验证。

## 为什么创建 OdyJourney 时就选择 Pattern

当前设计在创建 OdyJourney 时选择 Pattern，并将它视为创建后的稳定结构身份。如果需要另一种 Pattern，设计者创建一个新的 OdyJourney，而不是在原 Journey 中把 Pattern 当作主题或布局选项切换。

原因在于，Pattern 变化并不只是节点重新排版。

从 Linear Sequence 改成 Hub and Spoke，需要决定哪个 Slot 成为 Hub；从 Hub and Spoke 改成 Circular Loop，需要决定唯一入口和环上的顺序；从 Circular Loop 改成 Solo Component，则必须决定其余 Agent、Workflow 和资源配置如何处理。自动转换看似方便，却可能替设计者作出最关键的架构决定，甚至悄悄丢失原有关系含义。

因此，Odyssey 允许 Pattern 内部发生受约束的变化——增加 Slot、删除 Slot、在支持时重排 Slot、替换占位 Agent——但不把 Pattern 之间的转换伪装成无损操作。

这是一项有意接受的限制。它牺牲了随时切换拓扑的便利，换取 Pattern 身份、Slot 语义和系统结构不被静默改写。

## 这个设计让讨论从名字回到假设

当角色不再是起点，设计者可以先讨论更基础的问题：

- 工作是一次完成，还是会反复修订？
- 各阶段是否真的存在稳定顺序？
- 是否需要一个中心位置承担协调责任？
- 增加一个 Agent 时，它是在扩展专业方向、增加处理阶段，还是延长一个循环？
- 哪些关系必须由系统维护，不能靠 Agent 名称暗示？

这些问题不会替设计者完成 Agent 配置，但会让配置建立在一组可见的结构假设上。之后，Planner、Reviewer 或 Specialist 等名称仍然有用；只是它们不再偷偷承担拓扑定义。

Pattern 也因此可以成为一种可交流的设计知识。团队可以比较“为什么这里需要中心协调”或“为什么修订应该形成闭环”，而不必先争论某个 Agent 是否应该叫 Manager。

## 代价与仍未解决的问题

关系优先并不意味着角色不重要，也不意味着四种 Pattern 足以表达所有系统。

首先，设计者必须在 OdyJourney 创建之初作出结构判断。对于尚未理解清楚的工作，这可能显得过早。创建界面需要用足够清楚的拓扑、使用场景与限制帮助选择，而不能只展示四个好看的图标。

其次，动态 Slot 会带来新的可读性问题。三个 Spoke 的 Hub and Spoke 很容易辨认，十几个 Spoke 是否仍然清晰？Circular Loop 在 Slot 增多后如何保持入口和方向可见？这些属于 Pattern 布局与交互仍需继续验证的部分。

最后，四种内置 Pattern 刻意排除了自由分支、汇合和任意 Route。这个边界保持了当前设计的可解释性，也意味着一部分复杂协作暂时无法直接表达。未来的 Custom Pattern 如果开放自由结构，需要重新回答验证、布局、迁移和分享问题，而不能只增加一个“自由连线”开关。

## 本文术语

| 术语 | 本文中的含义 |
| --- | --- |
| **OdyJourney** | 由 System Pattern、Agent、资源和执行规则共同组成的系统级设计对象。 |
| **System Pattern** | 定义 Agent Slot 之间关系不变量的系统级结构。本文简称 Pattern。 |
| **Agent Slot** | Pattern 中具有稳定身份的结构位置；可以为空，也可以由一个 Agent 占据。 |
| **Agent** | 占据 Slot 的具体配置对象，拥有自己的目标、Workflow、Tool 与 Knowledge Space 引用。 |
| **Route** | Pattern 中由结构规则维护的 Slot 间关系；它不是 Agent Workflow 内部的控制流连线。 |
| **Circular Loop** | 具有唯一入口的单向有序环；内部兼容键可能仍为 `diamond_loop`。 |

## 设计来源

- 当前 Pattern 选择：[Figma `OdyJourney — Create Journey Modal`（`417:33`）](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=417-33)；
- 四种 Pattern 当前卡片：Figma `419:39`（Hub and Spoke）、`419:54`（Circular Loop）、`419:67`（Linear Sequence）、`419:77`（Solo Component），导出于 2026-10-07；
- Pattern 与 Agent Slot 约束：`odyssey/doc/architecture/domain/odyssey-v1-design-constraints.md`；
- Circular Loop 决策：`odyssey/doc/architecture/domain/diamond-loop-pattern-decision.md`；
- OdyJourney 系统结构：`odyssey/doc/product/OdyJourney.md`；
- 双层 Canvas 中的 Pattern 定位：样章《为什么是双层 Canvas》。
