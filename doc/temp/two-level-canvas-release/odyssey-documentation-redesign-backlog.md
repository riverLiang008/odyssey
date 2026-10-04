# Odyssey 设计文档改版 Backlog

> Status: Active  
> Created: 2026-09-14  
> Scope: `odyssey-architecture` 首版设计文档、样章、旧内容迁移、事实核验与后续案例接入  
> Related proposal: `doc/planning/odyssey-architecture-documentation-redesign-proposal.md`

## 1. 目标

将现有 Odyssey 架构文档从不完整的“概念百科”，逐步改造成一套可独立阅读的 AI Agent 系统设计论证。

首版重点解释：

- Odyssey 想解决什么设计问题；
- 为什么需要可见、可编辑的 Agent 系统结构；
- 为什么采用双层 Canvas；
- 为什么 Pattern 强调关系而不是预设角色；
- 为什么确定性结构与 Agent 自主性需要共存；
- 为什么 Knowledge Space 不只是 RAG；
- 这些设计目前处于什么状态，又有哪些限制。

首版不依赖完整的 Research Assistant 案例。当前尚未完成案例设计，因此不得为了文档叙事虚构端到端产品流程。案例设计与接入属于后续独立 Epic。

## 2. 工作原则

### 2.1 先验证一篇，再扩整站

第一份正式交付是《为什么是双层 Canvas》图文样章。只有样章通过内容、事实与视觉评审，才按照相同标准扩展首版。

### 2.2 只写能够证明的内容

关键设计结论必须能够回到当前 Figma、River 的确认或明确的历史材料。

设计内容按用途区分为：

- `Current Design`：当前采用的设计；
- `Exploration`：尚未成为当前结论的设计探索；
- `Historical Design`：用于解释演化的历史设计；
- `Deferred`：明确不在当前文档版本展开的内容。

本套文档不以开发完成度为组织维度。只有当 Figma 画面可能被严重误解为可操作产品时，才局部说明本文不讨论开发进度。

### 2.3 不宣称模型内部推理可见

统一使用“可见、可编辑的系统结构”，具体包括：

- 系统拓扑；
- 控制流和信息流；
- 资源访问；
- 自主权边界；
- 显式决策位置；
- 持久化配置和知识关系。

不得将其写成完整模型内部推理或 Chain of Thought 可见。

### 2.4 图像承担不同责任

| 图像类型 | 责任 |
| --- | --- |
| 简化概念图 | 解释为什么需要某个设计决定 |
| 当前 Figma 裁切图 | 证明决定如何落实为界面和交互 |
| 旧设计图与当前设计并置 | 解释设计如何演化及为什么变化 |

### 2.5 完成度优先于目录规模

未完成页面不得进入公开导航。长期内容地图不是首版交付承诺。

### 2.6 中文先行，双语发布

中文版是内容设计和产品事实 Review 的基准版本。所有正式内容遵循：

```text
中文初稿
→ 中文内容与事实 Review
→ 中文定稿
→ 英文翻译与表达优化
→ 双语一致性检查
→ 同步发布
```

执行规则：

- 中文未定稿时，不启动对应英文正文；
- 英文版应自然表达，但不得新增、删除或改变设计结论；
- 中英文页面路径、标题层级、图号、Figma 节点、设计内容类型和引用一一对应；
- 中文定稿发生实质修改后，对应英文页面重新进入待同步状态；
- 英文尚未完成时明确显示翻译状态，不保留内容已经过期的英文版本；
- 语言切换应尽量跳转到对应页面，而不是语言首页；
- 文档工作目录为 `C:\Users\13067\River\projectWorkPlace\odysseyDesign\odyssey-architecture`；双语站点内容计划放在 `docs/zh` 与 `docs/en`。

## 3. 状态与优先级

### 3.1 工作状态

| 状态 | 含义 |
| --- | --- |
| `Todo` | 尚未开始 |
| `In Progress` | 正在执行 |
| `Review` | 已有交付物，等待评审 |
| `Blocked` | 缺少必要事实、素材或决策 |
| `Done` | 已满足验收标准 |

