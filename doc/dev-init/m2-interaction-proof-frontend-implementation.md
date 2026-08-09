# Odyssey V1 M2 Interaction Proof — Frontend Implementation Plan

> Status: Proposed implementation plan  
> Scope: `v1-implementation-plan.md` 中 M2 Interaction Proof 的前端技术验证  
> Target stack: Vue 3、TypeScript、Vite、Pinia、Vue Router、Naive UI、Vue Flow  
> Figma source: [Odyssey Design](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=1-2)
> Frontend guideline: [`Odyssey 前端工程规范`](../frontend-engineering-guidelines.md)

## 1. 目标

M2 要证明 Odyssey 两条最高风险的前端交互路径能够在既定领域边界内成立：

1. Journey Editor 中的 Pattern、Agent Slot 与只读 Workflow Preview。
2. Agent Workflow Editor 中的 Vue Flow graph、layout、viewport 与编辑器 UI 状态。

M2 不是视觉完整的产品页，也不是 CRUD、版本系统或执行引擎交付。它应产出可继续演进的前端骨架、adapter、store action 和自动化测试，而不是一次性演示代码。

```text
Pattern template → PatternConfig → derived System Canvas
Agent template drag → slot assignment → read-only preview → workflow route

WorkflowGraph + CanvasLayout → Canvas Adapter → Vue Flow View Model
Vue Flow event → Editor Command → Domain mutation → Graph/Layout update
```

## 2. 依据与决策优先级

实施时按以下顺序解决资料冲突：

1. `doc/detail-design/odyssey-v1-design-constraints.md` 中已接受的 V1 约束。
2. `doc/data-structure/canonical-json-contracts.md`；若其内容尚未冻结，则使用 `doc/dev-init/canonical-json-contracts-draft.md` 并记录差异。
3. `doc/detail-design/odyssey-figma-information-architecture.md` 的页面、路由和 UI-state 边界。
4. 其他 detail design 文档中的具体交互规则。
5. 精确 Figma frame 的视觉和状态参考。
6. `v1-implementation-plan.md` 中仍未同步的旧描述。

当前已知冲突：早期 plan 包含 Workflow Version、显式 Save 和 Restore；已接受约束明确 V1 只维护 current configuration、`revision` 与 autosave。M2 按已接受约束实现，不创建 version store、version UI 或相关接口假设。

## 3. Figma 对应范围

M2 使用以下 frame 作为主要参考：

| 场景 | Figma node | M2 关注点 |
| --- | --- | --- |
| Journey Editor / Agent tab | `59:2` | Agent library、固定 System Canvas、Agent Slot、context menu、Workflow Preview |
| Journey Editor / Pattern tab | `300:33` | 四种 Pattern template、模板拖入与固定拓扑 |
| Agent Workflow Editor | `62:2` | Node Palette、Workflow Canvas、Flow/Configure、导航与 canvas shell |
| Resource Configuration | `98:2` | 验证 node drag 与 resource drag 的事件隔离，不要求完成资源 CRUD |
| Focus Mode | `166:2` | 同一路由内的 layout mode，不是独立页面 |

从 `59:2` 读取到的主要视觉约束包括：1440×900 桌面基准、204 px global navigation、64 px product navigation、300 px library、860 px System Canvas，以及浮动在右下角的只读 Workflow Preview。字体与 token 方向为 Plus Jakarta Sans display、Manrope body/meta/section，主要颜色使用 `--odyssey-color-*` 变量。

Figma 生成的 React/Tailwind 代码仅作为尺寸和层级参考。实现必须转换为 Vue SFC，并使用项目现有 CSS、Naive UI 和 `@odyssey/design-tokens`；不得引入 Tailwind，也不得将绝对定位的整屏代码直接复制进应用。

## 4. M2 范围

### 4.1 必须完成

