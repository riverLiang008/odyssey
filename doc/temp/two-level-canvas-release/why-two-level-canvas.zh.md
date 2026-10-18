# 为什么是双层 Canvas

> 把“多个 Agent 如何协作”和“一个 Agent 如何工作”放在不同的设计尺度中。

一张无限 Canvas 看起来像是设计 Agent 系统最自然的起点：空间足够大，节点可以继续增加，连线也可以继续延伸。只要把所有对象放进去，系统似乎就会变得可见。

但空间并不等于结构。

当我们同时想表达一个 OdyJourney 的协作关系，以及其中每个 Agent 的内部工作方式时，同一张 Canvas 会开始回答两类完全不同的问题：

- 系统里需要哪些协作位置，它们之间是什么关系？
- 某个 Agent 收到工作之后，具体经过哪些步骤、分支、循环和工具调用？

前者关心系统拓扑，后者关心局部执行。它们使用的对象、尺度和编辑频率都不同。如果强迫它们共享同一平面，Canvas 虽然仍然“无限”，读者的注意力却不是。

Odyssey 因此选择了双层 Canvas。

## 一张 Canvas 为什么会逐渐失控

在一张画布中同时展开整个系统和每个 Agent 的内部 Workflow，会产生一种很具体的尺度冲突。

当视图缩小到足以看清多个 Agent 的协作关系时，Agent 内部的 Task、Branch 和 Loop 会变成无法辨认的细节。反过来，当视图放大到足以编辑一个 Agent 的节点时，其他 Agent 以及它在系统中的位置又会离开视野。

这不只是缩放体验不好。更根本的问题是，两种结构被迫共享了一套视觉语法：

- Agent 到底是系统中的协作者，还是 Workflow 中的一个节点？
- 一条连线表示 Agent 之间的协作关系，还是一个 Agent 内部的控制流？
- Tool 和 Knowledge Space 应该出现在系统拓扑上，还是只在具体 Agent 的工作流中出现？
- 用户移动一个对象时，改变的是系统语义，还是局部布局？

## 从 Workflow Builder 到 Agent System Builder

这个冲突并不是“画布里放了太多节点”这么简单。当一个可视化 AI Builder 以 Workflow 为基本编辑单位时，节点可以表示模型调用、条件、工具或数据处理，连线表示执行顺序。对于设计一条流程，这套语言非常直接。

但当产品开始表达多个 Agent 时，原有视觉语法会遇到一个新问题：Agent 之间的协作关系，与单个 Agent 内部的执行步骤，并不是同一种关系。

如果继续使用同一套节点和连线，系统级结构很容易被压缩成“更多 Workflow 节点”；一个 Agent 也容易被理解成流程中的一个步骤，而不是拥有独立目标、状态、资源和内部 Workflow 的主体。

Odyssey 并不是因为传统 Workflow Canvas 没有价值才设计双层 Canvas。相反，Agent Workflow Canvas 仍然保留了 Workflow 表达控制流的优势。Odyssey 增加 Journey Canvas，是因为在 Workflow 之上还需要另一种视觉尺度来表达多个 Agent 如何组成一个系统。

## 颜色回答责任，层级回答尺度

在解释双层 Canvas 之前，需要先说明 Odyssey 的另一个基础概念：Thinking Ownership。

Thinking Ownership 讨论的是“谁负责作出决定”。Odyssey 使用三种颜色区分三类责任：

- 绿色表示 **User-managed**：决定由用户预先配置；
- 黄色表示 **Shared**：状态可以由用户设计的结构与 Agent 共同维护；
- 红色或粉色表示 **Agent-managed**：开放式判断由 Agent 在明确边界内承担。

System 提供并维护的状态使用中性灰，不属于这三类可分配的 Thinking Ownership。

这套颜色贯穿 Odyssey 的设计。它既可以表现为空间区域，也可以出现在 Workflow 节点、变量分组、文字标签和资源权限中。颜色让读者知道“谁负责”，但它不能单独回答另一个问题：这些责任应当在哪个系统尺度被查看和编辑。

当多个 Agent 的协作结构与每个 Agent 的内部 Workflow 同时铺在一张 Canvas 上时，即使每个对象都有清楚的颜色，系统拓扑与局部控制流仍然会互相争夺空间和视觉语法。

因此，三色 Thinking Ownership 与双层 Canvas 并不是前后替代的两个方案：

- Thinking Ownership 划分责任；
- 双层 Canvas 划分设计尺度。

Odyssey 同时需要二者。