### 3.2 优先级

| 优先级 | 含义 |
| --- | --- |
| `P0` | 阻塞首版或后续全部工作 |
| `P1` | 首版必须完成 |
| `P2` | 首版完成后优先处理 |
| `P3` | Future 内容 |

## 4. 里程碑

| Milestone   | 目标                | 完成条件            | 状态         |
| ----------- | ----------------- | --------------- | ---------- |
| M0 — 基线冻结   | 建立术语、来源和内容类型规则   | P0 基线任务全部完成     | `Done`     |
| M1 — 样章     | 完成《为什么是双层 Canvas》 | 样章通过三类评审        | `Done`     |
| M2 — 写作标准   | 冻结后续页面的写作与视觉标准    | 标准由样章验证并记录      | `Todo`     |
| M3 — 首版内容   | 完成不依赖案例的核心叙事      | 首版页面全部达到 Review | `Todo`     |
| M4 — 站点迁移   | 重构导航并迁移旧内容        | 构建通过，无公开空页面     | `Todo`     |
| M5 — 双语发布准备 | 中文定稿、英文同步并完成事实与视觉核验 | 双语发布清单全部通过 | `Todo` |
| M6 — 案例设计   | 设计并验证最小案例         | 案例设计获得独立确认      | `Deferred` |
| M7 — 案例接入   | 将成熟案例加入文档         | 案例页面通过事实核验      | `Deferred` |

## 5. Epic 0 — 基线、术语与证据

### ODOC-001 建立权威信息源清单

- Priority: `P0`
- Status: `Done`
- Dependencies: None

Review record:

- Submitted: 2026-09-14
- Reviewed by: River
- Review result: Approved on 2026-09-14
- Deliverable: `doc/foundations/documentation-source-of-truth.md`
- Summary: 已建立按信息类型选择来源的规则、核心来源清单、Figma 证据边界、冲突处理规则、已知冲突登记和双语同步规则。
- Decisions: 当前产品设计意图以 Figma 为准；代码用于判断实现进度；冲突时暂停并向 River 确认；公开顶层术语采用 `OdyJourney`。
- Deferred items: Tool 可在 Agent Workflow 内还是 Workspace 范围复用，以及两份 Built-in Tool Specification 哪份为当前版本，均不阻塞首版，延后到 Tool 专题。

目的：明确每类公开陈述应以什么材料为准。

工作：

- 列出产品定位、领域模型、当前交互、历史设计和设计探索的权威来源；
- 为来源记录路径、用途、更新时间和是否可能过期；
- 明确 Figma、当前代码、产品规范和历史文档发生冲突时的处理顺序；
- 记录需要产品确认而不能从仓库推断的问题。

交付物：

- `doc/foundations/documentation-source-of-truth.md`，或本 Backlog 中经确认的权威来源表。

验收标准：

- 每种信息至少有一个明确来源；
- 历史设想不会被误作当前事实；
- Figma 不会被误作实现完成证明；
- 无法确认的内容进入待决问题清单。

### ODOC-002 冻结首版术语

- Priority: `P0`
- Status: `Done`
- Dependencies: ODOC-001

Review record:

- Submitted: 2026-09-14
- Reviewed by: River
- Review result: Approved; recorded on 2026-09-16
- Deliverable: `doc/foundations/first-release-terminology.md`
- Summary: 已建立中文语义基准、英文对应、核心概念层级、页面/交互术语、状态术语、首版暴露范围和避免用语。
- Decisions: 接受全部首版术语建议；采用 `Journey Canvas` / `Agent Workflow Canvas` 的公开叙事，并在引用当前 UI 时注明 `System Canvas`。
- Future note: Tool 后续计划探索一种供用户开发 Tool 的轻量语言；不纳入首版定义或承诺。

工作：

- 确认 `OdyJourney` 与一般性 `System` 的使用边界；
- 确认 Pattern、Agent、Agent Workflow、Agent Action、Task、Knowledge Space 的公开定义；
- 使用 `Circular Loop` 作为公开名称，避免把兼容键 `diamond_loop` 当作产品名称；
- 确认 Guardrail、Execution Behavior 和 Tool 相关词汇在首版中的暴露程度；
- 建立受控的中英术语表；中文定义是语义基准，英文术语是对应的公开表达。