- 建立 `/journeys/:journeyId` 和 `/journeys/:journeyId/agents/:agentId` 两级页面骨架。
- Journey Editor 支持 Pattern 与 Agent 两个与 M2 有关的 tab；Execution/Behavior 可使用明确的占位状态。
- 四个 built-in Pattern template 可实例化为带稳定 UUID 的 `PatternConfig`。
- System Canvas 使用 Pattern strategy 派生 slot 与 route 布局，不使用自由编辑的 Vue Flow。
- Agent template 可拖入空 slot；已配置 Agent 可在 slot 间 move/exchange；linear pattern 支持 slot reorder。
- 拖拽反馈覆盖 valid、invalid、occupied 和 duplicate。
- slot 的 select、replace、unassign/remove、duplicate command 能通过统一 store action 执行。
- 点击 configured slot 打开唯一的只读 Workflow Preview；`Open canvas` 进入 Agent Workflow Editor。
- Workflow Canvas 支持 palette 创建节点、节点移动、edge 创建/删除、节点选择与配置面板打开。
- Start/End 自动存在且不可删除。
- graph 与 layout 分离；viewport 可恢复。
- 新 edge 在提交前拒绝任意环；Loop 自身的嵌套 body 只做技术路径验证。
- Flow/Configure 与 Focus Mode 正确切换，且保持为临时 UI state。
- node drag 与 Tool/Knowledge Space resource drag 使用不同 payload namespace，互不误触发。
- 关键 domain command、adapter 和交互状态有自动化测试。

### 4.2 明确不做

- 后端完整 CRUD、真实 autosave API 和冲突恢复 UI；M2 使用可替换 repository port。
- Workflow Version、Restore、Publish/Release。
- 执行引擎、运行状态、trace 和 observability。
- 完整 Variables、Tools、Knowledge Space 配置表单和资源搜索分页。
- Pattern route 的自由绘制、built-in slot 的自由坐标拖动。
- 像素级覆盖全部 Figma frame、移动端布局和完整无障碍审计。

## 5. 建议代码结构

```text
apps/web/src/
├── app/
│   ├── AppShell.vue
│   └── SidePanelHost.vue
├── router/
│   └── index.ts
├── domain/
│   ├── journey/
│   │   ├── pattern.ts
│   │   ├── patternCommands.ts
│   │   └── patternStrategies.ts
│   └── workflow/
│       ├── graph.ts
│       ├── graphCommands.ts
│       └── graphValidation.ts
├── repositories/
│   ├── editorRepository.ts
│   └── inMemoryEditorRepository.ts
├── stores/
│   ├── journeyEditor.ts
│   └── workflowEditor.ts
├── canvas/
│   ├── dnd/
│   │   ├── dragPayload.ts
│   │   └── dragSession.ts
│   ├── system-canvas/
│   │   ├── SystemCanvas.vue
│   │   ├── AgentSlot.vue
│   │   └── deriveSystemCanvas.ts
│   └── agent-canvas/
│       ├── WorkflowCanvas.vue
│       ├── WorkflowPreview.vue
│       ├── workflowCanvasAdapter.ts
│       └── nodes/
├── features/
│   ├── journey-editor/
│   └── workflow-editor/
└── styles/
    ├── tokens.css
    └── canvas.css
```

如果实际开发中目录命名需要遵循后续已有约定，可以调整名称，但下列边界不能合并：domain command、Vue Flow adapter、持久化 repository、Pinia editor session 和纯 UI component。

## 6. 数据与状态设计

### 6.1 领域状态

共享 schema 至少需要补齐并导出：

```ts
interface PatternConfig {
  templateKey?: PatternTemplateKey
  slots: PatternSlot[]
  routes: PatternRoute[]
}

interface AgentWorkflowEditorDocument {
  agent: AgentSummary
  workflow: WorkflowGraph
  layout: CanvasLayout
  revision: number
}
```

所有持久化实体、slot、node 和 edge 使用 UUID。模板 key 使用稳定的 `snake_case`。Pattern route 引用 `slotId`，不得引用显示名称、数组下标或坐标。

### 6.2 Canvas adapter

`workflowCanvasAdapter.ts` 是 Vue Flow 的唯一边界：

