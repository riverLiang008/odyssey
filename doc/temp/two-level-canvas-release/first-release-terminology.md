# Odyssey 首版公开术语表

> Status: Approved  
> Backlog item: `ODOC-002`  
> Created: 2026-09-14  
> Language policy: 中文定义是语义基准；英文是对应的公开表达  
> Scope: 首版中文设计文档及后续英文版

## 1. 目的

本文档冻结 Odyssey 首版公开设计文档所需的核心术语，避免以下问题：

- 同一个对象在不同页面被称为 System、Journey、Workflow 或 Canvas；
- Agent 与 Agent Action 混用；
- 把内部兼容键当成公开产品名称；
- 把 Figma 中的页面名称误作领域对象；
- 中文初稿和英文版采用不同强度或不同边界的定义；
- 为了显得完整，提前公开尚未稳定的 Tool、Guardrail 或执行引擎术语。

本文档只冻结首版叙事需要的语言，不试图一次定义 Odyssey 的全部领域模型。

## 2. 总体语言规则

### 2.1 中文先行

中文定义是产品语义和内容 Review 的基准。英文版可以调整语序和表达习惯，但不得改变：

- 对象责任；
- 能力范围；
- 设计内容类型；
- 限制条件；
- 设计结论的强弱。

### 2.2 产品专名保留英文

以下词在中文正文中保留英文产品名，不创造生硬的强制中文译名：

- `Odyssey`
- `OdyJourney`
- `Pattern`
- `Agent`
- `Agent Action`
- `Task`
- `Branch`
- `Loop`
- `Canvas`
- `Knowledge Space`
- `Knowledge Family`
- `Tool`

首次出现时可以使用“中文解释（英文专名）”，之后直接使用英文专名。

示例：

> OdyJourney 是 Odyssey 中一个完整、可持续编辑的能力配置。

不推荐：

> 奥德赛旅程是一个……

原因：`OdyJourney` 是产品对象名，不等同于一般意义上的旅程。

### 2.3 区分产品对象、页面与视觉表现

```text
产品对象 ≠ 页面 ≠ Canvas ≠ Figma frame ≠ 当前实现组件
```

例如：

- `OdyJourney` 是产品对象；
- `Journey Editor` 是编辑该对象的页面；
- `System Canvas` 是页面中的系统级设计区域；
- Figma `59:2` 是该页面某个交互状态的设计稿；
- Vue 组件名称只属于当前实现。

### 2.4 不用大写普通词制造新概念

只有本文档列出的正式术语才作为专名使用。普通意义上的 system、workflow、document、resource 不应随意大写，避免读者误以为它们都是领域对象。

### 2.5 首版按需解释，不建立百科

一个术语只有在当前论证需要时才介绍。首版不因为某个对象存在于领域模型，就必须为它创建独立页面。

## 3. 首版核心术语

## 3.1 Odyssey

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Odyssey |
| 英文正文 | Odyssey |
| 类型 | 产品名 |

中文基准定义：

> Odyssey 是一项关于如何设计持久、可组合、可理解的 AI Agent 系统的产品与工程探索。

边界：

- 首版不称其为成熟 Agent 平台；
- 不宣称已经具备完整执行引擎；
- 不把探索性设计写成通用行业标准。

推荐表达：

> Odyssey 探索一种设计方法……

避免表达：

> Odyssey 已经解决了长期 AI Agent 系统的问题。

## 3.2 OdyJourney

| 字段 | 内容 |
| --- | --- |
| 中文正文 | OdyJourney |
| 英文正文 | OdyJourney |
| 类型 | 核心产品对象 |
| River 决定 | 采用 `OdyJourney` 作为公开标准术语 |

中文基准定义：

> OdyJourney 是 Odyssey 中一个完整、可持续编辑的能力配置。它组织系统级结构、Agent 之间的协作关系，以及各 Agent 所拥有的 Workflow。

首版需要强调：

- 它不是一次执行记录；
- 它不是一段聊天历史；
- 它不是 Canvas 文件的同义词；
- 它描述可以被再次打开、检查和修改的能力配置。

