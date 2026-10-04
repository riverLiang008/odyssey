# 《为什么是双层 Canvas》样章命题与边界

> Status: Done  
> Task: ODOC-101  
> Language: Chinese source of truth  
> Updated: 2026-10-03  
> Review result: River approved the scope; current sample is preparing for independent cold-read acceptance.

## 1. 核心命题

当系统级协作与单个 Agent 的内部执行被放进同一张 Canvas，它们会争夺同一套视觉语法、编辑空间和注意力。

Odyssey 因此把设计拆成两个相互连接、但责任不同的层级：

- **Journey Canvas**：解释一个 OdyJourney 中有哪些协作位置、它们如何形成系统结构，以及哪些 Agent 被放进这些位置；
- **Agent Workflow Canvas**：解释一个具体 Agent 如何组织自己的 Action、Task、Branch、Loop 与资源引用。

双层设计不是为了增加页面，而是为了保护两个不同的问题：

1. “多个 Agent 如何组成一个系统？”
2. “其中一个 Agent 如何完成自己的工作？”

## 2. 样章要让读者带走什么

首次接触 Odyssey 的读者读完后，应能复述：

1. 一张无限 Canvas 为什么不等于一个清晰的系统表示；
2. Workflow Builder 在表达多 Agent 系统时为什么会遇到抽象层问题；
3. 系统协作与 Agent 内部执行为什么属于不同抽象层；
4. Journey Canvas 和 Agent Workflow Canvas 分别承担什么责任；
5. Agent Slot → Workflow Preview → Full Canvas 为什么是必要的渐进式进入；
6. 双层 Canvas 让哪些设计结构变得可检查；
7. 它没有展示模型的私有内部推理；
8. 这种分层带来了哪些导航与上下文切换成本。

## 3. 论证路径

```text
无限空间并不会自动带来清晰结构
→ Workflow Builder 的视觉语言不能自动等同于 Agent System 的视觉语言
→ 三色 Thinking Ownership 说明谁负责作出决定
→ 但责任颜色不能单独解决系统协作与 Agent 内部执行的尺度冲突
→ Odyssey 将它们拆成 Journey Canvas 与 Agent Workflow Canvas
→ Agent Slot、只读 Preview 和 Full Canvas 维持两层之间的连续性
→ 获得结构清晰度，同时承担导航和跨层理解成本
```

## 4. 当前设计事实

以下内容可以作为样章中的 `Current Design`：

- OdyJourney 是系统级设计对象；
- Journey Editor 中的 System Canvas 是 OdyJourney 的系统级设计表面；
- Pattern 定义协作拓扑和 Agent Slot，而不是给 Agent 固化永久角色；
- Agent Slot 表示 Agent 在 Pattern 中占据的稳定位置；领域模型和数据资料中也可能称为 `Pattern Slot`；
- 选择已配置 Agent Slot 后，Journey Canvas 右下角出现单一、只读的 Workflow Preview；
- Preview 用于保持方向感，不用于编辑节点；
- 通过 Preview 的 Open canvas/fullscreen 操作进入该 Agent 的完整 Workflow Canvas；
- Agent Workflow Canvas 属于一个具体 Agent，承载该 Agent 的工作流结构与资源配置；
- 返回 Journey Canvas 后，读者重新回到系统级协作结构。

公开叙事使用 `Journey Canvas`；当引用当前 Figma 界面文案时，可以注明 UI 中使用 `System Canvas`。

## 5. 样章必须讨论的代价

- 从 Journey 进入 Agent Workflow 会产生一次导航；
- 读者需要在系统拓扑与局部执行之间维持上下文；
- Preview 必须足够简洁，又不能丢失辨认 Workflow 所需的拓扑；
- 两层之间需要稳定的身份线索，例如 Journey、Agent 名称和返回路径；
- 如果跨层入口过多，分层本身会重新变成导航负担。

样章不能只把双层 Canvas 写成收益列表。

## 6. 明确不在样章中展开

- 四种 Pattern 的完整定义与差异；
- 全部 Workflow 节点规范；
- Tool 的数据模型与复用作用域；
- Guardrail 配置细节；
- Execution Behavior 的完整设计；
- Knowledge Space 的详细维护模型；
- Research Assistant 端到端案例；
- 开发完成度和工程验收状态；
- 模型私有 Chain of Thought；
- Coze、Dify 或其他产品的完整功能对比与优劣排名。