- `toCanvasNodes(graph, layout)`：将 domain node 与 placement 合成为 Vue Flow node。
- `toCanvasEdges(graph)`：生成 handles、marker、selected/read-only presentation。
- `applyNodeMove(nodeId, position)`：只更新 `CanvasLayout`。
- `createDomainEdge(connection)`：把 Vue Flow connection 转为 domain edge command。
- `toViewport(layout)` / `fromViewport(viewport)`：隔离 Vue Flow viewport 类型。

禁止把 `@vue-flow/core` 类型导入 `packages/schemas` 或 domain command 文件。禁止把 Vue Flow node/edge 原样放进 repository payload。

### 6.3 Pinia store

`journeyEditor` 保存当前 Journey domain state 与 editor session；`workflowEditor` 保存当前 Agent aggregate 与 editor session。组件只派发 action，不直接修改持久化对象。

建议 action：

```text
instantiatePattern(templateKey)
assignAgentTemplate(slotId, templateKey)
moveAgent(sourceSlotId, targetSlotId)
reorderSlot(slotId, targetIndex)
replaceAgent(slotId, templateKey)
unassignAgent(slotId)
duplicateAgent(slotId, targetSlotId)

addNode(nodeType, canvasPosition)
moveNode(nodeId, canvasPosition)
removeNode(nodeId)
connectNodes(connectionIntent)
removeEdge(edgeId)
selectNode(nodeId | null)
setViewport(viewport)
```

`selectedSlotId`、preview、selected node、panel、mode、focus 和 active drag session 属于 UI-only state。只有 `WorkflowGraph`、`CanvasLayout` 和当前 Journey 配置进入 repository。

### 6.4 Repository port

M2 使用 typed repository interface，默认实现为 deterministic in-memory fixture，并模拟异步延迟、revision 增长和一次 conflict。这样可以验证保存状态但不绑定尚未完成的 API。

```ts
interface EditorRepository {
  loadJourney(id: string): Promise<JourneyEditorDocument>
  saveJourney(input: SaveJourneyInput): Promise<SaveResult>
  loadAgent(id: string): Promise<AgentWorkflowEditorDocument>
  saveAgent(input: SaveAgentInput): Promise<SaveResult>
}
```

真实 API 完成后只替换 adapter，不改变 component、domain command 或 canvas adapter。

## 7. Pattern Slot 实施

### 7.1 Pattern strategy

为每个 built-in template 提供纯函数 strategy：

| Template | 可变操作 | route/layout 派生 |
| --- | --- | --- |
| `solo_component` | 单 slot assignment | 无内部 route；固定居中 |
| `linear_sequence` | add/remove/reorder/exchange | 按 `order` 生成相邻 route 与横向布局 |
| `hub_and_spoke` | 支持范围内 add/remove/exchange | hub role 不随 Agent exchange 改变；spoke 环绕布局 |
| `diamond_loop` | 仅允许规则定义的位置操作 | 按 topology role 生成 diamond route 与固定布局 |

模板实例化必须一次性生成完整、有效的 slots/routes。之后 `PatternConfig` 是唯一事实来源，template card 和视觉坐标不是持久化数据。

### 7.2 DnD 协议

统一 drag payload，使用 MIME-like namespace：

```ts
type OdysseyDragPayload =
  | { kind: 'pattern-template'; templateKey: PatternTemplateKey }
  | { kind: 'agent-template'; templateKey: string }
  | { kind: 'assigned-agent'; agentId: string; sourceSlotId: string }
  | { kind: 'workflow-node-template'; nodeType: WorkflowNodeType }
  | { kind: 'resource'; resourceType: 'tool' | 'knowledge-space'; resourceId: string }
```

每个 drop target 先调用纯函数 `evaluateDrop(payload, target, state)`，得到 `valid | invalid | occupied | duplicate` 和稳定 reason code。只有 `valid` 才派发 domain action。`dragover` 只负责反馈，不写 domain state。

### 7.3 Agent 创建与复制