与 `system` 的关系：

- `OdyJourney` 是产品专名；
- “系统”或 `system` 可以作为普通描述，指一个整体 AI Agent system；
- 不再使用大写 `System` 作为与 OdyJourney 并列或竞争的最高层产品对象。

首次出现推荐写法：

> 一个 OdyJourney，也就是 Odyssey 中一个完整、可持续编辑的能力配置……

避免写法：

- Odyssey System（作为正式对象名）；
- Journey（在可能与一般“过程/旅程”混淆时单独使用）；
- Ody Journey；
- Ody-Journey。

## 3.3 Pattern

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Pattern；首次可写“协作结构（Pattern）” |
| 英文正文 | Pattern |
| 类型 | OdyJourney 层的协作结构 |

中文基准定义：

> Pattern 定义一个 OdyJourney 中多个 Agent 如何占据协作位置、连接并传递工作。它表达关系和拓扑，而不是为 Agent 预设永久角色类型。

边界：

- Pattern 不定义单个 Agent 内部如何完成工作；
- Pattern 不等同于 Agent Workflow；
- Pattern 的连线不是可任意绘制的自由图；
- 首版重点解释“关系先于角色”，不展开完整数学形式。

首版可以使用的内置 Pattern 公开名称：

| 中文正文 | 英文正文 | 备注 |
| --- | --- | --- |
| Solo Component | Solo Component | 单一 Slot，无内部 Agent route |
| Linear Sequence | Linear Sequence | 按顺序连接 Slot |
| Hub and Spoke | Hub and Spoke | 由中心与外围位置形成拓扑 |
| Circular Loop | Circular Loop | 有明确入口的有向循环 |

禁止作为公开名称：

- `diamond_loop`：这是持久化兼容键；
- Diamond Loop：旧名称，容易误导为分支与合并；
- Main/Sub Agent Pattern：会把一种拓扑误写为普遍角色模型。

## 3.4 Agent

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Agent；首次可写“Agent（智能体）” |
| 英文正文 | Agent |
| 类型 | OdyJourney 中的完整协作单元 |

中文基准定义：

> Agent 是 OdyJourney 中参与协作的完整单元。它占据一个 Agent Slot，并拥有自己的 Agent Workflow。

首版设计含义：

- Agent 的协作角色来自 Pattern 位置、信息流、目标和 Workflow；
- Planner、Researcher 或 Reviewer 可以是具体 Agent 的名称或职责，不是必须固化的 Agent 类型；
- Agent 不等同于一次 LLM 调用。

避免写法：

- 把 Agent 与 Agent Action 互换；
- 把所有 Agent 固定分成 Main Agent 和 Sub Agent；
- 把示例名 `Research Agent` 当成页面类型。

## 3.5 Agent Slot

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Agent Slot；上下文明确后可简称 Slot |
| 英文正文 | Agent Slot / Slot |
| 类型 | Pattern 中的稳定协作位置 |
| 领域模型 / 数据术语 | `Pattern Slot` |

中文基准定义：

> Agent Slot 是 Agent 在 Pattern 中占据的稳定位置。Slot 由 Pattern 的拓扑定义，可以被具体 Agent 占据，但 Slot 的拓扑身份不等同于 Agent 本身。

边界：

- 调整 Slot 顺序不是简单交换两个 Agent 的显示位置；
- Slot 的位置和连接由 Pattern 规则决定；
- Canvas 上的像素坐标不是 Slot 的核心业务语义；
- 面向读者的首版正文统一使用 `Agent Slot`；`Pattern Slot` 只在直接引用领域模型、数据结构或内部合同名称时使用；
- 首版仅在解释 Pattern 或 Agent Slot 交互时使用，不单独成章。

## 3.6 Agent Workflow

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Agent Workflow；上下文明确后可简称 Workflow |
| 英文正文 | Agent Workflow |
| 类型 | 单个 Agent 拥有的内部工作结构 |

中文基准定义：