交付物：

- 首版术语表。

验收标准：

- 同一个概念没有多个互相竞争的公开名称；
- Agent 与 Agent Action 不会混用；
- 术语表注明哪些是领域名、UI 名和内部兼容键。

### ODOC-003 冻结“可见性”表述

- Priority: `P0`
- Status: `Done`
- Dependencies: ODOC-001

Review record:

- Submitted: 2026-09-16
- Reviewed by: River
- Review result: Approved; recorded on 2026-09-21
- Deliverable: `doc/foundations/visibility-language-guidelines.md`
- Summary: 已冻结四层可理解性、推荐/限定/禁用表达、中英对照、Thinking Ownership 与 Explainability 使用边界，并完成六份旧公开文档的逐文件审计。
- Decisions: 全部建议获批准；旧文档 P0/P1 审计结果作为后续改写依据。

建议口径：

> Odyssey 不会让模型的私有内部推理完全可见。它让围绕 Agent 推理而设计的系统结构变得可见、可编辑。

工作：

- 区分设计可理解性、结构可检查性、运行可追踪性和模型内部推理；
- 建立禁止使用或需要限定的表达；
- 检查旧文档中 `visible reasoning`、`explainability` 等表述。

验收标准：

- 不暗示公开 Chain of Thought；
- 不把设计结构等同于真实运行轨迹；
- 样章和首版页面采用同一口径。

### ODOC-004 建立设计内容类型和来源标注规则

- Priority: `P0`
- Status: `Done`
- Dependencies: ODOC-001

Review record:

- Submitted: 2026-09-21
- Reviewed by: River
- Review result: Approved on 2026-09-21
- Deliverable: `doc/foundations/status-and-evidence-guidelines.md`
- Summary: 已将原先偏工程验收的状态体系收缩为设计文档规则，定义当前设计、设计探索、历史设计和已后置内容的使用边界、图像职责、来源记录与冲突处理方式。
- Decision: 正文默认只讲设计，不以开发完成度为组织维度；采用四种设计内容类型，取消独立实现状态核验。M0 基线冻结完成。

工作：

- 定义四种设计内容类型的判断标准；
- 规定当前 Figma、历史图、概念图和探索图各自承担的责任；
- 建立轻量的来源记录与局部 Callout 模板；
- 明确开发完成度不属于设计正文的组织维度。

验收标准：

- 当前设计结论能够追溯到 Figma 或 River 的确认；
- 历史设计、当前设计与探索方向不会混用；
- `Exploration` 与 `Deferred` 的边界明确；
- 正文不会退化成功能完成度报告。

## 6. Epic 1 — 《为什么是双层 Canvas》样章

### ODOC-101 冻结样章命题与边界

- Priority: `P0`
- Status: `Done`
- Dependencies: ODOC-002, ODOC-003

Review record:

- Submitted: 2026-09-21
- Deliverable: `doc/samples/two-level-canvas/double-layer-canvas-sample-scope.md`
- Companion working draft: `doc/samples/two-level-canvas/why-two-level-canvas.zh.md`
- Summary: 已冻结核心命题、读者应带走的理解、论证路径、当前设计事实、主要代价与排除范围；River 已确认全部范围问题。
- Review result: Approved；样章最终采用五组当前设计视觉证据，不再依赖历史图或额外概念图。

样章必须回答：

- 为什么一张无限 Canvas 会混合不同抽象层；
- Journey Canvas 表达什么；
- Agent Workflow Canvas 表达什么；
- 为什么需要 Agent Slot → Preview → Full Canvas；
- 哪些系统结构因此变得可理解；
- 哪些模型内部过程仍然不可见；
- 双层 Canvas 引入了什么导航成本。

不在样章中完整展开：

- 所有 Pattern 类型；
- 完整 Workflow 节点规范；
- Tool 数据模型；
- Guardrail 配置；
- 端到端 Research Assistant 案例。

验收标准：