- Agent template drop 是深拷贝实例化，生成 Agent 及所有 owned descendant 的新 UUID。
- 已配置 Agent 跨 slot 拖动是 move/exchange，不是 clone。
- Duplicate 必须是显式 command，并为完整 owned aggregate 重新映射 ID。
- 点击空 slot 仅打开最小创建表单；确认后创建最小 `Start → End` graph，取消不得产生 orphan。

### 7.4 Preview 与路由

- configured slot click 只设置 `selectedSlotId` 并打开 preview。
- 同时最多一个 preview；选择另一个 slot 替换内容。
- Preview 通过同一 domain graph 的 read-only adapter 生成，禁用 selection、connect、drag 和 delete。
- Preview 使用 fit-to-view/bounds，简化标签但保持拓扑。
- `Open canvas` 导航到 `/journeys/:journeyId/agents/:agentId`。

## 8. Agent Workflow Canvas 实施

### 8.1 初始图与节点生命周期

- 新 Agent 自动创建 Start、End 及一条默认 edge。
- Start/End 不出现在可创建 palette 中，且 delete command 返回稳定错误码。
- palette drop 的坐标必须经过 `project()`/screen-to-flow 转换后写入 `CanvasLayout`。
- 创建节点同时产生 semantic node 与 placement，但两者通过一个 transaction-like store action 提交。
- 移动节点只修改 placement；配置修改只修改 graph node config。

### 8.2 Edge 与校验

连接过程分两层：

1. UI preflight：handle compatibility、自连接、重复 edge、明显非法方向。
2. domain validation：在候选 edge 加入后执行 cycle detection 和 graph invariant 检查。

任意环必须拒绝。Loop 的重复语义由 Loop node 表达，不通过回边表达。M2 至少验证一个 Loop container/body 的嵌套 canvas 可行性；nested Loop 被拒绝，Loop body 使用独立 graph/layout adapter instance。

### 8.3 Flow、Configure 与 Focus Mode

- Flow mode 优化连线和拓扑编辑。
- Configure mode 优化节点选择和 side panel 配置。
- 两种 mode 共享同一 graph/layout，不复制 canvas state。
- Focus Mode 隐藏 AppShell、导航和非必要 panel，canvas 占满可用区域。
- 退出 Focus Mode 后恢复同一 viewport、selection 和 panel state。
- mode/focus 不写入 repository，也不改变 route。

### 8.4 DnD 事件隔离

- node palette 只接受 `workflow-node-template`。
- Agent Action resource zone 只接受 `resource`，并进一步匹配 tool/knowledge-space。
- canvas pane 不得把 resource drop 解释为 node creation。
- resource zone 必须阻止被 Vue Flow pane 二次处理，但不得阻断 node drag、pan、connect。
- 使用 Pointer/DragEvent 的单一协调层记录 active drag kind，组件不各自维护互相矛盾的 drag flag。

M2 的资源部分只需用 fixture 证明隔离、合法 zone 高亮、非法拒绝和 duplicate 拒绝；完整 resource browser 留到 M5。

## 9. 视觉实现策略

先做结构正确和交互可验证，再做 M2 所需的视觉对齐：

- 将 Figma 中重复的 global navigation、product header、panel、card、canvas controls 抽为共享组件。
- 扩充 `@odyssey/design-tokens`，优先提供语义 token：canvas/panel/surface、border subtle/active、text primary/secondary、ownership colors、shadow、radius、spacing 和 typography。
- 不把 Figma raw hex 分散在 feature component 中。
- 桌面以 1440×900 为验证基准；较窄桌面允许 library/panel collapse，不能让 panel 覆盖关键 canvas interaction。
- Figma SVG/icon 若进入正式代码，下载并提交精确 asset；M2 如使用临时占位，必须在文档/代码中标为非视觉验收项。

## 10. 实施顺序

### M2.0 — Contract and fixtures

- 对齐 `packages/schemas` 中 Pattern、Agent、WorkflowGraph、CanvasLayout 与 revision 类型。
- 建立稳定 UUID fixtures 和四种 Pattern template fixtures。
- 建立 repository port 与 in-memory 实现。

完成标准：fixture 可以 load → command edit → save → reload，无 domain 数据损失。