> Agent Workflow 描述一个 Agent 内部如何组织确定性步骤、开放式 Agent 行动、条件分支和结构化迭代。

边界：

- 每个 Agent 拥有自己的 Workflow；
- Agent Workflow 不描述多个 Journey Agent 之间的协作拓扑；
- 多 Agent 协作由 OdyJourney 层的 Pattern 表达；
- 首版使用完整名称 `Agent Workflow` 建立边界，避免一开始只写含义过宽的 Workflow。

## 3.7 Agent Action

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Agent Action；首次可写“开放式 Agent 行动（Agent Action）” |
| 英文正文 | Agent Action |
| 类型 | Agent Workflow 中的节点 |

中文基准定义：

> Agent Action 是 Agent Workflow 中承担开放式 LLM 推理与动态资源使用的一类节点。它只是 Agent 内部的一步，不是一个独立 Journey Agent。

必须明确的区别：

```text
Agent
└── 拥有完整 Agent Workflow

Agent Action
└── 是该 Workflow 内的一个节点
```

避免写法：

- 将 Agent Action 简写成 Agent，导致层级混淆；
- 宣称它的完整内部推理过程会在 Canvas 中可见；
- 把 Agent Action 描述为固定 Tool 调用序列。

## 3.8 Task

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Task；首次可写“确定性任务（Task）” |
| 英文正文 | Task |
| 类型 | Agent Workflow 中的节点 |

中文基准定义：

> Task 是 Agent Workflow 中执行预先配置步骤的确定性节点。它不负责开放式规划，其内部可以包含有序的 Tool 实例。

边界：

- Task 与 Agent Action 的主要区别是决策责任；
- Tool 不是独立 Workflow 节点；
- 首版只在解释“有边界的自主性”时按需使用。

## 3.9 Branch

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Branch；首次可写“条件分支（Branch）” |
| 英文正文 | Branch |
| 类型 | Agent Workflow 中的控制节点 |

中文基准定义：

> Branch 是根据明确条件在多个后续路径中选择一条路径的控制节点。

边界：

- Branch 负责显式路由，不等于 Agent 自己进行开放式规划；
- 首版不需要展开条件 schema 或完整执行规则。

## 3.10 Loop

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Loop；首次可写“结构化循环（Loop）” |
| 英文正文 | Loop |
| 类型 | Agent Workflow 中的复合控制节点 |

中文基准定义：

> Loop 是把迭代边界、内部子流程和退出条件显式封装起来的结构化循环节点。

边界：

- Loop 不等同于 Pattern 层的 Circular Loop；
- Loop 属于一个 Agent Workflow；
- Circular Loop 属于多个 Journey Agent 的协作拓扑；
- 首版不为 Loop 建立独立页面，除非论证确实需要。

## 3.11 Canvas

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Canvas；首次可写“画布（Canvas）” |
| 英文正文 | Canvas |
| 类型 | 空间化编辑与理解界面 |

中文基准定义：

> Canvas 是 Odyssey 用来呈现和编辑系统结构的空间界面。它是领域对象的一种视图，不是领域对象本身。

Canvas 可以呈现：

- 拓扑；
- 控制边界；
- 信息流；
- 资源关系；
- 显式决策位置。

Canvas 不承诺呈现：

- 模型完整的私有内部推理；
- 未记录的所有运行时判断；
- 与领域无关的任意像素布局即业务事实。

## 3.12 Journey Canvas

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Journey Canvas；首次可写“OdyJourney 层 Canvas（Journey Canvas）” |
| 英文正文 | Journey Canvas |
| Figma/页面对应 | Journey Editor 中的系统级 Canvas |

中文基准定义：

> Journey Canvas 呈现一个 OdyJourney 的系统级结构和 Agent 协作关系，帮助读者理解整体由哪些 Agent 位置构成、它们如何连接，以及正在查看哪个 Agent。

边界：

- 不在这里完整编辑 Agent 内部 Workflow；
- Agent Slot 可以提供只读 Workflow Preview；
- 进入内部细节时打开 Agent Workflow Canvas。