![Agent Variables 面板，编号标出 System、User-managed、Shared 和 Agent-managed 四组变量](./release/assets/thinking-ownership-annotated.png)

*图 1a：Thinking Ownership 在 Agent Variables 中的当前表达。① System 提供的只读状态；② 绿色的 User-managed；③ 黄色的 Shared；④ 红色或粉色的 Agent-managed。Figma 节点 `119:2`，导出于 2026-10-02，标注于 2026-10-03。*

这张图也说明，Thinking Ownership 并不只依赖一块固定的三色区域。相同的责任语言可以同时出现在 Workflow 节点、变量分组和资源权限中；它回答的是责任归属，而不是 Canvas 所处的设计尺度。

![Focus Mode 中的 Workflow 节点、节点面板与 Agent Variables 使用一致的 Thinking Ownership 颜色](./release/assets/thinking-ownership-across-canvas.png)

*图 1b：同一套 Thinking Ownership 颜色跨越不同界面对象。左侧 Focus Mode 的 Configure 视图中，开放式 Agent Action 使用红色或粉色，确定性的 Task 使用绿色；中间 Node Palette 继续用黄色、红色或粉色、绿色区分 Branch / Loop、Agent Action 与 Task；右侧 Agent Variables 则用相同颜色组织 Shared、Agent-managed 与 User-managed 状态。素材来自 Figma `166:2`、`62:2` 与 `119:2`，导出和组合于 2026-10-03。*

这里的一致性比某一种具体布局更重要。颜色不是为了给节点类型做装饰性分类，而是让读者在节点、变量和资源边界之间移动时，仍能辨认决定主要由谁维护。对象可以改变，责任语言保持不变。

## 第一层：Journey Canvas 负责系统协作

Journey Canvas 回答的是：这个 OdyJourney 由怎样的协作结构组成？

在当前设计中，Journey Editor 的系统级 Canvas——当前 UI 中称为 `System Canvas`——把执行结构分成两个方向。横向是 Input Guardrail、Main Execution 与 Output Guardrail 组成的执行链；纵向维度由 Execution Behavior（当前 UI：`Behavior`）表达，它在画布的第二行横跨整条执行链。Main Execution 使用设计者为 OdyJourney 选择的 System Pattern，两侧 Guardrail 则使用系统固定的 `Single` Pattern。

每个 Pattern 通过 Agent Slot 提供稳定的协作位置。Agent Slot 表示 Agent 在 Pattern 中占据的位置：它承担某种关系责任，并可以由一个具体 Agent 占据。Journey Canvas 关心的是 Agent 被放进什么结构、与其他位置如何关联，而不是立即展开这个 Agent 内部的每一步工作。

这种克制使 Journey Canvas 保持在系统尺度。读者可以先检查：

- 系统采用什么协作 Pattern；
- Pattern 提供哪些 Agent Slot；
- 哪些 Slot 已经配置 Agent；
- Input Guardrail、Main Execution 与 Output Guardrail 如何形成横向执行链；
- Execution Behavior 如何横切整条执行链；
- 一个 Agent 的局部设计应从哪个位置进入。

它展示的是可见、可编辑的系统结构，不是模型的私有内部推理。

![Odyssey 的 Journey Canvas，编号标出 System configuration、选中的 Agent Slot 和只读 Workflow Preview](./release/assets/journey-canvas-annotated.png)

*图 2：Journey Canvas 的系统级视图。① System configuration 的第一行是 Input Guardrail、Main Execution 与 Output Guardrail，第二行的 Execution Behavior 横跨三者；② Research Agent 占据 Main Execution Pattern 中的一个 Agent Slot；③ 右下角只读 Workflow Preview 提供进入 Agent Workflow 前的局部预览。Figma 节点 `59:2`，导出于 2026-10-02，标注于 2026-10-03。*

### Pattern 先定义关系形状

Journey Canvas 并不是从一组已经命名好的 Agent 角色开始。创建 OdyJourney 时，设计者先选择一个 System Pattern，用它确定协作关系最基本的形状，再将具体 Agent 配置到 Pattern 提供的位置中。

当前设计用四个简化选项表达这种起点：Hub and Spoke、Circular Loop、Linear Sequence 与 Solo Component。它们首先描述的是协调、循环、顺序或单一组件等关系结构，而不是预先规定 Planner、Reviewer 或 Worker 等角色名称。

![Create OdyJourney 对话框中的 System Pattern 选择](./release/assets/system-pattern-selection.png)

