# Odyssey HOW 002｜English Voiceover · Shot Segmentation V2 (Numbered Assets)

> **English voiceover version:** Spoken narration is translated into simple, natural English. Shot labels, asset IDs, production notes, and the asset tracker remain in Chinese for easy cross-reference with the Chinese master script. The original narration meaning and shot order are preserved.
> **Recording note:** Read only the English narration lines, not the shot labels or production notes.

> 在 V1 基础上仅增加素材编号与统计表；**不改动旁白**。编号表示待准备的素材，不表示已完成。
>
> 编号规则：`R` 真人原始拍摄片段；`M` 新 Motion（沿用原稿 M-01～M-09）；`SCR` 软件录屏；`FIG` Figma 截图/录屏；`SK` 草图；`GFX` 图标/静态视觉；`TXT` 文字卡；`EDIT` 蒙太奇剪辑。
> 每条镜头可引用多个素材；`R+M` 需要分别追踪真人与画面素材。镜头号沿用 V1，不作为素材编号。相同素材可以在多个镜头复用；当前编号按镜头需求初步拆分，制作时可合并。
> 进度状态建议：未开始 / 制作中 / 待审核 / 已完成。`M-08` 为选做，`M-09` 为推荐。

> 说明：保留原稿全部旁白及既有素材标记，只增加镜头段落标记；不代表素材已经制作。
> 【R】真人主画面；【M】素材主画面（细分新 Motion / Figma / 草图 / 录屏 / 文字卡）；【R+M】真人与素材同屏。
> 标记覆盖其后文字，直到下一条镜头标记；原稿中的素材提示行保持原样。

> 正文素材进度：`✔` = 已有交付；`✔（已覆盖）` = 由同镜头其他交付覆盖、免单独制作；`（待审校）` = 尚未完成审校。无标记表示待制作。

# 01 / Motivation

## 【R】Open

**▶ 镜头 005｜【R】开场，直接对镜头**  `素材：R-001 ✔`

I started Odyssey because I had some questions while trying different AI Agent tools.

**▶ 镜头 007｜【R+M】Claude Code / Codex 图标轻量叠加；无需专门动画**  `素材：R-002 ✔ + GFX-001 ✔（已覆盖）`

On one hand, agents like Claude Code and Codex can now handle more and more complex tasks on their own.

> 依次出现 Claude Code, Codex 图标辅助说明（应该不违反版权吧……？）

**▶ 镜头 011｜【R+M】真人小窗 + Agent 行为抽象 Motion（新增 M-08，选做）**  `素材：R-003 ✔ + M-08 ✔（已覆盖）`

But at the same time, we have less direct control over how they make decisions.

We can give them a goal. We can read their logs and step in when needed. But often, we don't know what they will do next, or why they make a certain choice.

> 【M】录制一段 AI 生成文字视频？或者制作一个 motion 表达 Agent 完成任务？—— 真人出镜在左上角/右下角。

**▶ 镜头 017｜【R】提出系统结构问题**  `素材：R-004 ✔`

So I started to wonder: if an Agent system needs to run for a long time, or if several Agents need to work together, do we still need a clearer system structure?

**▶ 镜头 019｜【R+M】Coze / Dify / Bedrock 图标叠加**  `素材：R-005 ✔ + GFX-002 ✔（已覆盖）`

On the other hand, I also looked at Agent workflow platforms, such as Coze, Dify, and Amazon Bedrock.

> 依次出现 Coze，Dify，Amazon Bedrock 这些图标（剪辑软件可以完成）。

**▶ 镜头 023｜【M｜录屏】Dify 现有产品界面演示，非新 Motion**  `素材：SCR-001 ✔`

These tools already have many useful features. We can build Workflows, set up Agents, connect external tools, and design complex systems.

> 录制一段 Dify 的使用视频（拖动节点到画布即可）

**▶ 镜头 027｜【R】对工具复杂度的观察与反思**  `素材：R-006 ✔`

But I slowly realized that more features don't always make a system easier to understand.

As more features are added, we also get more node types, settings, and concepts.

Sometimes, the hard part for me was not how to build a feature. It was understanding why the features were organized in that way.

**▶ 镜头 033｜【R】提出 Odyssey 的核心追问**  `素材：R-007 ✔`

So I began to ask myself:

What if we stopped adding new features for a moment, and looked again at how the existing features fit together?

Could we use a simpler set of ideas to make complex Agent systems easier to understand, design, and maintain?

**▶ 镜头 039｜【R】项目缘起与名称**  `素材：R-008 ✔`

That was the starting point of Odyssey.

And why did I call it Odyssey?

**▶ 镜头 043｜【R】奥德修斯故事和个人设计理念；可选静态插画/文字，不必新建 Motion**  `素材：R-009 ✔`

I've always liked the story of Odysseus.

I also came to believe that it's hard to design a complex system perfectly from the start.

We need to use it, find problems, and make changes based on what we learn.

So I didn't want Odyssey to be a piece of software with every feature decided in advance. I wanted it to grow through trying things, learning, and making changes.

**▶ 镜头 051｜【R】不确定性与过渡到草图**  `素材：R-010 ✔`

Of course, at the beginning, I had no idea what it would become.

I only had a few scattered ideas.

So I decided to draw them first.

# 02 / Start — From Ideas to Concepts

**▶ 镜头 059｜【R】章节开场**  `素材：R-011 ✔`

The first design of Odyssey started with a few simple questions.

**▶ 镜头 061｜【M｜文字卡】原稿已有黑底白字提示**  `素材：TXT-001`

【M】黑底白字，就下面一句话。

**▶ 镜头 063｜【M｜文字卡】第一个核心问题，延续前一文字卡**  `素材：TXT-002 ✔`

The first question was: how should we understand the overall structure of an Agent system?

【M】

**▶ 镜头 067｜【R+M】简化的配置分散示意；可用草图，不强制新 Motion**  `素材：R-012 ✔ + GFX-003 ✔（已覆盖）`

When we design an Agent Workflow, we usually focus on the steps it runs. But a full Agent system has much more than a Workflow. It also has Settings, Guardrails, and ways for different Agents to work together.

If all this information is spread across different pages and settings, it's hard to see the whole system clearly.

**▶ 镜头 071｜【M｜草图】SK-01，建议与接下来 M-01 连续**  `素材：M-01 ✔`

**[SK-01 · Pattern]**

**▶ 镜头 073｜【M｜新 Motion】M-01：Execution Module × Execution Behavior；包含二维关系和配置填充**  `素材：M-01 ✔`

So my first idea was to organize these settings in a simple two-dimensional layout, using rectangles.

The horizontal direction shows different Execution Modules. Inside each module, a Pattern connects Agents in a certain structure. The vertical direction shows Execution Behaviors, which apply across the system. The key difference is simple: an Execution Module, or Pattern, moves the system forward. An Execution Behavior does not move the system forward on its own.

**[M-01 · Execution Module × Execution Behavior]**

In this layout, I used solid colors to show which parts had already been configured.

**▶ 镜头 081｜【M｜Figma】UI-05 System Canvas Draft**  `素材：FIG-001 ✔`