说明：当前 Figma 与实现资料中也使用 `System Canvas`。首版设计文章为突出双层关系，叙事上优先使用 `Journey Canvas`；引用具体 UI 标签或实现名称时可以注明 `System Canvas`。如果后续 UI 正式统一名称，应同步更新。

## 3.13 Agent Workflow Canvas

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Agent Workflow Canvas |
| 英文正文 | Agent Workflow Canvas |
| Figma/页面对应 | Agent Workflow Editor 的节点 Canvas |

中文基准定义：

> Agent Workflow Canvas 呈现和编辑单个 Agent 内部的 Workflow，包括行动节点、控制节点及其资源关系。

边界：

- 它属于一个 Agent；
- 不在这里自由修改多个 Agent 的 Pattern 拓扑；
- Agent Workflow 的结束去向可以由父级 Pattern 决定。

## 3.14 Workflow Preview

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Workflow Preview；首次可写“Workflow 只读预览” |
| 英文正文 | Workflow Preview / read-only workflow preview |
| 类型 | Journey Editor 中的临时 UI 状态 |

中文基准定义：

> Workflow Preview 是用户选中已配置 Agent Slot 后出现的只读缩略视图，用来在保留 Journey 上下文的同时预览该 Agent 的 Workflow，并提供进入完整 Agent Workflow Canvas 的入口。

边界：

- 它不是独立页面；
- 它不是独立后端实体；
- 它不是完整 Workflow 编辑器；
- `Open canvas` 才进入完整页面。

## 3.15 Flow Mode 与 Configure Mode

| 中文正文 | 英文正文 | 责任 |
| --- | --- | --- |
| Flow Mode | Flow mode | 强调拓扑、路径和整体执行结构 |
| Configure Mode | Configure mode | 强调节点内部配置与资源绑定 |

首版使用规则：

- 作为当前 Figma 对“结构理解”和“局部配置”分离的设计表达；
- 不把两种 Mode 写成两个领域模型；
- 是否已完整实现必须单独标注状态。

## 3.16 Thinking Ownership

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Thinking Ownership；首次写“思考责任（Thinking Ownership）” |
| 英文正文 | Thinking Ownership |
| 类型 | 设计原则，不是页面或运行时实体 |

中文基准定义：

> Thinking Ownership 用来讨论在一个系统结构中，哪些决定由人预先确定，哪些决定由 Agent 在明确边界内承担，以及两者如何通过显式状态和资源连接。

边界：

- 它不等同于模型内部推理可见；
- 当前设计仍使用绿色、黄色和红/粉色表达 User-managed、Shared 与 Agent-managed；System 使用中性灰；
- 三色 Thinking Ownership 一直是 Odyssey 的设计；
- 大块空间区域、节点、变量分组、文字标签和资源权限是同一原则在不同界面尺度上的表达；
- 不应把当前节点与变量分组写成对三色区域设计的替代或否定。

## 3.17 Bounded Autonomy

| 字段 | 内容 |
| --- | --- |
| 中文正文 | 有边界的自主性；首次附英文 `Bounded Autonomy` |
| 英文正文 | Bounded Autonomy |
| 类型 | 首版设计原则 |

中文基准定义：

> 有边界的自主性是指：人明确系统结构、资源范围和控制边界，Agent 在这些边界内承担开放式判断与行动。

避免写法：

- “完全自主”；
- “Agent 自己决定一切”；
- “所有推理都由用户控制”；
- 把自主性与确定性工作流写成二选一。

## 3.18 Knowledge Space

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Knowledge Space；首次可写“知识空间（Knowledge Space）” |
| 英文正文 | Knowledge Space |
| 类型 | 独立、持久化的 Workspace asset |

中文基准定义：

> Knowledge Space 是由用户可管理的文件结构和系统可维护的语义关系共同构成的持久知识环境。Agent 可以引用它，但它不隶属于某一个 Agent 或 OdyJourney。

首版重点：

- 文件树服务于人的文件组织；
- 知识图谱服务于语义关系和导航；
- Knowledge Space 可以被多个 Agent 引用；
- 它不仅是一次检索返回的片段集合。