- 首次接触 Odyssey 的读者能复述双层 Canvas 的问题、决定与代价；
- 样章不依赖尚未设计的案例。

### ODOC-102 收集历史设计证据

- Priority: `P1`
- Status: `Deferred`
- Dependencies: ODOC-101

工作：

- 盘点旧飞书图和 `odyssey-architecture/docs/public/images`；
- 找到 Thinking Ownership 三色区域的原始设计语境和 Canvas 层级说明；
- 为每张候选图记录原始语境和日期；
- 选择能够说明“初始假设”的最小图片集合。

验收标准：

- 每张旧图都说明当时想解决的问题；
- 不把旧图作为当前产品截图；
- 不为了表现演化而制造不存在的设计因果。

### ODOC-103 核验当前 Figma 交互

- Priority: `P1`
- Status: `Done`
- Dependencies: ODOC-101

需要核验：

- Journey Editor；
- Agent Slot；
- Workflow Preview；
- Open Canvas；
- Agent Workflow Editor；
- Flow / Configure；
- Focus Mode。

交付物：

- Figma 节点清单；
- 每个节点支持的设计论点；
- 需要裁切与标注的区域说明。

验收标准：

- 每张 Figma 图只承担一个主要论点；
- UI 状态和独立页面不会混淆；
- 图像与当前信息架构一致。

### ODOC-104 核验当前设计证据

- Priority: `P1`
- Status: `Done`
- Dependencies: ODOC-004, ODOC-101

工作：

- 检查 Journey Canvas 到 Agent Workflow Canvas 的当前设计路径；
- 核对样章引用的 Figma 节点是否代表当前设计；
- 识别历史设计、当前设计与仍在探索的交互；
- 记录影响核心论点的 Figma 内部矛盾并向 River 确认。

验收标准：

- 所有关键设计陈述均有明确来源；
- 历史图不会被误作当前界面；
- 探索方向不会被写成当前设计结论。

### ODOC-105 绘制双层 Canvas 简化概念图

- Priority: `P1`
- Status: `Deferred`
- Dependencies: ODOC-101, ODOC-103

图应表达：

```text
OdyJourney / system-level cooperation
               ↓ progressive disclosure
Agent / internal workflow
```

验收标准：

- 不复制完整产品 UI；
- 一眼可以区分两个抽象层；
- Preview 的过渡责任明确；
- 图中术语符合 ODOC-002。

### ODOC-106 编写样章中文初稿

- Priority: `P1`
- Status: `Done`
- Dependencies: ODOC-103, ODOC-104

Completion record:

- 中文正文与发布级图片已经完成；
- 历史图与额外概念图经 Review 判定不是本样章定稿的必要依赖，分别保留为后续设计演化和视觉标准工作；
- 2026-10-04 通过内容、产品事实、视觉自检和独立冷读验收。

建议结构：

1. 一张 Canvas 为什么会失控；
2. 持续原则：用三色 Thinking Ownership 表达责任；
3. 暴露的问题：系统级协作和 Agent 内部执行属于不同抽象层；
4. Odyssey 的决定：Journey Canvas + Agent Workflow Canvas；
5. Agent Slot → Preview → Full Canvas；
6. 这个设计让什么变得可理解；
7. 它没有暴露什么；
8. 设计收益与导航代价；
9. 当前设计、限制与未决问题；
10. 仍未解决的问题。

验收标准：

- 从问题出发，不以概念定义开场；
- 旧设计、概念图和当前 Figma 各司其职；
- 至少说明一个真实代价；
- 没有依赖完整案例；
- 状态声明可追溯。
- 本任务不生成英文正文。

### ODOC-107 样章中文版三类评审与定稿

- Priority: `P0`
- Status: `Done`
- Dependencies: ODOC-106

评审维度：

1. 内容评审：论证是否成立、第一次阅读是否能理解；
2. 产品事实评审：概念、Figma 和实现陈述是否准确；
3. 视觉评审：每张图是否真正帮助理解。

验收标准：