### M2.1 — Shell and state boundary

- 建立两级路由、AppShell、Journey/Workflow page shell。
- 建立两个 Pinia store，明确 persisted、route、UI-only state。
- 建立语义 design tokens。

完成标准：直接访问、刷新和 browser back 能进入正确页面；临时 panel/mode 不被误建成路由或实体。

### M2.2 — Pattern strategy and System Canvas

- 实现四种 strategy、derived layout 与 template instantiate。
- 实现 slot render、select、context menu 与纯函数 drop evaluation。
- 实现 template drop、move/exchange、linear reorder、duplicate/unassign。

完成标准：所有操作只通过 store command 改变 PatternConfig；坐标与 Figma layer 不进入 contract。

### M2.3 — Preview and nested navigation

- 实现 read-only workflow adapter/preview。
- 实现单 preview 状态和 Open canvas route。

完成标准：选择 slot 不导航；Open canvas 才导航；preview 无编辑入口且不产生后端实体。

### M2.4 — Workflow canvas adapter

- 建立 domain ↔ Vue Flow adapter。
- 实现 node create/move/delete、edge create/delete、viewport round trip。
- 实现 Start/End 保护、cycle detection 和基础 validation reason code。

完成标准：Vue Flow 类型不越过 adapter；graph/layout/viewport reload 后等价恢复。

### M2.5 — Modes, nested Loop and DnD arbitration

- 实现 Flow/Configure、Focus Mode。
- 验证 Loop body nested canvas adapter。
- 用 fixture resource 验证 node/resource drag 隔离。

完成标准：所有交互组合不串扰；退出 mode/focus/loop 后编辑状态仍一致。

### M2.6 — Hardening and decision record

- 完成单元、组件和关键集成测试。
- 运行 lint、typecheck、test、production build。
- 记录 Vue Flow/HTML5 DnD 的已知限制、性能观测和 M3/M5 接入点。

完成标准：满足第 12 节验收条件，并形成 go/no-go 结论。

## 11. 测试计划

### 11.1 Domain unit tests

- 四种 template 实例化生成稳定结构和新 UUID。
- linear reorder 后 route 与 layout 正确重算。
- hub/diamond 的 role 不因 Agent exchange 改变。
- 同一 Agent 不能分配到多个 slot。
- duplicate 深拷贝并完整 remap owned IDs。
- Start/End 删除被拒绝。
- duplicate/self/cyclic edge 被稳定 reason code 拒绝。
- graph mutation 不改变 layout；node move 不改变 graph。

### 11.2 Adapter round-trip tests

- `WorkflowGraph + CanvasLayout → Vue Flow VM → commands` 不丢 semantic 字段。
- viewport 保存/加载误差在允许范围内。
- read-only preview adapter 不暴露可编辑 handler。
- Loop body adapter 不污染 parent canvas node IDs、viewport 或 selection。

### 11.3 Component/integration tests

- pattern/agent/resource payload 只触发对应 drop target。
- valid、invalid、occupied、duplicate 呈现正确 feedback。
- slot click 打开 preview，Open canvas 才导航。
- palette drop 创建 node；resource drop 不创建 node。
- Configure selection 打开 panel；Flow connect 创建合法 edge。
- Focus Mode 前后保持 viewport 和 selected node。
- save 状态覆盖 saving、saved、failed、conflict。

### 11.4 Manual exploratory matrix

至少在 Chrome 完成：鼠标拖拽、快速连续拖动、drop 后立即切换路由、缩放后刷新、拖拽经过 nested drop zone、Esc 取消、context menu 与 canvas pan 冲突、Focus Mode resize。若项目承诺 Firefox/Safari 支持，再加入对应 smoke test。

## 12. M2 验收标准

M2 只有同时满足以下条件才可标记完成：