避免写法：

- Knowledge Base，除非在引用历史设计或具体示例名称；
- 把 Knowledge Space 简化为向量数据库；
- 宣称自动 Knowledge Steward 已经实现。

## 3.19 Knowledge Family

| 字段 | 内容 |
| --- | --- |
| 中文正文 | Knowledge Family；首次可写“知识族群（Knowledge Family）” |
| 英文正文 | Knowledge Family |
| 类型 | Knowledge Space 中的语义图区域 |

中文基准定义：

> Knowledge Family 是 Knowledge Space 中语义上密切相关的一组文档节点，在界面中可以表现为图上的分组区域。

边界：

- 不等同于文件夹；
- 一个 Knowledge Space 可以包含多个 Knowledge Family；
- 它可能由知识标签和图关系共同形成；
- 自动生成和维护状态必须单独核验。

## 4. 首版有限提及的术语

这些术语可以在必要语境中出现，但首版不为它们建立独立概念章。

## 4.1 Tool

中文基准定义：

> Tool 是 Agent 或 Task 用来与外部能力、数据或确定性操作交互的可配置资源。

首版只表达稳定原则：

- Workflow 节点描述行动或控制语义；
- Tool 描述可被使用的能力；
- Tool 不作为独立 Workflow 节点铺满 Canvas。

首版暂不承诺：

- Tool Template、AgentReusableTool、Tool Instance 的完整公开分类；
- Tool 的跨 Agent 或跨 Workspace 复用范围；
- Community Tool 的当前可用性。

## 4.2 Input Guardrail 与 Output Guardrail

| 中文正文 | 英文正文 |
| --- | --- |
| Input Guardrail | Input Guardrail |
| Output Guardrail | Output Guardrail |

中文基准定义：

> Input Guardrail 和 Output Guardrail 是 OdyJourney 系统结构中位于主要 Execution 前后的可选模块，用于表达进入和离开主要执行过程时的检查或处理边界。

当前设计口径：

- 它们是可选模块；
- 启用后使用固定 Single Agent 结构；
- 不向用户提供 Pattern 选择；
- Guardrail Agent 复用正常的 Agent Workflow 模型。

首版处理：

- 只在解释系统级 Canvas 或 Figma 画面时必要提及；
- 不以 Guardrail 作为首版核心设计论点；
- 本文只解释其设计角色，不核验开发完成度。

## 4.3 Execution

中文基准定义：

> Execution 是 OdyJourney 中承载主要 Agent 协作结构的系统模块，其 Pattern 在创建 OdyJourney 时选择。

边界：

- Execution 模块不等同于一次 runtime execution/run；
- 中文正文需要根据上下文避免“执行”同时指模块和一次运行；
- 指模块时保留英文 `Execution`，指行为时使用普通中文“执行”。

## 4.4 Execution Behavior

中文基准定义：

> Execution Behavior 是用于表达跨越主要执行过程的策略、限制和可观察性责任的未来系统区域。

首版处理：

- 保留 Figma 中的结构位置；
- 明确标记为未来或尚未完成的设计；
- 不详细描述不存在的配置能力；
- 不把它与 Input/Output Guardrail 合并成同一个概念。

## 4.5 Workspace 与 Assets

| 术语 | 中文基准定义 |
| --- | --- |
| Workspace | Odyssey 中拥有 OdyJourney、Knowledge Space 等对象的工作范围；V1 为单一 Workspace，不需要把 Workspace 选择器写入首版叙事 |
| Assets | 顶层导航中的资源领域；V1 的主要公开 asset 是 Knowledge Space |

首版只在解释信息架构或 Knowledge Space 独立所有权时使用。

## 5. 设计内容类型

中文正文和英文版必须使用同一内容类型，不得在翻译中改变其设计性质。

| 内容类型 | 中文解释 | 不等于 |
| --- | --- | --- |
| `Current Design` | 当前采用的设计方向 | 已开发完成 |
| `Exploration` | 正在探索，尚未形成稳定决定 | Roadmap 承诺 |
| `Historical Design` | 用于解释演化的旧方案 | 当前界面 |
| `Deferred` | 当前范围明确不做或后置 | 永久取消 |