- P0/P1 问题全部关闭；
- 未解决分歧被记录为 Open Question；
- 明确决定继续、修改方法或停止整站扩展。
- 中文版被明确标记为内容基准，之后才可进入英文翻译。

### 样章发布工作包

- Status: `Active`
- Tracking file: `doc/samples/two-level-canvas/release/README.md`
- Scope: 发布级图片、中文定稿、英文同步、双语站点迁移与方法沉淀

该工作包是 ODOC-103、ODOC-106、ODOC-107、ODOC-201–203、ODOC-405 与 ODOC-505–507 的执行清单，不建立另一套里程碑或状态体系。

当前执行顺序：

```text
发布级图片
→ 中文样章定稿
→ River 中文最终 Review
→ 等义英文稿与双语一致性检查
→ 正式文档站迁移
→ 从样章提炼写作与视觉标准
```

## 7. Epic 2 — 写作与视觉标准

### ODOC-201 从样章提炼页面模板

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-107

模板至少包含：

- The problem；
- The tempting alternative；
- Where it breaks；
- The Odyssey decision；
- Product expression；
- What becomes understandable；
- What remains invisible or unresolved；
- Trade-offs；
- Current status。

验收标准：

- 模板来自样章验证，而不是纯理论约定；
- 允许不同文章删减不适用的小节；
- 不要求网站文章写成视频旁白。

### ODOC-202 冻结视觉使用规范

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-107

工作：

- 规定概念图、Figma 图和历史图的使用场景；
- 规定裁切、标注、标题、Alt Text 和状态标识；
- 规定历史与当前设计并置方式；
- 规定公开素材的来源记录方式。

验收标准：

- 同一种视觉角色具有一致表达；
- 历史图不会被误认为当前界面；
- 图片脱离正文时仍有足够语境。

### ODOC-203 建立 Review 模板

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-201, ODOC-202

交付物：

- 页面内容 Review Checklist；
- 产品事实 Review Checklist；
- 视觉 Review Checklist；
- 发布前状态核验 Checklist。

## 8. Epic 3 — 无案例依赖的首版核心叙事

### ODOC-301 编写《为什么是 Odyssey》中文版

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-201

范围：

- 一次性任务与持续知识工作的区别；
- 为什么新一轮工作不应从空白 Prompt 开始；
- 为什么这是设计探索而不是成熟产品声明。

验收标准：

- 用具体连续性解释“长期”；
- 不承诺持续自主运行；
- 不依赖完整案例。

### ODOC-302 编写《设计原则》中文版

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-201, ODOC-301

首版四条原则：

1. 可见、可编辑的系统结构；
2. 有边界的自主性；
3. 关系先于角色；
4. 知识与配置共同持续存在。

验收标准：

- 每条原则都说明适用边界；
- 每条原则至少包含一个取舍；
- 不将 Thinking Ownership 描述为固定的三块大空间区域；保留当前设计中的三色责任语义。

### ODOC-303 编写《为什么关系先于角色》中文版

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-201, ODOC-002

验收标准：

- 解释固定 Agent 类型的诱惑和局限；
- 解释 Pattern 位置、信息流、Goal 和 Workflow 如何共同形成角色；
- 不需要展开完整 Pattern 数学模型。

### ODOC-304 编写《为什么需要有边界的自主性》中文版

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-201, ODOC-003

验收标准：

- 不把自主与确定性写成二选一；
- 说明设计者能够控制的边界；
- 不声称 Agent 内部推理完全可见；
- Agent Action、Task、Branch、Loop 只按需出现。

### ODOC-305 编写《为什么 Knowledge Space 不只是 RAG》中文版

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-201, ODOC-001

验收标准：

- 区分检索结果与长期知识结构；
- 解释文件树和语义图的不同责任；
- 使用设计情境而不是虚构完成的用户案例；
- 自动维护能力按真实状态标记。

### ODOC-306 编写首个设计演化页面中文版

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-102, ODOC-202

首选主题：

> 三色 Thinking Ownership 如何同时贯穿空间区域、节点、变量分组、资源边界和 Flow/Configure。

验收标准：