1. 四种 built-in Pattern 均由 domain strategy 生成有效 `PatternConfig`。
2. System Canvas 是固定拓扑的派生视图，不是自由 Vue Flow graph。
3. Agent template assignment、move/exchange、linear reorder、duplicate 和 unassign 的语义明确且通过测试。
4. valid、invalid、occupied、duplicate drop 状态可观察、可测试。
5. configured slot → read-only preview → Agent Workflow Editor 的层级与路由符合 IA。
6. Workflow palette create、node move、edge create/delete、selection/panel 均可工作。
7. Start/End 受保护；任意环、nested Loop 和非法连接被拒绝。
8. WorkflowGraph、CanvasLayout、viewport 可独立保存并 reload 等价恢复。
9. Vue Flow 类型没有进入共享 schema、domain model 或 repository payload。
10. Flow/Configure 与 Focus Mode 切换不复制或丢失 graph/layout。
11. node drag 与 resource drag 不互相触发；合法/非法 resource zone 行为可验证。
12. 所有持久化修改经过 store/domain action；组件没有直接 mutation contract JSON。
13. `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 全部通过。
14. 形成一份简短技术决策记录，明确哪些 spike 代码保留、哪些在 M3/M5 前替换。

## 13. 风险与缓解

| 风险 | 早期信号 | M2 缓解 |
| --- | --- | --- |
| Vue Flow VM 泄漏到 domain | schema 出现 `position`、`selected`、Vue Flow import | adapter lint/review rule + round-trip test |
| HTML5 DnD 与 Vue Flow pointer 冲突 | resource drop 创建 node、pan 中断 | typed payload + central arbitration + nested-zone tests |
| fixed Pattern 被过度 canvas 化 | slot 坐标进入 persisted JSON | pure strategy 派生 route/layout |
| store 成为无边界大对象 | component 到处直接赋值 | command-only mutation，区分 domain/editor session |
| Loop 嵌套 canvas 状态串扰 | parent/child selection、viewport 同步变化 | 每个 canvas 独立 adapter context 与 namespaced IDs |
| Figma frame 被误建成路由 | Focus/panel/preview 出现在 router | 以 IA route map 为 router 测试基准 |
| M2 演变成完整 M5 | 开始实现资源 CRUD、复杂表单 | resource fixture 仅验证 DnD arbitration |
| 旧 version 语义回流 | 出现 Save Version/Restore store | 以 accepted constraints 为准，阻止相关类型进入 M2 |

## 14. M2 结束后的交付物

- 可运行的 Journey Editor 与 Agent Workflow Editor 技术骨架。
- Pattern strategies、workflow domain commands、validation 与 Vue Flow adapter。
- typed DnD protocol 和集中式 drag arbitration。
- in-memory repository、fixtures 和 revision/save-state 模拟。
- 单元、组件、集成测试与一次手工探索记录。
- ADR/结论文档，至少回答：
  - Vue Flow 是否满足 graph/layout/viewport 分离；
  - Loop body 是否使用同一 adapter 的独立实例；
  - HTML5 DnD 是否足够，或 M3/M5 是否需要 pointer-based DnD library；
  - 哪些 Figma 视觉 token 已进入 design-tokens；
  - M3 接真实 API、M4 扩完整校验、M5 扩资源配置的明确接口点。

## 15. 推荐的首个垂直演示

使用固定 fixture 完成以下路径，作为 M2 demo 与回归测试主线：

```text
打开 Research system Journey
→ 拖入 Linear sequence Pattern
→ 将 Research Agent 与 Planner Agent 放入两个 Slot
→ 交换两个 Agent，再把 Slot 顺序复原
→ 选择 Research Agent Slot，查看只读 Workflow Preview
→ Open canvas
→ 从 palette 添加 Agent Action、Branch、Task
→ 移动节点并创建合法 edge
→ 尝试创建 cycle，看到明确拒绝
→ 切换 Configure 并打开节点 panel
→ 进入/退出 Focus Mode
→ 拖一个 Tool fixture 到 Agent Action，确认未创建 workflow node
→ 保存到 in-memory repository 并 reload
→ graph、layout、viewport 和 Pattern assignment 等价恢复
```

这条路径覆盖 M2 的真实高风险点，同时保持与 M3、M4、M5 的职责边界。