推荐中文展示：

- 当前设计（Current Design）
- 设计探索（Exploration）
- 历史设计（Historical Design）
- 已后置（Deferred）

页面只有当前设计时无需反复添加标签；历史、探索和后置内容必须明确标注。

## 6. 页面与交互术语

| 中文文档标准名 | 英文标准名 | 对象或状态 | 备注 |
| --- | --- | --- | --- |
| OdyJourney 列表 | Journey List | 页面 | 管理 OdyJourney，不称聊天历史 |
| OdyJourney 编辑器 | Journey Editor | 页面 | 编辑一个 OdyJourney 的系统级结构 |
| Agent Workflow 编辑器 | Agent Workflow Editor | 页面 | 编辑一个 Agent 的 Workflow |
| Knowledge Space 列表 | Knowledge Space List | 页面 | Assets 下的资源列表 |
| Knowledge Space 详情 | Knowledge Space Detail | 页面 | 文件树与知识图谱概览 |
| 文档详情 | Document Detail | 页面 | Knowledge Space 内的具体文档 |
| 文档检查器 | Document Inspector | 临时 UI 状态 | 不是独立页面 |
| Workflow 预览 | Workflow Preview | 临时 UI 状态 | 不是独立页面或实体 |
| Focus Mode | Focus Mode | 编辑器布局模式 | 不是独立页面 |
| Flow Mode | Flow mode | Canvas 查看模式 | 强调结构 |
| Configure Mode | Configure mode | Canvas 配置模式 | 强调局部配置 |

说明：英文 UI 的最终大小写以 Figma 当前标签为准；正文中的普通描述遵循英文语法，不需要机械复制按钮大小写。

## 7. 容易混淆的概念对照

### 7.1 OdyJourney、Run 与聊天

| 概念 | 是什么 | 不是什么 |
| --- | --- | --- |
| OdyJourney | 持久、可编辑的能力配置 | 一次执行、一段聊天 |
| Run | 某个能力的一次运行；首版不展开 | OdyJourney 本身 |
| Chat | 一种可能的交互方式 | Odyssey 的完整产品模型 |

### 7.2 Pattern 与 Agent Workflow

| Pattern | Agent Workflow |
| --- | --- |
| OdyJourney 层 | 单个 Agent 层 |
| 表达多个 Agent 如何协作 | 表达一个 Agent 内部如何工作 |
| 连接 Agent Slot | 包含 Agent Action、Task、Branch、Loop |
| 不展开 Agent 内部步骤 | 不自由修改多 Agent 协作拓扑 |

### 7.3 Agent 与 Agent Action

| Agent | Agent Action |
| --- | --- |
| 完整协作单元 | Workflow 节点 |
| 占据 Agent Slot | 位于 Agent Workflow 中 |
| 拥有 Workflow | 承担其中一步开放式行动 |

### 7.4 Circular Loop 与 Loop

| Circular Loop | Loop |
| --- | --- |
| Pattern 类型 | Workflow 节点 |
| 多个 Journey Agent 的循环协作 | 一个 Agent 内部的结构化迭代 |
| OdyJourney 层 | Agent Workflow 层 |

### 7.5 Knowledge Space 与文件夹

| Knowledge Space | 文件夹 |
| --- | --- |
| 持久知识环境 | 人的文件组织方式 |
| 同时包含文件结构和语义关系 | 不自动表达文档间语义关系 |
| 可被 Agent 引用 | 只是 Knowledge Space 中的一种组织结构 |

## 8. 首版避免或弃用的表达