*图 3：创建 OdyJourney 时选择 System Pattern。每个选项先用极简拓扑表达关系形状，再给出适用工作的简短提示。Figma 节点 `417:33`，导出于 2026-10-03。*

Pattern 也不是一个展开后的 Agent Workflow。它决定系统层有哪些位置以及这些位置如何发生关系；每个位置中的 Agent 仍然可以拥有自己的 Goal、资源和内部 Workflow。本文只介绍 Pattern 在双层结构中的作用，具体 Pattern 为什么强调关系而不是角色，将在独立章节展开。

## 第二层：Agent Workflow Canvas 负责一个 Agent 如何工作

进入一个具体 Agent 后，问题发生了变化。

现在读者不再比较多个 Agent 的协作位置，而是在设计这个 Agent 如何完成工作：从哪里开始，何时执行 Agent Action，哪些步骤组合成 Task，在哪里分支，什么条件需要 Loop，以及 Tool、Knowledge Space 和 Agent Variable 如何进入这些步骤。

Agent Workflow Canvas 因此拥有自己的节点语言和编辑空间。它属于一个具体 Agent，而不是整个 OdyJourney。这里的连线表达 Workflow 内部的控制关系，不与 Journey 层的协作关系争夺含义。

拆开之后，两层可以分别保持清晰：Journey Canvas 不需要承载所有节点细节，Agent Workflow Canvas 也不需要重复整个系统拓扑。

![Research Agent 的 Workflow Canvas，编号标出节点面板、Agent 内部控制流和可用工具面板](./release/assets/agent-workflow-canvas-annotated.png)

*图 4：进入 Research Agent 后的 Workflow Canvas。① Node Palette；② Agent 内部控制流；③ Available Tools。三个区域都围绕一个 Agent 展开；这里的连线表示 Agent 内部的执行关系，而不是 Journey 中 Agent 之间的协作关系。Figma 节点 `62:2`，导出于 2026-10-02，标注于 2026-10-03。*

## 两层之间不能只靠一个链接

分层解决了视觉尺度问题，却引入了另一个风险：如果点击 Agent 后直接跳进新页面，用户很容易失去自己刚才在系统中的位置。

Odyssey 使用三步渐进式进入来缓冲这次尺度变化：

```text
Agent Slot
→ Read-only Workflow Preview
→ Full Agent Workflow Canvas
```

![从 Journey Canvas 中的 Agent Slot，经只读 Workflow Preview，进入完整 Agent Workflow Canvas](./release/assets/cross-level-transition.png)

*图 5：跨越两层 Canvas 的渐进式进入。① 在 Journey Canvas 中选择已配置的 Agent Slot；② 在不离开系统视图的情况下查看只读 Workflow Preview；③ 需要深入编辑时进入完整 Agent Workflow Canvas。素材来自 Figma `59:2` 与 `62:2`，组合于 2026-10-04。*

选择一个已经配置的 Agent Slot 时，Journey Canvas 仍然保留在原处，右下角出现一个只读 Workflow Preview。Preview 不承担节点配置；它只提供足够的 Workflow 拓扑，让用户确认“这个 Slot 里的 Agent 是怎样工作的”。

只有当用户决定深入编辑时，才通过 Open canvas / fullscreen 进入完整的 Agent Workflow Canvas。

这个 Preview 不是缩小版编辑器。它是两层之间的方向标：既不把全部细节重新塞回 Journey Canvas，也不要求用户在没有预告的情况下离开系统视图。

图 5 将这次过渡单独展开：Research Agent 所占据的 Agent Slot 与对应的只读 Workflow Preview 都来自图 2 的 Journey Canvas，最后一步则进入图 4 所示的完整 Agent Workflow Canvas。这样，用户在进入局部编辑前仍能看见 Agent 在系统里的位置。

## 这个决定让什么变得可理解

双层 Canvas 首先带来的不是更多功能，而是一套更稳定的阅读顺序。

读者可以先在 Journey 层理解系统结构，再选择一个 Agent 进入它的 Workflow；修改完成后，再回到 Journey 层检查它在整体协作中的位置。系统关系与局部控制流不再使用同一条线表达，资源也不必在所有尺度上重复出现。

这种分层还明确了编辑边界：

- 在 Journey Canvas 中改变 Pattern 或 Agent Slot，处理的是系统协作结构；
- 在 Agent Workflow Canvas 中改变节点与连线，处理的是一个 Agent 的内部工作方式；
- Preview 只负责观察和定向，不拥有第三套编辑语义。