**[UI-05 · Journey / System Canvas Draft]**

This way, we could see the parts of the system, and which parts were ready, in one place.

**▶ 镜头 085｜【R】Pattern 概念小结、转向 Workflow**  `素材：R-013 ✔`

I designed the idea of Patterns to show how different Agents work together.

But the overall system structure was only my first question.

Next, I started thinking about the Workflow itself.

**▶ 镜头 091｜【R+M】现有工具节点示例或草图，保持画面简单**  `素材：R-014 ✔（已覆盖） + GFX-004 ✔`

Some existing Agent platforms have many different types of Nodes. These nodes can do a lot, but users also have to learn many more concepts.

I wondered if we could use fewer Node types, and move some of the complexity into Tools instead.

**▶ 镜头 095｜【M｜草图】SK-05**  `素材：SK-001`

**[SK-05 · Workflow & Agent Actions]**

**▶ 镜头 097｜【M｜新 Motion】M-02 Workflow Node Taxonomy**  `素材：M-02 ✔`

So I tried dividing Workflow Nodes into two groups.

The first group is Logic Nodes, like Branch and Loop. They control the flow.

The second group is Action Nodes. They do the actual work.

Action Nodes can then be divided into Agent Nodes and Task Nodes.

**[M-02 · Workflow Node Taxonomy]**

**▶ 镜头 107｜【R+M｜新 Motion】M-03 Thinking Ownership: Agent vs Task，真人可小窗**  `素材：R-015 ✔（已覆盖） + M-03 ✔`

The biggest difference is what I call Thinking Ownership: who makes the decisions?

An Agent Node has some freedom to decide what to do, based on its goal.

A Task Node is more like a clear tool call. It follows an operation defined in advance.

**[M-03 · Thinking Ownership: Agent vs Task]**

**▶ 镜头 115｜【M｜Figma】UI-08 Workflow Focus Mode**  `素材：FIG-002 ✔`

This also means an LLM doesn't always need to be a separate top-level Node.

If we only want to call a language model once, we can treat it as a Tool used by another node.

**[UI-08 · Workflow / Focus Mode]**

**▶ 镜头 121｜【R】引出 Agent 的四项配置**  `素材：R-016 ✔`

Then I asked another question: what does an Agent Node really need?

In the end, I narrowed it down to four parts:

**▶ 镜头 125｜【M｜草图】SK-06**  `素材：SK-002`

Model, Goal, Knowledge Space, and ToolBox.

**[SK-06 · Agent Node / Early Design]**

**▶ 镜头 129｜【M｜新 Motion】M-04 Knowledge Space × ToolBox**  `素材：M-04 ✔`

Of these four, I especially wanted to separate Knowledge Space from ToolBox.

Knowledge Space organizes the knowledge, instructions, and text resources an Agent needs.

ToolBox organizes the tools an Agent can use, and the actions it can take.

Simply put, one is for knowing, and the other is for doing.

**[M-04 · Agent: Knowledge Space × ToolBox]**

**▶ 镜头 139｜【R】引出知识组织问题**  `素材：R-017 ✔`

But when I started designing Knowledge Space, I ran into another question.

If we store knowledge as separate documents, how should we show the links between them?

**▶ 镜头 143｜【R+M】文件夹与引用关系的静态示意，可合并到 M-05**  `素材：R-018 ✔ + M-05 ✔`

Folders are great for storing and managing files. But knowledge doesn't always fit into a folder tree.

One document may refer to several others. And documents may even refer back to each other.

**▶ 镜头 147｜【M｜草图】SK-08**  `素材：SK-003`

**[SK-08 · Knowledge Graph / Early Exploration]**

**▶ 镜头 149｜【M｜新 Motion】M-05 Folder Structure → Knowledge Graph**  `素材：M-05 ✔`

So I tried separating how knowledge is stored from how it is organized.

Documents could still live in normal folders. But their links and relationships could be shown as a directed graph.

In this graph, each Node is a document, and each Edge shows a relationship between documents.

We could also use Groups and Tags to organize related knowledge.

**[M-05 · Folder Structure → Knowledge Graph]**

This way, knowledge would not be just a set of separate files in folders. It could become a connected network.

**▶ 镜头 161｜【M｜Figma】UI-17 Knowledge Space Graph Overview**  `素材：FIG-003`

**[UI-17 · Knowledge Space / Graph Overview]**

**▶ 镜头 163｜【R+M｜新 Motion】M-06 Retrieval vs Graph Navigation，避免声称已实现**  `素材：R-019 ✔（已覆盖） + M-06 ✔`

This also made me think again about how we search for knowledge.

Methods like RAG can help us quickly find useful information. But if we only look at small pieces of text, we may miss the bigger picture and the links between them.

So I wanted Odyssey to explore another approach: an Agent could not only search for information, but also follow the links between documents.

Of course, this doesn't mean giving up RAG.

In Odyssey's design, RAG can still be a Tool. It can work together with navigation through the knowledge graph.

**[M-06 · Retrieval vs Graph Navigation]**

**▶ 镜头 175｜【R】对独立设计想法的回望**  `素材：R-020 ✔`

Looking back, these ideas started out as separate thoughts.

Some came from Workflow design. Some came from simplifying Agent settings. Others came from thinking about knowledge.

But over time, I realized they were all moving toward the same goal.

I wanted a complex Agent system to have more than just more and more features. I wanted a clear set of ideas to help organize those features.

**▶ 镜头 183｜【M｜新 Motion】M-07 Four Core Concepts**  `素材：M-07 ✔`

Patterns describe how Agents work together.

Workflows organize the steps and logic.

Knowledge Space manages knowledge resources.

ToolBox organizes the actions Agents can take.

**[M-07 · Four Core Concepts]**

**▶ 镜头 193｜【R】承认复杂性并过渡到界面设计**  `素材：R-021 ✔`

Of course, this doesn't make complexity disappear.

But maybe it can help us show that complexity in a clearer, easier way.

At this point, though, these were still just sketches and ideas.

The next question was: how could I turn them into interfaces people could actually use?

**▶ 镜头 201｜【M｜章节卡】Transition → 03 / Figma**  `素材：TXT-003 ✔`

**[Transition → 03 / Figma]**

# 03 / Figma — From Concepts to Interfaces

**▶ 镜头 206｜【R】Section 03 开场，讲学习经历**  `素材：R-022 ✔`

With these early ideas in mind, I started turning them into user interfaces.

But then I faced another problem.

I didn't have much experience designing interfaces in Figma.

At first, I wasn't even sure how to turn those abstract ideas into something people could actually use.

But then I realized I didn't need to become a professional UI designer first.

At least for now, I just needed a way to show my ideas clearly, and to keep changing and testing them.

**▶ 镜头 218｜【M｜Figma】早期草图与 Figma 设计稿切换；已有素材**  `素材：FIG-004 ✔`

So I started learning Figma while designing the Odyssey interface.

This felt very different from drawing my first sketches.

In a sketch, I could freely create concepts and connect them however I wanted.

**▶ 镜头 224｜【R+M｜Figma】展示 UI 层级、配置面板和页面导航；不需要新 Motion**  `素材：R-023 ✔（已覆盖） + FIG-005 ✔`

