# Odyssey V1 Implementation Plan

## 1. 目标与范围

Odyssey V1 的目标是交付一个可用的配置型产品，而不是执行引擎。

V1 应让用户能够通过正常前端流程完成以下闭环：

```text
创建 OdyJourney
→ 选择和配置 Pattern
→ 配置 Agent Slot
→ 创建或配置 Agent Workflow
→ 编辑 Workflow Canvas
→ 自动保存 Working Draft
→ 显式保存 Workflow Version
→ 刷新后继续编辑
```

V1 包含 CRUD、UI、领域校验和部分简单算法，不包含 workflow/agent/tool 的实际执行。

页面结构以 `odyssey-figma-information-architecture.md` 为准；具体视觉细节在实现对应页面前读取其精确 Figma node。Figma 顶层 frame 不等同于独立路由，面板、Focus Mode、Inspector 和 preview 等应作为页面内 UI 状态实现。

## 2. 当前仓库状态

仓库已经具备工程基础：

- Web：Vue 3、TypeScript、Vite、Vue Router、Pinia、Naive UI、Vue Flow。
- API：FastAPI、SQLAlchemy 2、Alembic、PostgreSQL。
- Storage：开发环境规划为 MinIO。
- 已有基础表：`workspace`、`ody_journey`、`agent_workflow`、`agent_variable`、`agent_reusable_tool`。

当前主要缺口：

- 前端只有静态首页，尚未建立产品页面和业务 store。
- 后端只有 health API，尚无业务 CRUD。
- `packages/schemas` 只定义了很薄的 Workflow contract，且与领域文档存在差异。
- Workflow Version、Tool Definition/Instance、Knowledge Space/Folder/Resource 等表尚未实现。
- Canvas、Pattern Slot 和资源拖拽尚未进行技术验证。

## 3. 下一阶段重点：JSON Contract 与数据库结构

下一阶段应先冻结领域 JSON，再设计数据库迁移和 API DTO。不要先让 Vue Flow 数据结构或 Figma 图层结构反向决定领域模型。

优先定义：

- `PatternConfig`
- `PatternTemplate`
- `PatternSlot`
- `PatternRoute`
- `AgentDefinition`
- `WorkflowGraph`
- 各类 `WorkflowNode` configuration
- `CanvasLayout`
- `WorkflowDraft`
- `WorkflowVersionSnapshot`
- Variable、Tool、Knowledge Space reference

必须保持三类状态分离：

```text
WorkflowGraph
  业务语义节点、边和节点配置

CanvasLayout
  节点位置、容器尺寸、viewport 等展示数据

Temporary UI State
  当前 tab、选中节点、打开面板、拖拽状态、Focus Mode 等
```

其中 Temporary UI State 不应成为独立后端实体，也不应写入 Workflow Graph。

JSON contract 应同时映射到：

1. `packages/schemas` 的 TypeScript 类型。
2. FastAPI 的 Pydantic request/response DTO。
3. SQLAlchemy first-class records 与 JSONB 字段。
4. 前端 domain model 与 Vue Flow adapter。

阶段验收标准：一份 Journey JSON 可以完整表达 Pattern、Slots、Agents 和 Workflows，并能通过前端加载、编辑、保存、重新加载后无损往返。

## 4. 推荐实施顺序

### Phase 0：冻结领域边界

- 统一领域文档中不一致的命名和 ownership。
- 定义 JSON Schema/TypeScript/Pydantic contracts。
- 确定 first-class table 与 JSONB 的边界。
- 确定删除、引用检查和 cascade/detach 策略。
- 确定 Working Draft、auto-save、explicit Save 和 Version 的语义。

### Phase 1：高风险交互验证

不要等全部 CRUD 完成后才处理 Canvas。完成两个最小、可丢弃或可演进的交互验证。

#### Pattern Slot 验证