这些内容只有在帮助解释双层边界时才被简短提及。

## 7. 当前视觉证据

| 图 | 类型 | 主要论点 | 来源 |
| --- | --- | --- | --- |
| 1a | 当前设计标注 | Thinking Ownership 在 Agent Variables 中的分组表达 | Figma `119:2` |
| 1b | 当前设计组合 | 相同颜色语义贯穿实际节点、Node Palette 与 Agent Variables | Figma `166:2`、`62:2`、`119:2` |
| 2 | 当前设计标注 | Journey Canvas 表达系统结构、Agent Slot 与 Workflow Preview | Figma `59:2` |
| 3 | 当前设计 | 创建 OdyJourney 时先选择 System Pattern 的关系形状 | Figma `417:33` |
| 4 | 当前设计标注 | Agent Workflow Canvas 表达一个 Agent 的内部控制流与资源入口 | Figma `62:2` |

当前样章不依赖尚未完成的简化概念图。每组图片只承担一个主要论点；图 1a 与图 1b 作为同一论点的局部表达与跨对象证据共同出现。

Benchmark 不要求在样章中增加竞品截图。若后续核验发现一张带日期、可公开使用的裁切图能直接说明抽象层差异，可以作为旁注图加入；否则只链接独立 Benchmark 页面。

### Benchmark 使用边界

- 只比较可观察的设计表达，不推断团队动机；
- 记录产品、观察日期、入口和操作路径；
- 比较 Workflow、Agent、多 Agent 协作、连线语义、责任表达和资源归属；
- 不用“支持/不支持某功能”直接推出设计优劣；
- 不把 Coze 或 Dify 塑造成 Odyssey 的反例；
- 未完成实际核验前，样章中的对照只能标为待验证观察。

## 8. 写作语气

- 从设计矛盾出发，不从术语定义出发；
- 使用“我们选择”“这个决定换来了”“代价是”等设计论证语言；
- 不把 Odyssey 写成已经成熟的产品；
- 不宣称双层 Canvas 是普遍适用于所有 Agent 系统的答案；
- 不以“更强大”“革命性”“完全透明”等营销词替代具体判断；
- 不用实现细节打断设计主线。

## 9. 标题与摘要

推荐标题：

> 为什么是双层 Canvas

推荐副标题：

> 把“多个 Agent 如何协作”和“一个 Agent 如何工作”放在不同的设计尺度中。

推荐摘要：

> 无限画布提供空间，却不会自动提供层级。当系统协作与 Agent 内部执行共享同一套视觉语法时，结构会迅速失去可读性。Odyssey 用 Journey Canvas 与 Agent Workflow Canvas 分离这两个问题，再通过 Agent Slot 和只读 Preview 保持它们之间的连续性。

## 10. 设计来源

- 当前设计：Figma `OdyJourney — Resource Library Open`（`59:2`），核对日期 2026-09-21；
- 当前设计：Figma `Research Agent — Workflow Canvas`（`62:2`），结构关系由现有信息架构文档交叉核对；
- 当前设计：Figma `Agent Workflow Canvas — Agent Variables`（`119:2`），核对日期 2026-10-02；
- 当前设计：Figma `Agent Workflow Canvas — Focus Mode`（`166:2`），核对日期 2026-10-03；
- 当前设计：Figma `OdyJourney — Create Journey Modal`（`417:33`），核对日期 2026-10-03；
- 当前信息架构：`odyssey/doc/product/information-architecture/odyssey-figma-information-architecture.md`；
- 历史设计候选：`docs/public/images/canvas-regions.png`、`canvas-overview.png`、`system-arc.png`；
- 术语和表述：`doc/foundations/first-release-terminology.md`、`doc/foundations/visibility-language-guidelines.md`。

## 11. 已确认决定

1. 双层 Canvas 首先解决抽象层冲突，而不是单纯解决画布拥挤；
2. Journey Canvas 表达系统协作结构，而不仅是 Journey 的配置页面；
3. Agent Slot → Preview → Full Canvas 是两层之间的核心连接方式；
4. 导航成本和跨层上下文保持是本章必须承认的主要代价；
5. Pattern 只介绍其在双层结构中的作用，Tool、Guardrail、Knowledge Space 与 Pattern 的完整论证留给独立章节。
