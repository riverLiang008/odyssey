# Odyssey 文档结构说明

本目录用于集中存放 Odyssey 项目的架构设计、产品规格、工程指南、实施计划和相关资源。

## 目录结构

```text
doc/
├── README.md
├── frontend-engineering-guidelines.md
├── architecture/
│   ├── domain/
│   ├── data/
│   │   ├── contracts/
│   │   ├── database/
│   │   │   └── reviews/
│   │   └── storage/
│   └── execution/
├── product/
│   ├── information-architecture/
│   └── feature-specifications/
│       ├── knowledge-space/
│       ├── resources/
│       ├── tools/
│       └── variables/
├── engineering/
│   └── development/
├── planning/
│   ├── project/
│   └── implementation/
│       ├── frontend/
│       └── backend/
├── assets/
│   ├── brand/
│   └── diagrams/
└── .obsidian/
```

## 分类说明

## 当前权威文档

开发和评审时优先使用下表中的文档。文件名包含 `draft` 不代表可以忽略；表中标记为 working baseline 的文档，在正式冻结或更名以前仍是当前实现依据。

| 主题 | 当前权威文档 | 状态 |
| --- | --- | --- |
| V1 领域与设计约束 | [`architecture/domain/odyssey-v1-design-constraints.md`](architecture/domain/odyssey-v1-design-constraints.md) | Accepted |
| Canonical JSON contract | [`architecture/data/contracts/canonical-json-contracts-draft.md`](architecture/data/contracts/canonical-json-contracts-draft.md) | Working baseline |
| V1 数据库设计 | [`architecture/data/database/reviews/v1-database-design-review-draft.md`](architecture/data/database/reviews/v1-database-design-review-draft.md) | Implementation baseline |
| V1 对象存储设计 | [`architecture/data/storage/v1-object-storage-design.md`](architecture/data/storage/v1-object-storage-design.md) | Implementation baseline |
| Pattern → Workflow End 路由与单向同步 | [`architecture/execution/pattern-agent-end-routing-decision.md`](architecture/execution/pattern-agent-end-routing-decision.md) | 已实施编辑器与 HTTP 持久化；覆盖旧单 End 与 Hub 单向假设 |
| Pattern → Workflow End 实施 TODO | [`planning/implementation/pattern-agent-end-routing-implementation-plan.md`](planning/implementation/pattern-agent-end-routing-implementation-plan.md) | 实施记录；含原子同步、Canvas 与兼容验收，剩余范围见完成报告 |
| Pattern / End 路由合同增量 | [`architecture/data/contracts/pattern-agent-end-routing-contract.md`](architecture/data/contracts/pattern-agent-end-routing-contract.md) | 本次实施合同；版本、删除确认、并发与可移植出口 |
| Workflow/Canvas 执行模型 | [`architecture/execution/Canvas Execution Model.md`](<architecture/execution/Canvas Execution Model.md>) | Current design |
| Knowledge Space 产品规格 | [`product/feature-specifications/knowledge-space/knowledge-space-specification.md`](product/feature-specifications/knowledge-space/knowledge-space-specification.md) | Product specification；已确认的 V1 database/storage 决策可覆盖其中的旧持久化建议 |
| 前端工程规范 | [`frontend-engineering-guidelines.md`](frontend-engineering-guidelines.md) | Authoritative |
| M2 前端实施计划 | [`planning/implementation/frontend/m2-interaction-proof-frontend-implementation.md`](planning/implementation/frontend/m2-interaction-proof-frontend-implementation.md) | Active frontend planning |
| M2.4 Slot Workflow 交互纠偏计划 | [`planning/implementation/frontend/m2.4-slot-open-workflow-http-only-interaction-remediation-plan.md`](planning/implementation/frontend/m2.4-slot-open-workflow-http-only-interaction-remediation-plan.md) | Ready for implementation；覆盖旧的“点击空 Slot 即创建”行为 |
| M2.4B 创建 Journey 前端计划 | [`planning/implementation/frontend/m2.4b-new-journey-pattern-selection-implementation-plan.md`](planning/implementation/frontend/m2.4b-new-journey-pattern-selection-implementation-plan.md) | Ready for implementation |
| Journey 后端纵向切片交接 | [`planning/implementation/backend/journey-persistence-vertical-slice-handoff.md`](planning/implementation/backend/journey-persistence-vertical-slice-handoff.md) | Backend planning handoff |
| M2.4B Journey 后端计划 | [`planning/implementation/backend/m2.4b-journey-persistence-api-implementation-plan.md`](planning/implementation/backend/m2.4b-journey-persistence-api-implementation-plan.md) | Ready for implementation |
| V1 实施计划 | [`planning/implementation/v1-implementation-plan.md`](planning/implementation/v1-implementation-plan.md) | Planning baseline；与 Accepted/Implementation baseline 冲突时以后者为准 |
| 项目初始化 | [`planning/project/odyssey-project-initialization-v2.md`](planning/project/odyssey-project-initialization-v2.md) | Current project setup |