- Pattern template 拖入 System Canvas 后生成固定 topology 和稳定 `slotId`。
- Agent template 只能拖入合法的空 slot。
- 支持 slot 的选中、替换和移除。
- 根据最终产品决定是否支持 Agent 交换及 slot 排序。
- 展示 valid、invalid、occupied、duplicate 等拖拽状态。
- 选中已配置 slot 后显示一个只读 Workflow Preview。
- `Open canvas` 导航至对应 Agent Workflow Editor。
- 所有修改通过统一 store action 更新 `patternConfig`，拖拽组件不能直接修改持久化 JSON。

如果 Pattern topology 固定，System Canvas 不应被实现为一个自由编辑的 Vue Flow canvas。Pattern template 应生成领域结构，而不是把 Figma template card 或 canvas node 原样持久化。

#### Agent Workflow Canvas 验证

- 从 node palette 创建节点。
- Start/End 自动存在、不可删除。
- 节点移动后单独保存 layout。
- 创建和删除 edge。
- 选中节点后打开配置 panel。
- Flow/Configure 和 Focus Mode 能正确切换。
- 保存、刷新后恢复 graph、layout 和 viewport。
- 新建 edge 时检测并拒绝任意环。
- 验证 Loop container/sub-workflow 的技术实现。
- Canvas node 拖拽与 Tool/Knowledge Space resource 拖拽互不干扰。

Canvas 必须通过 adapter 工作：

```text
Domain Model
→ Canvas View Model
→ Vue Flow
```

禁止将 Vue Flow node/edge 对象直接作为后端 contract。

### Phase 2：应用外壳和路由

实现：

```text
/journeys
/journeys/:journeyId
/journeys/:journeyId/agents/:agentId
/assets/knowledge-spaces
/assets/knowledge-spaces/:knowledgeSpaceId
/assets/knowledge-spaces/:knowledgeSpaceId/documents/:documentId
/community
```

同时建立共享的 App Shell、Global Navigation、Header/Breadcrumb、List Toolbar、Side Panel Host，以及 loading、empty、error、coming-soon 状态。

### Phase 3：第一个端到端纵向闭环

优先实现：

```text
Journey List
→ Create Journey
→ Choose Pattern
→ Assign/Create Agent
→ Open Agent Workflow
→ Edit Canvas
→ Auto-save Draft
→ Explicit Save Version
→ Reload
```

后端至少提供：

- Workspace singleton API。
- OdyJourney CRUD。
- AgentWorkflow CRUD。
- Working Draft GET/PUT。
- Workflow Version create/list/restore。
- 基于 `revision` 的并发更新保护。
- 服务端领域校验。

前端采用 Pinia 管理服务器实体和编辑 session。Canvas 修改后 debounce auto-save；UI 显示 `unsaved`、`saving`、`saved`、`invalid` 和 `conflict`。显式 Save 创建 immutable version，Restore 只覆盖 Working Draft，不删除后续版本。

### Phase 4：完善 Workflow 节点和校验

节点实现顺序：

1. Start / End
2. Agent Action
3. Task
4. Branch
5. Loop
6. Variables
7. Tool configuration
8. Knowledge Space/resource binding

V1 简单算法和领域校验包括：

- 新增 edge 时的 cycle detection。
- 从 Start 出发的 reachability。
- Start/End 数量和连接约束。
- Branch case 与 outgoing handle 的对应校验。
- Loop nesting 和允许节点类型限制。
- Pattern slot 引用完整性。
- Pattern route 到 Agent End read-only route 的派生。
- 删除 Variable、Tool、Knowledge Space 前的引用检查。
- Workflow Preview 的 bounds 计算与 fit-to-view。
- 搜索、筛选和分页。
- Working Draft revision conflict detection。

校验应实现为独立 domain service，并使用稳定错误码。UI 可以提前阻止明显错误，但后端仍需执行权威校验。

### Phase 5：Variables、Tools 与资源配置