But once those concepts became real interfaces, I had to think about much more practical questions.

For example, how does a user open an Agent?

How should I organize different levels of information?

Which settings should be visible right away, and which should go on a separate page?

And how should users move between Workflow, Agent settings, and Knowledge Space?

**▶ 镜头 234｜【R】界面设计反过来影响概念设计**  `素材：R-024 ✔`

These were not just visual design questions.

They also made me rethink my original concepts.

**▶ 镜头 238｜【R+M｜Figma】Pattern 原方案与收敛方案对比；可用静态卡片**  `素材：R-025 ✔（已覆盖） + FIG-006 ✔`

One example was the design of Patterns.

At first, I wanted users to define any structure they liked for connecting different Agents.

But as I worked on the interface, I realized this freedom could make setup very complicated.

**▶ 镜头 244｜【M｜新 Motion】Pattern 从任意拓扑收敛为 Linear / Solo / Hub and Spoke / Circle（新增 M-09，推荐）**  `素材：M-09 ✔`

So I decided to make the design simpler.

Instead of asking users to build any structure from scratch, the system would offer a few ready-made Patterns: Linear, Solo, Hub and Spoke, and Circle.

This gave users a little less freedom, but made the system much easier to understand and set up.

**▶ 镜头 250｜【R】总结设计取舍**  `素材：R-026 ✔`

For me, this was an interesting lesson in design.

Sometimes, good design is not about giving people as many choices as possible. It's about deciding which choices they really need.

**▶ 镜头 254｜【M｜Figma】Workflow Canvas / 配置面板展示**  `素材：FIG-007 ✔`

I found similar problems in other parts of the interface.

For example, a Workflow needs more than a Canvas that shows its steps.

Users also need to move between different levels, check node settings, and know what they are editing.

**▶ 镜头 260｜【M｜Figma】Knowledge Space 文档管理与图谱页面**  `素材：FIG-008 ✔`

In the same way, Knowledge Space needs more than a graph of document links.

Users also need to manage documents, read their content, and understand how they fit into the bigger knowledge structure.

**▶ 镜头 264｜【R】Figma 是思考工具，不仅是绘图工具**  `素材：R-027 ✔`

These practical interface questions changed how I understood the system itself.

So for me, Figma was not just a tool for making interfaces look better.

It became a place where I could think through my ideas and improve the design.

**▶ 镜头 270｜【R+M｜Figma】迭代过程可用界面前后对比**  `素材：R-028 ✔ + FIG-009 ✔（已覆盖）`

Of course, I didn't finish these interfaces in one try.

Most of the time, I made a first version that showed the idea, then changed it as I found new problems.

**▶ 镜头 274｜【R】提问并过渡到代码**  `素材：R-029 ✔`

And as the Odyssey interface slowly took shape, another question came up.

Could I turn these designs into working software?

# 04 / Vibe Coding

**▶ 镜头 280｜【R】Section 04 开场：Vibe Coding**  `素材：R-030 ✔`

After finishing the first Figma designs, I started building the actual interfaces.

This time, I mainly used AI-assisted coding.

For me, it was a really interesting way to develop software.

**▶ 镜头 286｜【R+M｜录屏】真实开发环境、编辑器或代码片段，勿伪造实现过程**  `素材：R-031 ✔ + SCR-002 ✔（已覆盖）`

I could spend more time thinking about how the system should work, how its parts should fit together, and what users needed from the interface.

And I could use AI to help write the code.

**▶ 镜头 290｜【R】澄清 AI 辅助编程不等于自动完成**  `素材：R-032 ✔`

But of course, this didn't mean I could just describe an idea and let AI do everything else.

**▶ 镜头 292｜【R+M｜录屏】结合真实代码/配置展示设计问题**  `素材：R-033 ✔ + SCR-003 ✔（已覆盖）`

Often, the hardest part was finding out that my own design wasn't clear enough.

When an idea only existed in Figma, I could leave some details open.

But when I tried to turn it into software, I had to answer much more specific questions.

**▶ 镜头 298｜【M｜录屏】节点数据、Agent/Task 配置、Tool 输入输出和 Canvas 配置；已有软件录屏**  `素材：SCR-004 ✔`

For example, how should data move between nodes?

What should an Agent do, and what should a Task do?

How should we define the inputs and outputs of a Tool?

And how should the settings users create on the Canvas become data the system can understand?

**▶ 镜头 306｜【R】设计与实现相互修正的反思**  `素材：R-034 ✔`

This made me realize that moving from interface design to code is not just about copying a design.

It's also a process of filling in missing details and improving the design.

**▶ 镜头 310｜【R+M｜录屏】引出 Document Curator，切换到完整 Canvas**  `素材：R-035 ✔ + SCR-005 ✔（已覆盖）`

As the Odyssey editor started to take shape, I decided to design my first fairly complete example.

I called it Document Curator.

**▶ 镜头 314｜【M｜录屏】Document Curator 业务场景和整体 Workflow；可添加简单标注**  `素材：SCR-006 ✔`

The goal of this example is to help manage documents and knowledge links in a Knowledge Space.

For example, when a document changes, the system needs to understand the new content, check related documents, and decide whether summaries, tags, or document links may need updating.

**▶ 镜头 318｜【R】解释为何不能让 AI 自行决定所有修改**  `素材：R-036 ✔`

But there is a problem.

Not every change should be decided by AI alone.

Some changes are clear enough to handle automatically.

But others may involve uncertain information, conflicting evidence, or knowledge links that need a human to check.

**▶ 镜头 326｜【M｜录屏】展示 Solo Pattern 和完整 Workflow**  `素材：SCR-007 ✔`

So I wanted to design a Workflow where AI makes suggestions, instead of deciding every change by itself.

In Odyssey, I used a Solo Pattern.

That means this example uses just one Agent. It doesn't need several Agents working together.

**▶ 镜头 332｜【M｜录屏】依次聚焦 Read Document Context → Agent Action → Proposal**  `素材：SCR-008 ✔`

The Workflow starts with a Task.

First, it reads the changed document, along with the related context and rules.

Then the Workflow moves to an Agent Action.

This Agent has its own Model and Goal. It can also access Knowledge Space and use Toolbox to find related documents.

At this step, the Agent does not directly change the knowledge base.

Instead, it uses the documents, rules, and evidence it finds to suggest specific changes.

For example, it can suggest which metadata to update, which document links to add, and what evidence supports each suggestion.

**▶ 镜头 346｜【M｜录屏】聚焦 Validate Proposal Task 和校验配置**  `素材：SCR-009 ✔`

Next, the Workflow moves to another Task.

This Task checks the Agent's suggestions.

It checks whether the data format is correct, whether there is enough evidence, and whether the changes follow the rules.

**▶ 镜头 352｜【R+M｜录屏】强调 Agent 提案与独立验证的权限边界**  `素材：R-037 ✔（已覆盖） + SCR-010 ✔`

I separated this step from the Agent Action on purpose.

I didn't want the AI to suggest a change and then decide on its own whether that change should be approved.