- 旧图用于解释最初假设；
- 当前图用于解释新的表达；
- 明确哪些原则保留、哪些表达改变；
- 不倒推或虚构设计过程。

### ODOC-307 编写《当前状态与限制》中文版

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-004, ODOC-104

验收标准：

- 重要能力逐项核验；
- 设计、实现中与已实现明确区分；
- 明确 Odyssey 当前是设计和工程探索；
- 记录尚未解决的产品问题。

### ODOC-308 首版中文版叙事连贯性 Review 与定稿

- Priority: `P0`
- Status: `Todo`
- Dependencies: ODOC-301, ODOC-302, ODOC-303, ODOC-304, ODOC-305, ODOC-306, ODOC-307

验收标准：

- 可以从头读到尾且不需要查阅工程规范；
- 没有案例缺失造成的叙事断层；
- 页面之间不重复定义同一概念；
- 每篇文章都回答一个清晰问题；
- 首版没有为了目录完整而新增空页面。

## 9. Epic 4 — 旧内容迁移与站点整理

### ODOC-401 建立旧页面迁移清单

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-308

每个旧文件标记为：

- Preserve；
- Rewrite；
- Merge；
- Archive；
- Remove from navigation。

验收标准：

- 不直接按旧目录复制内容；
- 有价值的历史观点保留来源；
- 空白页和未完成 benchmark 不再公开显示。

### ODOC-402 重构公开导航

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-401

建议首版导航：

```text
Odyssey
├── Why Odyssey?
├── Design Principles
├── Key Decisions
│   ├── Why Two Levels of Canvas?
│   ├── Why Relationships Before Roles?
│   ├── Why Bounded Autonomy?
│   └── Why Knowledge Space Is More Than RAG
├── Design Evolution
└── Current State and Limitations
```

验收标准：

- 公开导航无空页面；
- 不包含 Research Assistant Walkthrough；
- Future 内容不伪装成当前目录；
- 页面路径和链接有效。

### ODOC-403 迁移与重写旧内容

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-402

验收标准：

- 迁移内容遵循已冻结的写作标准；
- 技术细节链接到权威文档，不在公开站重复维护；
- 历史内容明确标记时间和语境；
- 无相互矛盾的概念定义。

### ODOC-404 站点构建与导航验证

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-403

验收标准：

- VitePress 构建通过；
- 所有内部链接有效；
- 图片加载正常；
- 桌面与窄屏阅读正常；
- 无公开草稿、空页面或断链。

### ODOC-405 建立双语目录与语言切换

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-402

目标结构：

```text
docs/
├── zh/
│   └── 中文基准页面
└── en/
    └── 对应英文页面
```

工作：

- 配置 VitePress 中文和英文 locale；
- 建立一一对应的页面路径；
- 提供 `中文 / English` 切换；
- 对尚无英文版的页面设计明确状态；
- 验证语言切换优先进入当前页面的对应版本。

验收标准：

- 中文页面是首个可完整审阅的版本；
- 中英文导航层级一致；
- 切换语言不会无故跳回首页；
- 缺少译文时不会展示过期内容。

## 10. Epic 5 — 中文定稿、英文同步与发布核验

### ODOC-501 产品事实核验

- Priority: `P0`
- Status: `Todo`
- Dependencies: ODOC-404

逐项核对：

- 术语；
- 当前 Figma 设计；
- 历史设计与探索内容的标注；
- Pattern 与 Workflow 约束；
- Knowledge Space 能力；
- Guardrail 与 Execution Behavior 表述；
- 后置内容与未决问题的标注。

### ODOC-502 内容与可读性核验

- Priority: `P0`
- Status: `Todo`
- Dependencies: ODOC-404

验收标准：

- 第一次接触项目的读者可以独立理解；
- 文档不依赖 SSTM、AD 或未来视频；
- 文档不是产品功能列表；
- 没有过度营销或普遍化结论；
- 每项关键设计都包含代价或限制。

### ODOC-503 视觉与来源核验

- Priority: `P0`
- Status: `Todo`
- Dependencies: ODOC-404

验收标准：