- Agent Variable CRUD 和引用保护。
- Built-in Tool Definitions。
- Configured Tool 与 Task linear sequence。
- 简化版 Reusable Tools。
- Agent Action 的 Tools/Knowledge Spaces 绑定。
- Resource browser 的搜索、过滤、分页和 drag/drop。
- 类型安全 drop zone、重复资源拒绝。
- Canvas node 和 side panel 编辑同一份状态，禁止维护两套配置。

Built-in Tool 共用一个 panel shell，内部按类型渲染表单：

- Set Variable
- API Request
- Knowledge Retrieval
- Script Execution
- LLM Call

V1 只保存和校验配置，不执行 Tool。

### Phase 6：Knowledge Space CRUD

建议顺序：

1. Knowledge Space List/CRUD。
2. Folder metadata CRUD。
3. Document metadata CRUD。
4. MinIO 上传、下载和删除。
5. Knowledge Space Detail。
6. Knowledge graph 只读展示。
7. Document Inspector。
8. Document Detail。

由于没有 engine，Knowledge Family、graph node 和 edge 可以使用持久化 seed/mock 数据。V1 不实现自动索引、Knowledge Steward 和 Document Curator。Graph 可以复用 Vue Flow 的展示能力，但应使用独立的 read-only adapter，不能复用 Workflow 业务语义。

### Phase 7：视觉对齐、Seed 与交付

- 对照精确 Figma node 调整 typography、spacing、colors 和 states。
- 完成 Focus Mode、collapsed panel、loading/empty/error states。
- 补充 keyboard accessibility 和桌面窄屏降级。
- 通过正常前端流程创建第一个完整 OdyJourney。
- 从数据库导出 deployment seed，禁止在后端硬编码 demo journey。
- 完成 API、domain、component 和端到端测试。

## 5. 里程碑

| 里程碑                  | 验收结果                                       |
| -------------------- | ------------------------------------------ |
| M1 Contract Freeze   | Journey、Pattern、Agent、Workflow JSON 可以无损往返 |
| M2 Interaction Proof | Pattern Slot 拖拽和 Vue Flow Canvas 技术路径成立    |
| M3 Core Journey      | Journey 可创建、编辑、保存并在刷新后恢复                   |
| M4 Workflow Editor   | 节点、边、配置、校验和 Version 可用                     |
| M5 Resources         | Variables、Tools、Knowledge bindings 可配置     |
| M6 Knowledge Space   | 文件和 metadata CRUD、只读 graph 可用              |
| M7 Demo Ready        | Figma 对齐、seed、测试和部署流程完成                    |

## 6. 当前待确认的产品决策

### 6.1 Pattern 类型

Figma 当前展示：

- Hub & spoke
- Diamond loop
- Linear sequence
- Solo component

领域文档目前只正式定义 `linear | custom`。需要确认 V1 是否实现 Figma 的全部四种模板，以及这些名称是独立 `PatternType`，还是同一个 custom/fixed-topology pattern 的 template key。

### 6.2 Agent Slot 的拖动范围

需要确认“Slot 允许拖动”包含哪些操作：

- Agent template 拖入空 slot。
- 已配置 Agent 在 slot 之间交换。
- Slot 自身改变顺序或位置。
- 以上全部。

该决定会直接影响 `PatternSlot`、`PatternRoute`、拖拽状态机和 route 派生方式。

### 6.3 Agent Action 是否允许进入 Loop

领域文档规定 V1 中 Agent Action 不能放入 Loop，但 Figma 的 Workflow 示例明确在 Loop 内展示 Agent Action。实现前必须选择权威规则。

当前建议：允许 Agent Action 进入 Loop，但继续禁止 nested Loop；最终以产品确认结果为准。

## 7. V1 非目标

- Execution engine。
- Runtime Agent/Tool execution。
- 多用户、权限和协作编辑。
- 调度、任务队列、trace 和 observability runtime。
- Secret vault。
- Community marketplace。
- Publish/Release 流程。
- 自动 Knowledge Steward/Document Curator。
- 实时知识图谱索引。