**▶ 镜头 356｜【M｜录屏】聚焦 Branch 与 Apply / Review 两条路径；静态高亮即可**  `素材：SCR-011 ✔`

Next, a Branch chooses a path based on the check results.

If a change meets the rules for automatic handling, it goes to Apply Validated Changes.

If it needs more review, it goes to Save Review Proposal. The suggestion is saved for a person to check later.

**▶ 镜头 362｜【R+M｜录屏】回看完整 Canvas，归纳各节点职责**  `素材：R-038 ✔（已覆盖） + SCR-012 ✔`

So the whole process is divided into a few clear parts.

Agent Action handles work that needs understanding and judgment.

Task handles clear operations that follow set rules.

Branch controls which path the Workflow takes.

And Knowledge Space, ToolBox, and the variable system provide the information and data connections these steps need.

**▶ 镜头 372｜【R】案例设计的意义**  `素材：R-039 ✔`

For me, the most interesting part was seeing ideas from different design documents come together in one Workflow.

They were no longer just separate features or screens.

I could now use them to describe a real problem, and how the system should deal with it.

**▶ 镜头 378｜【M｜录屏】Canvas ↔ DSL 双向表达展示；只演示已验证功能**  `素材：SCR-013 ✔`

Besides the visual Canvas, I also designed a Domain-Specific Language, or DSL, for Odyssey.

This means the same Workflow can be set up through a visual interface, or described and edited as text.

The two forms can be converted into each other. Users can choose between a visual way of working and more precise text settings.

**▶ 镜头 384｜【R】明确案例是设计与配置验证，不是实际执行**  `素材：R-040 ✔`

But for now, Document Curator is still an example of design and configuration.

I can build the Workflow in the editor and check how its settings are represented. But the actual execution engine, external service connections, and the links between Agent outputs and later steps would still need more work.

So this example does not prove that Odyssey can run the whole process from start to finish.

**▶ 镜头 390｜【R+M｜录屏】回看 Canvas 或设计细节，收束案例**  `素材：R-041 ✔ + SCR-014 ✔（已覆盖）`

It's more like an early test of the design.

For the first time, I could put my ideas into a real example and see whether they worked together as a clear, consistent system.

At the same time, I found many questions I hadn't fully thought about before.

And those questions may help guide what I explore next in Odyssey.

# 05 / What's Next — An Ongoing Odyssey

**▶ 镜头 400｜【R】Section 05 开场，回望项目变化**  `素材：R-042 ✔`

Looking back, Odyssey is already a little different from what I first imagined.

At the beginning, I just had a few ideas about AI Agent systems.

I wanted to know if there was a clearer, more flexible way to organize Agents, their tools, and their knowledge.

**▶ 镜头 406｜【R+M｜蒙太奇】草图 → Figma → 代码 → Canvas；已有素材剪辑**  `素材：R-043 ✔ + EDIT-001 ✔（已覆盖）`

So I started drawing sketches, building concepts, learning Figma, and using AI-assisted coding to bring those ideas to life, step by step.

**▶ 镜头 408｜【R】设计演化与取舍**  `素材：R-044 ✔`

Along the way, many designs that seemed right at first began to change.

Some ideas stayed. Some became simpler. And some new questions only appeared after I started building things.

**▶ 镜头 412｜【M｜录屏】Odyssey 界面和 Document Curator 静态镜头**  `素材：SCR-015`

Now, Odyssey has its own interface, and I can use these concepts to describe a real example.

**▶ 镜头 414｜【R】项目边界与创作定位**  `素材：R-045 ✔`

Of course, there are still many things that could be better.

But I'm not in a hurry to turn it into a complete commercial product.

**▶ 镜头 418｜【R】开放式探索与个人感受**  `素材：R-046 ✔`

For me, Odyssey is more like an ongoing journey of discovery.

I want to see how far an idea that once existed only in my head can go.

**▶ 镜头 422｜【R+M｜蒙太奇】项目素材缓慢淡出，可选**  `素材：R-047 + EDIT-002`

Maybe I'll keep changing the design, try new examples, or find a completely different direction.

**▶ 镜头 424｜【R】结尾直视镜头，留出停顿**  `素材：R-048 ✔`

I don't know what will happen next.

But at least now, I've brought something that once lived only in my imagination into the real world.

And this journey isn't over yet.

# 附录｜素材制作登记表

> 2026-11-01 更新：[素材登记 CSV](./Odyssey_HOW002_Asset_Tracker.csv)。完成及覆盖 **89 / 97 项（91.8%）**：实际交付已完成 **72 项**，同镜头已覆盖免制作 **17 项**，待审校 **0 项**，未开始 **8 项**。

## 组合素材制作规则

用户已确认：同一镜头标有多个素材编号时，完成其中一个即可满足该镜头的素材需求，其余项记为“已覆盖（免单独制作）”，计入完成进度，但不声称其独立文件已制作。覆盖项的文件路径指向实际交付来源，备注说明来源编号。仅对正文明确组合的同镜头素材应用此规则，不跨相邻镜头扩散。

正文的 R+M、组合编号保留为原始方案；制作工作量与当前进度以本附录和CSV为准。此前说明中“相关素材不自动完成”仍适用于跨镜头项目；同镜头组合按此新规则处理。旁白原文不变。

## 登记表