- 图片来源和使用权限明确；
- 历史图、当前图和探索图不会混淆；
- Alt Text 完整；
- 裁切与标注在不同尺寸下可读；
- 没有无法追溯的关键视觉证据。

### ODOC-504 中文版冻结决策

- Priority: `P0`
- Status: `Todo`
- Dependencies: ODOC-501, ODOC-502, ODOC-503

可能结论：

- Approve；
- Approve with follow-ups；
- Revise；
- Hold。

验收标准：

- 所有阻塞问题均有负责人或明确决策；
- 中文发布范围与页面清单冻结；
- 未完成内容不进入公开导航。

### ODOC-505 生成首版英文稿

- Priority: `P1`
- Status: `Todo`
- Dependencies: ODOC-504, ODOC-405

工作：

- 按中文定稿逐页生成英文版；
- 使用 ODOC-002 的受控术语表；
- 对英文表达进行自然化处理；
- 不新增、删减或改变中文设计结论；
- 保持标题层级、图号、设计内容类型、Figma 节点和引用对应。

验收标准：

- 每个中文首版页面都有对应英文文件；
- 英文能独立阅读；
- 不存在逐字翻译造成的明显歧义；
- 不存在英文自行扩展的产品承诺。

### ODOC-506 双语一致性 Review

- Priority: `P0`
- Status: `Todo`
- Dependencies: ODOC-505

逐页检查：

- 设计论点；
- 产品事实；
- 设计内容类型；
- 术语；
- 图片与图注；
- 链接与引用；
- 限制和待决问题。

验收标准：

- 中英文没有实质性语义差异；
- 英文没有遗漏中文中的限制条件；
- 中文修改后受影响的英文页面均已重新核验。

### ODOC-507 双语站点验证

- Priority: `P0`
- Status: `Todo`
- Dependencies: ODOC-404, ODOC-405, ODOC-506

验收标准：

- 双语 VitePress 构建通过；
- 中英文导航和页面对应正确；
- 语言切换、内部链接、图片和锚点有效；
- 桌面与窄屏均可正常阅读；
- 默认语言和回退行为符合最终决定。

### ODOC-508 双语发布决策

- Priority: `P0`
- Status: `Todo`
- Dependencies: ODOC-501, ODOC-502, ODOC-503, ODOC-506, ODOC-507

可能结论：

- Approve；
- Approve with follow-ups；
- Revise；
- Hold。

验收标准：

- 中英文发布范围一致；
- 所有阻塞问题均有明确决策；
- 未完成页面不进入对应语言的公开导航。

## 11. Epic 6 — 最小案例设计（后续）

> 当前状态：`Deferred`  
> 说明：Odyssey 目前尚无经过确认的最小端到端案例设计。本 Epic 不阻塞无案例依赖的首版文档。

### ODOC-601 定义案例要验证的设计问题

- Priority: `P2`
- Status: `Deferred`
- Dependencies: ODOC-504

案例必须验证明确的设计决定，而不是承担功能展示任务。

验收标准：

- 有具体用户情境和时间跨度；
- 明确案例为何需要持久化配置和知识；
- 明确案例不需要展示的能力。

### ODOC-602 设计最小 Research Assistant 场景

- Priority: `P2`
- Status: `Deferred`
- Dependencies: ODOC-601

需要确认：

- Journey 目标；
- 使用的 Pattern；
- 最小 Agent 集合；
- 必需的 Workflow 节点；
- Tool 和 Knowledge Space；
- 至少两轮研究工作的连续性；
- 人工检查和修订位置。

验收标准：

- 不为了覆盖功能加入 Circular Loop、Guardrail 或额外 Agent；
- 每个对象都服务于案例目标；
- 设计能够由现有或明确规划的领域模型表达。

### ODOC-603 核验案例的设计与实现边界

- Priority: `P2`
- Status: `Deferred`
- Dependencies: ODOC-602

验收标准：

- Figma 中有明确用户路径；
- 领域模型能够表达；
- 当前、历史与探索设计逐项标注；
- 设计探索不会伪装成当前设计。

## 12. Epic 7 — 案例接入文档（后续）

### ODOC-701 编写 Research Assistant Walkthrough