| 避免表达 | 原因 | 推荐替代 |
| --- | --- | --- |
| System（作为最高层正式对象） | 与当前 OdyJourney 竞争 | OdyJourney |
| visible reasoning | 容易暗示私有推理可见 | visible and editable system structure |
| 展示 Agent 的思考过程 | 过度承诺 | 展示围绕 Agent 推理设计的结构和边界 |
| Diamond Loop | 旧语义容易误导 | Circular Loop |
| `diamond_loop`（公开文案） | 内部兼容键 | Circular Loop |
| Main Agent / Sub Agent（作为通用本体） | 把拓扑位置固化为永久类型 | Pattern position / Agent relationship |
| Knowledge Base（作为 Knowledge Space 同义词） | 容易退回文档库或 RAG 心智模型 | Knowledge Space |
| 无限 Canvas 能展示所有系统细节 | 混合抽象层且过度承诺 | Journey Canvas + Agent Workflow Canvas |
| 完全自主 Agent | 忽略结构和资源边界 | 有边界的自主性 |
| 当前支持 / 已可用 | 会把设计论证带向产品完成度 | 直接说明当前设计选择及边界 |

## 9. 中英术语对照表

| 中文基准写法 | 英文标准写法 |
| --- | --- |
| 可见、可编辑的系统结构 | visible and editable system structure |
| 设计可理解性 | design understandability |
| 结构可检查性 | structural inspectability |
| 运行可追踪性 | runtime traceability |
| 模型私有内部推理 | private internal model reasoning |
| 有边界的自主性 | bounded autonomy |
| 关系先于角色 | relationships before roles |
| 双层 Canvas | two-level Canvas |
| 渐进披露 | progressive disclosure |
| 系统级协作 | system-level cooperation |
| Agent 内部工作结构 | an Agent's internal work structure |
| 协作拓扑 | collaboration topology |
| 显式决策位置 | explicit decision position |
| 持久能力配置 | persistent capability configuration |
| 结构化迭代 | structured iteration |
| 知识环境 | knowledge environment |
| 语义关系 | semantic relationship |
| 设计演化 | design evolution |

## 10. 首次出现写法示例

### 10.1 双层 Canvas

> Odyssey 将系统级协作与单个 Agent 的内部工作结构放在两个 Canvas 层级：Journey Canvas 用来理解整个 OdyJourney 中 Agent 的关系，Agent Workflow Canvas 用来编辑其中一个 Agent 的内部 Workflow。

### 10.2 Thinking Ownership

> 思考责任（Thinking Ownership）讨论的是谁负责在行动前作出决定：哪些结构由人预先确定，哪些开放式判断交给 Agent，以及这些责任如何通过显式边界连接。

### 10.3 Knowledge Space

> Knowledge Space 是一种持久知识环境：文件树保留人的组织方式，知识图谱表达文档之间可供系统导航的语义关系。

### 10.4 Pattern

> 协作结构（Pattern）描述 Agent 如何占据位置、连接和传递工作。它不要求把 Planner 或 Reviewer 固化为不同的 Agent 类型。

## 11. 首版内容暴露范围

| 术语 | 首版位置 | 是否独立成章 |
| --- | --- | --- |
| Odyssey | 首页 / Why Odyssey | 否 |
| OdyJourney | 首页、双层 Canvas | 否 |
| Pattern | 关系先于角色 | 是，作为设计决定 |
| Agent | 多个页面按需 | 否 |
| Agent Workflow | 双层 Canvas | 否 |
| Agent Action / Task | 有边界的自主性 | 否 |
| Branch / Loop | 仅在必要示意中 | 否 |
| Journey Canvas / Agent Workflow Canvas | 双层 Canvas | 是，作为设计决定 |
| Thinking Ownership | 设计原则与演化 | 否 |
| Bounded Autonomy | 设计原则 | 是，作为设计决定 |
| Knowledge Space | Knowledge Space 不只是 RAG | 是，作为设计决定 |
| Knowledge Family | Knowledge Space 页面按需 | 否 |
| Tool | 有边界的自主性中有限提及 | 否 |
| Guardrails | Figma 系统结构图中按需 | 否 |
| Execution Behavior | 状态或未来限制中按需 | 否 |

## 12. 与现有材料的映射