| 素材编号 | 章节 | 镜头 | 类型 | 内容 | 状态 |
| --- | --- | --- | --- | --- | --- |
| TXT-004 | 01 | 章节01开场（005前） | 文字/章节卡 | 章节01标题卡：Motivation | ☑ 已完成 |
| R-001 | 01 | 005 | 真人拍摄 | 开场，直接对镜头 | ☑ 已完成 |
| R-002 | 01 | 007 | 真人拍摄 | Claude Code / Codex 图标轻量叠加；无需专门动画 | ☑ 已完成 |
| GFX-001 | 01 | 007 | 图标/静态图 | Claude Code / Codex 图标轻量叠加；无需专门动画 | ☑ 已覆盖（免单独制作） |
| R-003 | 01 | 011 | 真人拍摄 | 真人小窗 + Agent 行为抽象 Motion（新增 M-08，选做） | ☑ 已完成 |
| M-08 | 01 | 011 | 新制作 Motion | 真人小窗 + Agent 行为抽象 Motion（新增 M-08，选做） | ☑ 已覆盖（免单独制作） |
| R-004 | 01 | 017 | 真人拍摄 | 提出系统结构问题 | ☑ 已完成 |
| R-005 | 01 | 019 | 真人拍摄 | Coze / Dify / Bedrock 图标叠加 | ☑ 已完成 |
| GFX-002 | 01 | 019 | 图标/静态图 | Coze / Dify / Bedrock 图标叠加 | ☑ 已覆盖（免单独制作） |
| SCR-001 | 01 | 023 | 软件录屏 | Dify 现有产品界面演示，非新 Motion | ☑ 已完成 |
| R-006 | 01 | 027 | 真人拍摄 | 对工具复杂度的观察与反思 | ☑ 已完成 |
| R-007 | 01 | 033 | 真人拍摄 | 提出 Odyssey 的核心追问 | ☑ 已完成 |
| R-008 | 01 | 039 | 真人拍摄 | 项目缘起与名称 | ☑ 已完成 |
| R-009 | 01 | 043 | 真人拍摄 | 奥德修斯故事和个人设计理念；可选静态插画/文字，不必新建 Motion | ☑ 已完成 |
| R-010 | 01 | 051 | 真人拍摄 | 不确定性与过渡到草图 | ☑ 已完成 |
| TXT-005 | 02 | 章节02开场（059前） | 文字/章节卡 | 章节02标题卡：Start | ☑ 已完成 |
| R-011 | 02 | 059 | 真人拍摄 | 章节开场 | ☑ 已完成 |
| TXT-001 | 02 | 061 | 文字/章节卡 | 原稿已有黑底白字提示 | ☐ 未开始 |
| TXT-002 | 02 | 063 | 文字/章节卡 | 第一个核心问题，延续前一文字卡 | ☑ 已完成 |
| R-012 | 02 | 067 | 新制作 Motion | Workflow步骤 → 系统配置与协作 → 信息分散的全局视图问题（保留R-012编号） | ☑ 已完成 |
| GFX-003 | 02 | 067 | 图标/静态图 | 简化的配置分散示意；可用草图，不强制新 Motion | ☑ 已覆盖（免单独制作） |
| M-01 | 02 | 071 / 073 / 081 | 新制作 Motion | SK-01 → Execution Module × Execution Behavior → 配置状态与 UI-05 全景收束 | ☑ 已完成 |
| FIG-001 | 02 | 081 | Figma 素材 | UI-05 System Canvas Draft（已整合至 M-01 后半段） | ☑ 已完成 |
| R-013 | 02 | 085 | 真人拍摄 | Pattern 概念小结、转向 Workflow | ☑ 已完成 |
| R-014 | 02 | 091 | 真人拍摄 | 现有工具节点示例或草图，保持画面简单 | ☑ 已覆盖（免单独制作） |
| GFX-004 | 02 | 091 | 图标/静态图 | 现有工具节点示例或草图，保持画面简单 | ☑ 已完成 |
| SK-001 | 02 | 095 | 已有草图 | SK-05 | ☐ 未开始 |
| M-02 | 02 | 097 | 新制作 Motion | M-02 Workflow Node Taxonomy | ☑ 已完成 |
| R-015 | 02 | 107 | 真人拍摄 | M-03 Thinking Ownership: Agent vs Task，真人可小窗 | ☑ 已覆盖（免单独制作） |
| M-03 | 02 | 107 | 新制作 Motion | M-03 Thinking Ownership: Agent vs Task，真人可小窗 | ☑ 已完成 |
| FIG-002 | 02 | 115 | Figma 素材 | UI-08 Workflow Focus Mode | ☑ 已完成 |
| R-016 | 02 | 121 | 真人拍摄 | 引出 Agent 的四项配置 | ☑ 已完成 |
| SK-002 | 02 | 125 | 已有草图 | SK-06 | ☐ 未开始 |
| M-04 | 02 | 125 / 129 | 新制作 Motion | Agent 四项配置 → Knowledge Space × ToolBox（125 / 129 合并 Motion） | ☑ 已完成 |
| R-017 | 02 | 139 | 真人拍摄 | 引出知识组织问题 | ☑ 已完成 |
| R-018 | 02 | 143 | 真人拍摄 | 文件夹与引用关系的静态示意，可合并到 M-05 | ☑ 已完成 |
| M-05 | 02 | 149 | 新制作 Motion | M-05 文件存储与组织：文件夹 → 有向图 → Groups / Tags → 文档网络 | ☑ 已完成 |
| SK-003 | 02 | 147 | 已有草图 | SK-08 | ☐ 未开始 |
| FIG-003 | 02 | 161 | Figma 素材 | UI-17 Knowledge Space Graph Overview | ☐ 未开始 |
| R-019 | 02 | 163 | 真人拍摄 | M-06 Retrieval vs Graph Navigation，避免声称已实现 | ☑ 已覆盖（免单独制作） |
| M-06 | 02 | 163 | 新制作 Motion | M-06 Retrieval vs Graph Navigation，避免声称已实现 | ☑ 已完成 |
| R-020 | 02 | 175 | 真人拍摄 | 对独立设计想法的回望 | ☑ 已完成 |
| M-07 | 02 | 183 | 新制作 Motion | M-07 Four Core Concepts | ☑ 已完成 |
| R-021 | 02 | 193 | 真人拍摄 | 承认复杂性并过渡到界面设计 | ☑ 已完成 |
| TXT-003 | 02 | 201 | 文字/章节卡 | Transition → 03 / Figma | ☑ 已完成 |
| R-022 | 03 | 206 | 真人拍摄 | Section 03 开场，讲学习经历 | ☑ 已完成 |
| FIG-004 | 03 | 218 | Figma 素材 | 早期草图与 Figma 设计稿切换；已有素材 | ☑ 已完成 |
| R-023 | 03 | 224 | 真人拍摄 | 展示 UI 层级、配置面板和页面导航；不需要新 Motion | ☑ 已覆盖（免单独制作） |
| FIG-005 | 03 | 224 | Figma 素材 | 展示 UI 层级、配置面板和页面导航；不需要新 Motion | ☑ 已完成 |
| R-024 | 03 | 234 | 真人拍摄 | 界面设计反过来影响概念设计 | ☑ 已完成 |
| R-025 | 03 | 238 | 真人拍摄 | Pattern 原方案与收敛方案对比；可用静态卡片 | ☑ 已覆盖（免单独制作） |
| FIG-006 | 03 | 238 | Figma 素材 | Pattern 原方案与收敛方案对比；可用静态卡片 | ☑ 已完成 |
| M-09 | 03 | 244 | 新制作 Motion | Pattern 从任意拓扑收敛为 Linear / Solo / Hub and Spoke / Circle（新增 M-09，推荐） | ☑ 已完成 |
| R-026 | 03 | 250 | 真人拍摄 | 总结设计取舍 | ☑ 已完成 |
| FIG-007 | 03 | 254 | Figma 素材 | Workflow Canvas / 配置面板展示 | ☑ 已完成 |
| FIG-008 | 03 | 260 | Figma 素材 | Knowledge Space 文档管理与图谱页面 | ☑ 已完成 |
| R-027 | 03 | 264 | 真人拍摄 | Figma 是思考工具，不仅是绘图工具 | ☑ 已完成 |
| R-028 | 03 | 270 | 真人拍摄 | 迭代过程可用界面前后对比 | ☑ 已完成 |
| FIG-009 | 03 | 270 | Figma 素材 | 迭代过程可用界面前后对比 | ☑ 已覆盖（免单独制作） |
| R-029 | 03 | 274 | 真人拍摄 | 提问并过渡到代码 | ☑ 已完成 |
| TXT-006 | 04 | 章节04开场（280前） | 文字/章节卡 | 章节04标题卡：Vibe Coding | ☑ 已完成 |
| R-030 | 04 | 280 | 真人拍摄 | Section 04 开场：Vibe Coding | ☑ 已完成 |
| R-031 | 04 | 286 | 真人拍摄 | 真实开发环境、编辑器或代码片段，勿伪造实现过程 | ☑ 已完成 |
| SCR-002 | 04 | 286 | 软件录屏 | 真实开发环境、编辑器或代码片段，勿伪造实现过程 | ☑ 已覆盖（免单独制作） |
| R-032 | 04 | 290 | 真人拍摄 | 澄清 AI 辅助编程不等于自动完成 | ☑ 已完成 |
| R-033 | 04 | 292 | 真人拍摄 | 结合真实代码/配置展示设计问题 | ☑ 已完成 |
| SCR-003 | 04 | 292 | 软件录屏 | 结合真实代码/配置展示设计问题 | ☑ 已覆盖（免单独制作） |
| SCR-004 | 04 | 298 | 软件录屏 | 节点数据、Agent/Task 配置、Tool 输入输出和 Canvas 配置；已有软件录屏 | ☑ 已完成 |
| R-034 | 04 | 306 | 真人拍摄 | 设计与实现相互修正的反思 | ☑ 已完成 |
| R-035 | 04 | 310 | 真人拍摄 | 引出 Document Curator，切换到完整 Canvas | ☑ 已完成 |
| SCR-005 | 04 | 310 | 软件录屏 | 引出 Document Curator，切换到完整 Canvas | ☑ 已覆盖（免单独制作） |
| SCR-006 | 04 | 314 | 软件录屏 | Document Curator 业务场景和整体 Workflow；可添加简单标注 | ☑ 已完成 |
| R-036 | 04 | 318 | 真人拍摄 | 解释为何不能让 AI 自行决定所有修改 | ☑ 已完成 |
| SCR-007 | 04 | 326 | 软件录屏 | 展示 Solo Pattern 和完整 Workflow | ☑ 已完成 |
| SCR-008 | 04 | 332 | 软件录屏 | 依次聚焦 Read Document Context → Agent Action → Proposal | ☑ 已完成 |
| SCR-009 | 04 | 346 | 软件录屏 | 聚焦 Validate Proposal Task 和校验配置 | ☑ 已完成 |
| R-037 | 04 | 352 | 真人拍摄 | 强调 Agent 提案与独立验证的权限边界 | ☑ 已覆盖（免单独制作） |
| SCR-010 | 04 | 352 | 软件录屏 | 强调 Agent 提案与独立验证的权限边界 | ☑ 已完成 |
| SCR-011 | 04 | 356 | 软件录屏 | 聚焦 Branch 与 Apply / Review 两条路径；静态高亮即可 | ☑ 已完成 |
| R-038 | 04 | 362 | 真人拍摄 | 回看完整 Canvas，归纳各节点职责 | ☑ 已覆盖（免单独制作） |
| SCR-012 | 04 | 362 | 软件录屏 | 回看完整 Canvas，归纳各节点职责 | ☑ 已完成 |
| R-039 | 04 | 372 | 真人拍摄 | 案例设计的意义 | ☑ 已完成 |
| SCR-013 | 04 | 378 | 软件录屏 | Canvas ↔ DSL 双向表达展示；只演示已验证功能 | ☑ 已完成 |
| R-040 | 04 | 384 | 真人拍摄 | 明确案例是设计与配置验证，不是实际执行 | ☑ 已完成 |
| R-041 | 04 | 390 | 真人拍摄 | 回看 Canvas 或设计细节，收束案例 | ☑ 已完成 |
| SCR-014 | 04 | 390 | 软件录屏 | 回看 Canvas 或设计细节，收束案例 | ☑ 已覆盖（免单独制作） |
| TXT-007 | 05 | 章节05开场（400前） | 文字/章节卡 | 章节05标题卡：What's Next | ☑ 已完成 |
| R-042 | 05 | 400 | 真人拍摄 | Section 05 开场，回望项目变化 | ☑ 已完成 |
| R-043 | 05 | 406 | 真人拍摄 | 草图 → Figma → 代码 → Canvas；已有素材剪辑 | ☑ 已完成 |
| EDIT-001 | 05 | 406 | 剪辑蒙太奇 | 草图 → Figma → 代码 → Canvas；已有素材剪辑 | ☑ 已覆盖（免单独制作） |
| R-044 | 05 | 408 | 真人拍摄 | 设计演化与取舍 | ☑ 已完成 |
| SCR-015 | 05 | 412 | 软件录屏 | Odyssey 界面和 Document Curator 静态镜头 | ☐ 未开始 |
| R-045 | 05 | 414 | 真人拍摄 | 项目边界与创作定位 | ☑ 已完成 |
| R-046 | 05 | 418 | 真人拍摄 | 开放式探索与个人感受 | ☑ 已完成 |
| R-047 | 05 | 422 | 真人拍摄 | 项目素材缓慢淡出，可选 | ☐ 未开始 |
| EDIT-002 | 05 | 422 | 剪辑蒙太奇 | 项目素材缓慢淡出，可选 | ☐ 未开始 |
| R-048 | 05 | 424 | 真人拍摄 | 结尾直视镜头，留出停顿 | ☑ 已完成 |