- Priority: `P2`
- Status: `Deferred`
- Dependencies: ODOC-603

验收标准：

- 从真实设计出发；
- 展示至少两个工作周期；
- 逐层进入 Journey、Pattern、Agent Workflow 和 Knowledge Space；
- 只解释案例需要的概念；
- 清楚标记非实现步骤。

### ODOC-702 评估案例是否进入主导航

- Priority: `P2`
- Status: `Deferred`
- Dependencies: ODOC-701

判断标准：

- 是否显著帮助第一次阅读；
- 是否与已有页面重复；
- 是否已经足够稳定；
- 是否适合成为后续视频的基础素材。

## 13. Future Backlog

以下任务不是首版承诺：

| ID | 内容 | Priority | Status |
| --- | --- | --- | --- |
| ODOC-F01 | OdyJourney 独立概念章 | `P3` | `Deferred` |
| ODOC-F02 | Pattern 类型与形式化模型 | `P3` | `Deferred` |
| ODOC-F03 | Agent 与 Agent Action 专题 | `P3` | `Deferred` |
| ODOC-F04 | Tool 为什么是资源而不是节点 | `P3` | `Deferred` |
| ODOC-F05 | 为什么 Loop 必须结构化 | `P3` | `Deferred` |
| ODOC-F06 | Guardrail 与 Execution Behavior | `P3` | `Deferred` |
| ODOC-F07 | 文件树与知识图谱专题 | `P3` | `Deferred` |
| ODOC-F08 | 带日期的竞品设计参照 | `P3` | `Deferred` |
| ODOC-F09 | DSL 设计讨论 | `P3` | `Deferred` |
| ODOC-F10 | 从成熟页面选择视频题材 | `P3` | `Deferred` |

## 14. 当前待决问题

| ID | 问题 | 阻塞范围 | 状态 |
| --- | --- | --- | --- |
| OQ-01 | 文档语言策略 | 全部正式写作 | Resolved — 中文先行、中文定稿后生成英文版、双语发布 |
| OQ-02 | 文档如何嵌入 Odyssey：构建时打包、外链还是其他方式？ | 站点迁移 | Open |
| OQ-03 | 哪些旧飞书图拥有可公开使用的原始文件？ | 样章视觉 | Open |
| OQ-04 | 当前 Figma 素材的公开导出和标注规范是什么？ | 样章视觉 | Open |
| OQ-05 | 哪些 Figma 页面或节点代表当前设计，哪些属于历史或探索？ | 设计来源 | Open |
| OQ-06 | Tool 的公开术语和复用作用域何时冻结？ | Future Tool 章节 | Open |
| OQ-07 | 最小 Research Assistant 案例何时开始设计？ | Epic 6–7 | Deferred |

## 15. 建议的 Review 节奏

### 每个任务进入 Review 时

任务负责人应补充：

- 交付物链接；
- 使用的事实来源；
- 未解决问题；
- 与原计划的偏差；
- 建议的状态变更。

对于正文任务，还应注明：

- 中文版是否已经定稿；
- 英文版是否允许启动；
- 中文是否在英文生成后发生过实质修改；
- 双语一致性是否需要重新检查。

### 每个 Milestone 结束时

进行一次范围检查：

- 是否出现了为了完整而扩张目录的倾向；
- 是否出现了无法证明的产品陈述；
- 是否将未来设计写成当前能力；
- 是否需要删除而不是继续补充内容；
- 下一阶段是否仍然必要。

## 16. 下一步

首个执行序列建议为：

```text
ODOC-001 权威信息源
→ ODOC-002 首版术语
→ ODOC-003 可见性表述
→ ODOC-004 设计内容类型与来源标注
→ ODOC-101 样章边界
→ ODOC-102/103/104 素材与事实核验
→ ODOC-105 概念图
→ ODOC-106 样章中文初稿
→ ODOC-107 中文版三类评审与定稿
→ 英文版在中文版定稿后进入翻译和一致性检查
```

Research Assistant 案例保持 `Deferred`，直到首版核心叙事已经成立且团队准备单独进行案例设计。