这让设计能够被检查。人们可以围绕明确对象讨论取舍，而不必先解释当前看到的是哪个缩放层级。

## 它没有让什么变得可见

双层 Canvas 展示的是设计时的结构：对象、关系、控制边界、资源入口和可编辑决策位置。

它不等于模型运行时的全部思考过程，也不意味着 Odyssey 可以读取或展示模型的私有 Chain of Thought。即使未来加入运行记录，那也属于另一层运行可追踪性问题，不能从 Canvas 的结构可见性直接推出。

这个限制很重要。否则，“把 Agent 系统画出来”很容易被误写成“把 Agent 的思考全部展示出来”。前者是 Odyssey 的设计目标，后者不是。

## 双层 Canvas 的代价

分层不会免费获得清晰度。

用户需要在 Journey 与 Agent Workflow 之间导航，并在两个尺度之间保持上下文。Preview 如果过于简化，会失去辨认价值；如果承载太多操作，又会重新变成嵌在 Journey 里的第二个编辑器。进入 Full Canvas 后，页面还必须持续告诉用户：自己正在编辑哪个 Journey 中的哪个 Agent，以及如何回到原来的系统位置。

因此，双层 Canvas 的设计质量取决于连接处，而不只取决于两张 Canvas 各自是否好看。Agent Slot 的选中反馈、Preview 的信息密度、Open canvas 的入口以及返回路径，共同决定了这次抽象层切换是否自然。

这也是我们接受的代价：用一次明确的导航，换取两套结构不再互相污染。

## 仍未解决的问题

当前设计已经确定两层的基本责任，但仍有问题需要继续观察：

- Preview 应保留多少节点信息，才能帮助辨认而不诱导编辑？
- 用户返回 Journey Canvas 时，需要恢复哪些选择和视图上下文？
- 当 Agent Workflow 很大时，缩略拓扑如何仍然可读？
- 哪些跨层信息应持续显示，哪些应该只在进入 Agent 后出现？
- 双层结构是否需要更明确的面包屑或层级提示？

这些问题不会推翻双层 Canvas 的核心判断，但会决定它最终是否真的减轻了理解成本。

## 本文术语

| 术语 | 本文中的含义 |
| --- | --- |
| **OdyJourney** | 由 System Pattern、Agent、资源和执行规则共同组成的系统级设计对象。 |
| **Journey Canvas** | OdyJourney 的系统级设计表面；当前 UI 中称为 `System Canvas`。 |
| **System Pattern** | 定义系统协作关系形状以及 Agent Slot 的结构。 |
| **Agent Slot** | Agent 在 Pattern 中占据的稳定位置；领域模型和数据资料中也可能称为 `Pattern Slot`。 |
| **Agent Workflow Canvas** | 属于一个具体 Agent、用于设计其内部 Workflow 的局部编辑表面。 |
| **Workflow Preview** | 选中已配置 Agent Slot 后出现的只读缩略视图，用来保持 Journey 上下文并提供进入完整 Workflow 的入口。 |
| **Thinking Ownership** | 用绿色、黄色、红色或粉色区分 User-managed、Shared、Agent-managed 责任的设计语言；System 状态使用中性灰。 |
| **Execution Behavior** | 横切 Input Guardrail、Main Execution 与 Output Guardrail 整条执行链的规则、策略与可观察性结构；当前 UI 中简称 `Behavior`。 |

## 设计来源

- 当前设计：[Figma `OdyJourney — Resource Library Open`（`59:2`）](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=59-2)，核对日期 2026-09-21；
- 当前设计：[Figma `Research Agent — Workflow Canvas`（`62:2`）](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=62-2)；
- 当前 Thinking Ownership：[Figma `Agent Workflow Canvas — Agent Variables`（`119:2`）](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=119-2)，核对日期 2026-10-02；
- 当前 Focus Mode：[Figma `Agent Workflow Canvas — Focus Mode`（`166:2`）](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=166-2)，核对日期 2026-10-03；
- 当前 Pattern 选择：[Figma `OdyJourney — Create Journey Modal`（`417:33`）](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=417-33)，核对日期 2026-10-03；
- 当前信息架构：`odyssey/doc/product/information-architecture/odyssey-figma-information-architecture.md`；
- System Configuration 结构：`odyssey/doc/product/OdyJourney.md`、`odyssey/doc/planning/implementation/frontend/system-configuration-grid-behavior-boundary-implementation-plan.md`；
- 术语与表述：`doc/foundations/first-release-terminology.md`、`doc/foundations/visibility-language-guidelines.md`。