## 数量统计

| 类型 | 总项 | 实际交付 | 覆盖免制作 | 完成及覆盖 | 待审校 | 未开始 |
| --- | --- | --- | --- | --- | --- | --- |
| 文字/章节卡 | 7 | 6 | 0 | 6 | 0 | 1 |
| 真人拍摄 | 47 | 39 | 7 | 46 | 0 | 1 |
| 图标/静态图 | 4 | 1 | 3 | 4 | 0 | 0 |
| 新制作 Motion | 10 | 9 | 1 | 10 | 0 | 0 |
| 软件录屏 | 15 | 10 | 4 | 14 | 0 | 1 |
| Figma 素材 | 9 | 7 | 1 | 8 | 0 | 1 |
| 已有草图 | 3 | 0 | 0 | 0 | 0 | 3 |
| 剪辑蒙太奇 | 2 | 0 | 1 | 1 | 0 | 1 |
| 合计 | 97 | 72 | 17 | 89 | 0 | 8 |

## 同镜头覆盖索引

| 免单独制作项 | 镜头 | 实际交付来源 |
| --- | --- | --- |
| GFX-001 | 007 | R-002 |
| M-08 | 011 | R-003 |
| GFX-002 | 019 | R-005 |
| GFX-003 | 067 | R-012 |
| R-014 | 091 | GFX-004 |
| R-015 | 107 | M-03 |
| R-019 | 163 | M-06 |
| R-023 | 224 | FIG-005 |
| R-025 | 238 | FIG-006 |
| FIG-009 | 270 | R-028 |
| SCR-002 | 286 | R-031 |
| SCR-003 | 292 | R-033 |
| SCR-005 | 310 | R-035 |
| R-037 | 352 | SCR-010 |
| R-038 | 362 | SCR-012 |
| SCR-014 | 390 | R-041 |
| EDIT-001 | 406 | R-043 |

## 实物交付索引

本次共194个文件：主目录58个，章节卡目录5个，temp 128个，development-icons透明图标3个。下表时长为实际容器读取结果。已完成为文件到位口径，保留既有验收记录；本轮未重新进行内容验收。