| 术语领域 | 当前设计依据 | 当前产品/领域依据 |
| --- | --- | --- |
| OdyJourney 与页面层级 | Figma `247:33`、`59:2` | Figma Information Architecture |
| 双层 Canvas 与 Preview | Figma `59:2`、`62:2` | Figma Information Architecture §4.1–5.3 |
| Pattern 与 Slot | 当前 Pattern Figma frames | V1 Design Constraints §3–5；Circular Loop Decision |
| Agent Workflow 与节点 | Figma `62:2` 及其状态 frames | Canvas Execution Model；V1 Design Constraints §8 |
| Knowledge Space | Figma `147:44`、`157:2` | Knowledge Space Specification |
| Guardrail 与 Execution Behavior | 当前 Journey Editor Figma | 当前产品决定；本文不讨论开发进度 |

出现无法协调的冲突时，按照 `doc/foundations/documentation-source-of-truth.md` 暂停并向 River 确认。

## 13. 尚未冻结但不阻塞首版的问题

### 13.1 Tool 复用范围

问题：一个配置好的 Tool 是只能在一个 Agent Workflow 内复用，还是可以跨整个 Workspace 复用？

处理：首版只使用稳定的高层定义，不讨论存储 ownership。等 Tool 专题进入 Backlog 后再确认。

### 13.2 两份 Built-in Tool Specification

问题：当前产品目录同时存在带 `(V1)` 和不带 `(V1)` 的两份相近规范，哪一份代表当前版本？

处理：首版不引用其中任何一份作为完整 Tool 权威。等 Tool 专题开始时再确认替代关系。

### 13.3 Journey Canvas 与 System Canvas

问题：当前实现和部分 Figma 说明使用 `System Canvas`，而“双层 Canvas”公开叙事使用 `Journey Canvas` 更容易与 `Agent Workflow Canvas` 对照。

建议：

- 设计文章使用 `Journey Canvas` 表示抽象层；
- 引用当前 UI 或实现时注明 `System Canvas`；
- 后续如统一 UI 文案，由 River 确认最终产品标签。

此问题不会改变 OdyJourney 是公开顶层产品术语的决定。

## 14. ODOC-002 完成边界

本任务完成了：

- 冻结首版中文核心术语及英文对应；
- 明确 OdyJourney 与普通 system 的边界；
- 明确 Pattern、Agent、Agent Workflow、Agent Action 的层级；
- 明确 Circular Loop 与 Loop 的差异；
- 明确 Canvas 能展示与不能展示的内容；
- 明确 Thinking Ownership 和 Bounded Autonomy 的公开定义；
- 明确 Knowledge Space 与 Knowledge Family；
- 限制 Tool、Guardrail、Execution Behavior 的首版暴露范围；
- 建立首版避免用语和中英对照表。

本任务没有：

- 编写正式首版页面；
- 决定完整 Tool 领域 ownership；
- 验证所有 Figma 节点是否代表当前设计；
- 设计 Research Assistant 案例；
- 替代 `ODOC-003` 的旧文档可见性用语审计；
- 替代 `ODOC-004` 的状态证据标准。

## 15. Review 决定记录

> Reviewer: River  
> Review result: Approved  
> Recorded: 2026-09-16

1. 中文正文保留 `OdyJourney`、`Pattern`、`Agent`、`Canvas`、`Knowledge Space` 等英文产品专名。
2. `OdyJourney` 的公开定义采用“一个完整、可持续编辑的能力配置”。
3. 双层 Canvas 的公开叙事使用 `Journey Canvas` 与 `Agent Workflow Canvas`；引用当前 UI 或实现名称时注明 `System Canvas`。
4. 采用本文定义的 Pattern、Agent、Agent Workflow、Agent Action 层级。
5. 首版只有限提及 Tool、Guardrail 和 Execution Behavior，不为它们建立独立章节。
6. Tool 后续计划探索一种供用户开发 Tool 的轻量语言；该方向属于未来设计，不在首版中提前定义或承诺。
7. `Thinking Ownership` 首次写作“思考责任（Thinking Ownership）”。
8. `Bounded Autonomy` 的中文标准表达采用“有边界的自主性”。