以下文档保留作历史背景，不应覆盖上表中的当前约束：

- [`architecture/data/database/Odyssey Database Design.md`](<architecture/data/database/Odyssey Database Design.md>)；
- [`architecture/data/database/reviews/v1-database-design-review-feedback.md`](architecture/data/database/reviews/v1-database-design-review-feedback.md)；
- 未在上表中列为权威版本的旧 Draft、评审稿和阶段性计划。

### 根目录

- `README.md`：本文档，提供目录导航和文档归档规则。
- `frontend-engineering-guidelines.md`：前端工程的权威规范。该文件保留在固定路径，供仓库级开发指令引用。

### `architecture/`

存放系统架构和技术模型文档。

- `domain/`：领域模型、核心概念、业务边界和设计约束。
- `data/contracts/`：Canonical JSON 等跨模块数据契约及其草案。
- `data/database/`：数据库模型、表结构和持久化方案。
- `data/database/reviews/`：数据库设计的评审稿与评审反馈。
- `data/storage/`：对象存储、文件存储等基础设施设计。
- `execution/`：工作流、Canvas 和节点执行模型。

### `product/`

存放产品信息架构和面向具体功能的详细规格。

- `information-architecture/`：页面层级、导航、路由、用户流程和界面边界。
- `feature-specifications/knowledge-space/`：Knowledge Space 功能规格。
- `feature-specifications/resources/`：资源选择、配置和交互规格。
- `feature-specifications/tools/`：内置工具及其配置规格。
- `feature-specifications/variables/`：变量模型相关的界面与交互规格。

### `engineering/`

存放日常开发和工程实践文档。

- `development/`：本地环境、服务启停、调试和开发流程指南。

### `planning/`

存放阶段性项目规划和实施方案。

- `project/`：项目初始化、技术栈和仓库建设方案。
- `implementation/`：版本、里程碑或功能阶段的实施计划；`frontend/` 与 `backend/` 分别存放端侧计划，跨端总计划保留在该目录根部。

### `assets/`

存放文档引用的非 Markdown 资源。

- `brand/`：Logo 等品牌资源。
- `diagrams/`：数据结构图等独立图表资源。

### `.obsidian/`

Obsidian 工作区和插件配置。该目录不属于项目文档分类，不应在其中存放业务或技术文档。

## 文档归档规则

新增文档时，应优先根据内容归入现有目录：

1. 描述系统边界、领域、数据或运行机制的文档放入 `architecture/`。
2. 描述用户体验、页面结构或具体功能行为的文档放入 `product/`。
3. 描述开发环境、编码规范或工程流程的文档放入 `engineering/`。
4. 描述待执行工作、阶段目标或交付步骤的文档放入 `planning/`。
5. 图片等文档附件放入 `assets/`，并按用途继续分类。
6. 评审反馈应与被评审文档放在相邻的 `reviews/` 目录中。

文档同时涉及多个主题时，应按其主要目的归档，并通过相对链接引用相关文档，避免复制出多份内容。

## 产品案例

- [First Case: Moonberry Island Guide (Solo, English)](product/cases/first-case-knowledge-qa/README.md)：English case design, two Workflow DSL variants, four fictional game guides, and acceptance questions.

- [Second Case: Document Curator — Knowledge Design](product/cases/second-case-document-curator/README.md): Baseline game documents, incoming changes, maintenance rules, review scenarios, and local update boundaries.