| 交付文件 | 实际交付登记项 | 时长（秒） |
| --- | --- | --- |
| [HOW001_FIG004.mp4](./materials/HOW001_FIG004.mp4) | FIG-004 | 26.238 |
| [HOW001_FIG005.mp4](./materials/HOW001_FIG005.mp4) | FIG-005 | 23.545 |
| [HOW001_FIG006.mp4](./materials/HOW001_FIG006.mp4) | FIG-006 | 20.619 |
| [HOW001_GFX004.mp4](./materials/HOW001_GFX004.mp4) | GFX-004 | 20.387 |
| [HOW001_M1.mp4](./materials/HOW001_M1.mp4) | M-01 / FIG-001 | 57.446 |
| [HOW001_M2.mp4](./materials/HOW001_M2.mp4) | M-02 | 24.149 |
| [HOW001_M3.mp4](./materials/HOW001_M3.mp4) | M-03 | 20.503 |
| [HOW001_M4.mp4](./materials/HOW001_M4.mp4) | M-04 | 32.136 |
| [HOW001_M5.mp4](./materials/HOW001_M5.mp4) | M-05 | 44.443 |
| [HOW001_M6.mp4](./materials/HOW001_M6.mp4) | M-06 | 46.718 |
| [HOW001_R012.mp4](./materials/HOW001_R012.mp4) | R-012 | 28.119 |
| [HOW001_R024.mp4](./materials/HOW001_R024.mp4) | R-024 | 10.402 |
| [HOW001_R10_R11.mp4](./materials/HOW001_R10_R11.mp4) | R-010 / R-011 | 20.944 |
| [HOW001_R13.mp4](./materials/HOW001_R13.mp4) | R-013 | 18.715 |
| [HOW001_R16.mp4](./materials/HOW001_R16.mp4) | R-016 | 11.215 |
| [HOW001_R17.mp4](./materials/HOW001_R17.mp4) | R-017 | 13.607 |
| [HOW001_R18.mp4](./materials/HOW001_R18.mp4) | R-018 | 19.783 |
| [HOW001_R1_R2.mp4](./materials/HOW001_R1_R2.mp4) | R-001 / R-002 | 22.871 |
| [HOW001_R20.mp4](./materials/HOW001_R20.mp4) | R-020 | 37.570 |
| [HOW001_R21.mp4](./materials/HOW001_R21.mp4) | R-021 | 29.954 |
| [HOW001_R22.mp4](./materials/HOW001_R22.mp4) | R-022 | 41.587 |
| [HOW001_R26.mp4](./materials/HOW001_R26.mp4) | R-026 | 19.388 |
| [HOW001_R27.mp4](./materials/HOW001_R27.mp4) | R-027 | 23.452 |
| [HOW001_R28_R29.mp4](./materials/HOW001_R28_R29.mp4) | R-028 / R-029 | 25.913 |
| [HOW001_R30.mp4](./materials/HOW001_R30.mp4) | R-030 | 8.847 |
| [HOW001_R31_R32_R33.mp4](./materials/HOW001_R31_R32_R33.mp4) | R-031 / R-032 / R-033 | 57.423 |
| [HOW001_R34_R35.mp4](./materials/HOW001_R34_R35.mp4) | R-034 / R-035 | 28.073 |
| [HOW001_R36.mp4](./materials/HOW001_R36.mp4) | R-036 | 22.779 |
| [HOW001_R39.mp4](./materials/HOW001_R39.mp4) | R-039 | 22.988 |
| [HOW001_R3_R4.mp4](./materials/HOW001_R3_R4.mp4) | R-003 / R-004 | 32.508 |
| [HOW001_R40.mp4](./materials/HOW001_R40.mp4) | R-040 | 25.286 |
| [HOW001_R41.mp4](./materials/HOW001_R41.mp4) | R-041 | 41.610 |
| [HOW001_R42.mp4](./materials/HOW001_R42.mp4) | R-042 | 26.308 |
| [HOW001_R43.mp4](./materials/HOW001_R43.mp4) | R-043 | 12.422 |
| [HOW001_R44.mp4](./materials/HOW001_R44.mp4) | R-044 | 19.087 |
| [HOW001_R45_R46.mp4](./materials/HOW001_R45_R46.mp4) | R-045 / R-046 | 29.884 |
| [HOW001_R48.mp4](./materials/HOW001_R48.mp4) | R-048 | 17.600 |
| [HOW001_R5.mp4](./materials/HOW001_R5.mp4) | R-005 | 9.334 |
| [HOW001_R6.mp4](./materials/HOW001_R6.mp4) | R-006 | 30.209 |
| [HOW001_R7.mp4](./materials/HOW001_R7.mp4) | R-007 | 25.356 |
| [HOW001_R8.mp4](./materials/HOW001_R8.mp4) | R-008 | 30.371 |
| [HOW001_R9.mp4](./materials/HOW001_R9.mp4) | R-009 | 15.952 |
| [HOW001_SCR004.mp4](./materials/HOW001_SCR004.mp4) | SCR-004 | 18.483 |
| [HOW001_SCR006.mp4](./materials/HOW001_SCR006.mp4) | SCR-006 | 22.686 |
| [HOW001_SCR007.mp4](./materials/HOW001_SCR007.mp4) | SCR-007 | 21.153 |
| [HOW001_SCR008.mp4](./materials/HOW001_SCR008.mp4) | SCR-008 | 51.037 |
| [HOW001_SCR009.mp4](./materials/HOW001_SCR009.mp4) | SCR-009 | 16.718 |
| [HOW001_SCR012.mp4](./materials/HOW001_SCR012.mp4) | SCR-012 | 26.819 |
| [HOW001_SCR013.mp4](./materials/HOW001_SCR013.mp4) | SCR-013 | 28.305 |
| [HOW001_SCR10_SCR11.mp4](./materials/HOW001_SCR10_SCR11.mp4) | SCR-010 / SCR-011 | 37.314 |
| [HOW001_SCR_001.mp4](./materials/HOW001_SCR_001.mp4) | SCR-001 | 12.515 |
| [HOW001_TXT-002_word_reveal.mp4](./materials/HOW001_TXT-002_word_reveal.mp4) | TXT-002 | 7.573 |
| [01_motivation.mp4](./materials/Odyssey_Chapter_Transitions/01_motivation.mp4) | TXT-004 | 2.200 |
| [02_start.mp4](./materials/Odyssey_Chapter_Transitions/02_start.mp4) | TXT-005 | 2.200 |
| [03_figma.mp4](./materials/Odyssey_Chapter_Transitions/03_figma.mp4) | TXT-003 | 2.200 |
| [04_vibe_coding.mp4](./materials/Odyssey_Chapter_Transitions/04_vibe_coding.mp4) | TXT-006 | 2.200 |
| [05_whats_next.mp4](./materials/Odyssey_Chapter_Transitions/05_whats_next.mp4) | TXT-007 | 2.200 |

合并文件如R34/R35、SCR10/SCR11对应多个登记项，剪辑勿重复整段使用。R48已更正原误命名R45；R45/R46仍使用合并文件。FIG-001复用M-01后半段。TXT-001正文提示卡不能由Start章节标题卡替代。

## 2026-11-01 新增 Motion 交付

以下为正式目录新增成片；均已核对文件存在与媒体时长，原有目录盘点数字为上轮快照。片尾不增加97项基数。

| 文件 | 登记项 | 容器时长（秒） |
| --- | --- | --- |
| [HOW001-M07.mp4](./materials/HOW001-M07.mp4) | M-07 | 17.067 |
| [HOW001_M9.mp4](./materials/HOW001_M9.mp4) | M-09 | 29.350 |
| [HOW001_FIG002.mp4](./materials/HOW001_FIG002.mp4) | FIG-002 | 17.345 |
| [HOW001_FIG007_FIG008.mp4](./materials/HOW001_FIG007_FIG008.mp4) | FIG-007 / FIG-008 | 40.820 |
| [HOW001_Odyssey_Outro_v01.mp4](./materials/HOW001_Odyssey_Outro_v01.mp4) | 片尾补充素材 | 5.500 |

FIG-007/008剪辑时按21.36秒附近的主题切换定位，勿重复使用整段。

## 补充设计图片

以下为新增设计示意素材，不额外增加97项登记基数，也不自动替代其他镜头。模拟提案和流程图均不代表实际执行结果。

| 文件 | 用途 |
| --- | --- |
| [HOW001_Design_Concept_Notice_v01.png](./materials/HOW001_Design_Concept_Notice_v01.png) | 执行引擎尚未实现的设计说明牌 |
| [HOW001_Document_Curator_Simulated_Proposal_v01.png](./materials/HOW001_Document_Curator_Simulated_Proposal_v01.png) | metadata、文档链接与证据的模拟建议界面 |
| [HOW001_Early_Ideas_Exploration_v01.png](./materials/HOW001_Early_Ideas_Exploration_v01.png) | 补充图片 |
| [HOW001_Early_Ideas_Ordered_v01.png](./materials/HOW001_Early_Ideas_Ordered_v01.png) | 补充图片 |
| [HOW001_Early_Ideas_Reflection_v01.png](./materials/HOW001_Early_Ideas_Reflection_v01.png) | 补充图片 |
| [HOW001_Proposal_Approval_Separation_v01.png](./materials/HOW001_Proposal_Approval_Separation_v01.png) | 提案与独立校验分离的概念图 |

## 待补与临时素材

GFX-004已由用户确认完成，镜头091的R-014由其覆盖，免单独制作。SCR-012和SCR-013已交付；镜头362由SCR-012覆盖，R-038免单独制作。

FIG-002、M-07、M-09、FIG-007与FIG-008已交付Motion成片；FIG-007/008共用合并文件。FIG-003仍需准备，原图或录音不自动等于最终交付。

| 扩展名 | 临时文件数 | 文件 |
| --- | --- | --- |
| .m4a | 49 | `HOW001-FIG004.m4a`、`HOW001-FIG005.m4a`、`HOW001-FIG006.m4a`、`HOW001-GFX004.m4a`、`HOW001-R024.m4a`、`HOW001-R034.m4a`、`HOW001-R043.m4a`、`HOW001-R1.m4a`、`HOW001-R10.m4a`、`HOW001-R13.m4a`、`HOW001-R16.m4a`、`HOW001-R17.m4a`、`HOW001-R18.m4a`、`HOW001-R2.m4a`、`HOW001-R20.m4a`、`HOW001-R21.m4a`、`HOW001-R22.m4a`、`HOW001-R26.m4a`、`HOW001-R27.m4a`、`HOW001-R28-R29.m4a`、`HOW001-R30.m4a`、`HOW001-R31-R32-R33.m4a`、`HOW001-R35.m4a`、`HOW001-R36.m4a`、`HOW001-R39.m4a`、`HOW001-R40-1.m4a`、`HOW001-R40.m4a`、`HOW001-R41.m4a`、`HOW001-R42.m4a`、`HOW001-R44.m4a`、`HOW001-R45-R46.m4a`、`HOW001-R48.m4a`、`HOW001-R5.m4a`、`HOW001-R6.m4a`、`HOW001-R7-1.m4a`、`HOW001-R7-2.m4a`、`HOW001-R7.m4a`、`HOW001-R8.m4a`、`HOW001-R9.m4a`、`how001-scr-001-2.m4a`、`HOW001-SCR004.m4a`、`HOW001-SCR006.m4a`、`HOW001-SCR007.m4a`、`HOW001-SCR008.m4a`、`HOW001-SCR009.m4a`、`HOW001-SCR010.m4a`、`HOW001-SCR011.m4a`、`HOW001-SCR012.m4a`、`HOW001-SCR013.m4a` |
| .mp4 | 64 | `FIG004-2.mp4`、`FIG004.mp4`、`FIG005.mp4`、`FIG006.mp4`、`GFX-004.mp4`、`GFX004-2.mp4`、`HOW001-R7-motion.mp4`、`motion-001-v2-review.mp4`、`MVI_6979.MP4`、`MVI_6980.MP4`、`MVI_6981.MP4`、`MVI_6983.MP4`、`R10.MP4`、`R13.MP4`、`R16.MP4`、`R17.MP4`、`R18.MP4`、`R20.MP4`、`R21.MP4`、`R22-1.MP4`、`R22-2.mp4`、`R24.MP4`、`R26.MP4`、`R27.MP4`、`R28.MP4`、`R29.MP4`、`R30.MP4`、`R31-1.mp4`、`R31-2.mp4`、`R31-3.mp4`、`R31-4.mp4`、`R31-5.mp4`、`R31-6.mp4`、`R31-7.mp4`、`R31.MP4`、`R34.mp4`、`R35-2.mp4`、`R35.MP4`、`R36.MP4`、`R39.MP4`、`R40-1.mp4`、`R40.MP4`、`R41.MP4`、`R42.MP4`、`R43.mp4`、`R44.MP4`、`R45-R46.MP4`、`R48.MP4`、`R7.MP4`、`R8.MP4`、`R9.MP4`、`SCR004.mp4`、`SCR005.mp4`、`SCR006-1.mp4`、`SCR006-2.mp4`、`SCR007-1.mp4`、`SCR007-2.mp4`、`SCR008-1.mp4`、`SCR008-2.mp4`、`SCR009.mp4`、`SCR011.mp4`、`SCR012.mp4`、`SCR013.mp4`、`TXT-002.mp4` |
| .png | 12 | `FIGMA_FINISH.png`、`odyssey.png`、`R013-Create Modal.png`、`R40-1 (1).png`、`R40-1 (2).png`、`R40-1 (3).png`、`R42-1.png`、`R42-2.png`、`R42.png`、`SCR008-1.png`、`SCR008-2.png`、`SCR010.png` |
| .srt | 3 | `HOW001-R1.srt`、`HOW001-R7-2.srt`、`how001-scr-001-2.srt` |

## 剩余制作项

TXT-001、SK-001、SK-002、SK-003、FIG-003、SCR-015、R-047、EDIT-002。

以上8项尚无正式交付或同镜头覆盖依据；如剪辑中已删除、合并或用其他画面替代，应明确登记替代关系。
