# Odyssey 前端工程规范

> Status: Engineering guideline  
> Scope: Odyssey Web 前端的架构、状态管理、交互实现、测试与代码评审  
> Stack: Vue 3、TypeScript、Pinia、Vue Router、Naive UI、Vue Flow  
> Related: [`M2 Interaction Proof — Frontend Implementation Plan`](./planning/implementation/m2-interaction-proof-frontend-implementation.md)

## 1. 目的

Odyssey 不是以普通表单为主的管理系统。它包含 Pattern topology、Agent Slot、Workflow Canvas、嵌套 Loop、资源拖放、配置面板、autosave 和 revision conflict 等高交互、高状态密度能力。

本规范的目标是：

- 让复杂交互仍然具有清晰、可测试的业务边界；
- 防止 Vue component、Pinia、Vue Flow 和 API contract 相互污染；
- 在功能扩展时避免状态组合和异步竞态失控；
- 让 bug 尽可能在类型检查、纯函数测试和 adapter 测试阶段被发现；
- 为实现、重构和代码评审提供统一标准。

本规范中的关键词：

- **必须**：除非有经过评审并记录的例外，否则必须遵守。
- **应当**：默认遵守；偏离时应能说明原因。
- **可以**：根据当前场景选择。

## 2. 三条核心边界

所有前端实现必须遵守：

```text
Domain State ≠ Canvas View Model
Persisted State ≠ Temporary UI State
User Event ≠ Direct State Mutation
```

具体含义：

1. 领域数据不能直接使用 Vue Flow node/edge、DOM 坐标或组件状态。
2. selection、panel、mode、focus、drag session 等 UI 状态不能进入后端保存数据。
3. click、drop、connect 等浏览器事件必须先转换为 typed intent/command，再修改领域状态。

违反这三条边界的实现，即使当前功能可用，也应视为架构缺陷。

## 3. 总体架构原则

Odyssey 前端采用 **Functional Core + Imperative Shell**：

```text
Vue Components / Vue Flow / Browser Events
                    ↓
              Typed Intents
                    ↓
          Application Commands
                    ↓
          Pure Domain Functions
                    ↓
             New Domain State
                    ↓
        Pinia Session / Repository
                    ↓
                 API
```

### 3.1 Functional Core

Functional Core 负责业务规则，优先使用无副作用的纯函数：

- 输入明确；
- 返回新状态或结构化错误；
- 不读取全局 store；
- 不访问 DOM、router、API、localStorage；
- 不依赖 Vue、Pinia、Vue Flow；
- 相同输入必须得到相同输出。

典型函数包括：

```text
instantiatePattern
assignAgentTemplate
moveAgent
exchangeAgents
reorderSlot
addWorkflowNode
removeWorkflowNode
connectWorkflowNodes
validateWorkflowGraph
derivePatternRoutes
```

### 3.2 Imperative Shell

Imperative Shell 负责副作用和运行时协调：

- Vue event handling；
- Pinia session；
- router navigation；
- API/repository 调用；
- debounce 和 autosave；
- 浏览器 drag/pointer event；
- toast、dialog 和 telemetry。

Shell 不应重新实现领域规则。它必须调用 Functional Core，并根据成功或错误结果更新 session/UI。

### 3.3 不以深层继承作为主要复用方式

Odyssey 前端优先使用：

- 函数组合；
- discriminated union；
- composable；
- 小型 adapter；
- 明确的 interface/port；
- slot 和组件组合。

除非确实存在稳定的多态对象生命周期，否则不应建立复杂 class hierarchy。继承不得用于隐藏状态修改或副作用。

## 4. 推荐分层

```text
apps/web/src/
├── app/             # App shell、全局 host、provider
├── router/          # 路由定义与 route parsing
├── domain/          # 纯领域类型、command、validation、strategy
├── repositories/    # 数据访问 port 与实现
├── stores/          # 编辑会话和 application orchestration
├── canvas/          # Vue Flow adapter、canvas view model、DnD 协调
├── features/        # 页面级功能模块
├── components/      # 跨 feature 的展示组件
└── styles/          # token 与共享样式
```

### 4.1 Domain

Domain 层只能依赖：

- TypeScript 标准能力；
- `@odyssey/schemas` 中稳定的共享 contract；
- 无 UI 语义的通用纯函数。

Domain 层不得导入：

```text
vue
pinia
vue-router
@vue-flow/*
naive-ui
DOM types used as business input
HTTP client
```

### 4.2 Application/Store

Store 负责加载文档、调用 command、协调 repository 和维护 editor session。Store 不能成为包含所有业务规则的巨型对象。

领域规则应放在 domain function；store action 负责用例编排：

```text
接收 intent
→ 调用 domain command
→ 应用成功结果或错误
→ 标记 dirty
→ 调度保存
```

### 4.3 Adapter

所有第三方库必须有明确边界。对于 Vue Flow：

```text
WorkflowGraph + CanvasLayout
             ↓
workflowCanvasAdapter
             ↓
Vue Flow nodes / edges / viewport
```

Vue Flow 类型不得进入：

- `packages/schemas`；
- domain model；
- repository interface；
- HTTP request/response；
- 数据库 contract。

### 4.4 Repository

组件不得散落调用 `fetch()`。数据访问必须通过 typed repository port：

```ts
interface WorkflowRepository {
  load(agentId: string): Promise<WorkflowDocument>
  save(input: SaveWorkflowInput): Promise<SaveWorkflowResult>
}
```

repository implementation 负责：

- HTTP transport；
- runtime response validation；
- DTO/domain mapping；
- transport error normalization；
- abort/cancellation。

repository 不负责 UI toast、router navigation 或 panel state。

### 4.5 Components

组件分为：

- **Container component**：连接 store、router 和 repository result。
- **Presentational component**：通过 props 输入，通过 emits 输出 intent。

展示组件不得自行决定业务动作的最终语义。例如 `AgentSlot.vue` 只发出 drop intent，不自行判断是 move、exchange、clone 或 replace。

## 5. 领域状态与 UI 状态

### 5.1 Persisted domain state

可以进入 repository 的状态包括：

- Journey metadata；
- PatternConfig、Slots、Routes；
- Agent identity/configuration；
- WorkflowGraph；
- CanvasLayout；
- viewport；
- Variables、Tools 和 Knowledge Space references；
- revision。

### 5.2 Temporary UI state

以下状态默认只属于 editor session：

- active tab；
- selected slot/node/edge；
- open preview；
- open panel 和 panel mode；
- Flow/Configure mode；
- Focus Mode；
- context menu；
- hover、drag-over 和 active drag session；
- loading skeleton 的局部展示状态；
- 未确认表单草稿。

UI-only state 不得：

- 写入 WorkflowGraph；
- 写入 CanvasLayout；
- 作为独立后端实体；
- 通过保存 domain document 间接持久化。

### 5.3 Store 结构

store 应显式区分 document 与 session：

```ts
interface WorkflowEditorState {
  document: {
    graph: WorkflowGraph
    layout: CanvasLayout
    revision: number
  }
  session: {
    selectedNodeId: string | null
    mode: 'flow' | 'configure'
    focusMode: boolean
    openPanel: PanelState | null
    interaction: InteractionState
  }
  persistence: SaveState
}
```

不得为了方便把整个 store 序列化为保存 payload。

## 6. Command-only mutation

所有持久化状态修改必须经过 domain command 或 store action。

禁止：

```ts
store.document.graph.nodes.push(node)
store.pattern.slots[index].agentId = agentId
node.data.config.tools.push(tool)
```

要求：

```ts
store.addNode(intent)
store.assignAgent(intent)
store.addResourceToAgentAction(intent)
```

每个 command 应明确：

```text
Command name
Input intent
Preconditions
Domain state changes
Layout state changes
UI-only changes
Error codes
Persistence behavior
```

一次用户操作如果需要同时改变多个领域对象，必须通过一个 transaction-like command 完成，不能由多个组件分别修改。

## 7. TypeScript 规则

### 7.1 使用 discriminated union

对于存在不同合法形态的数据，必须使用判别联合，不使用大量 optional 字段：

```ts
type OdysseyDragPayload =
  | { kind: 'agent-template'; templateId: string }
  | {
      kind: 'assigned-agent'
      agentId: string
      sourceSlotId: string
    }
  | {
      kind: 'workflow-node-template'
      nodeType: WorkflowNodeType
    }
  | {
      kind: 'resource'
      resourceType: 'tool' | 'knowledge-space'
      resourceId: string
    }
```

不允许使用以下弱类型替代：

```ts
interface DragPayload {
  type: string
  id?: string
  slotId?: string
  resourceType?: string
}
```

### 7.2 Exhaustive check

处理 union 时必须穷尽分支。新增类型后，编译器应能指出遗漏位置：

```ts
function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${JSON.stringify(value)}`)
}
```

### 7.3 禁止无约束类型逃逸

业务代码中原则上禁止：

- `any`；
- 无说明的 `as unknown as T`；
- 通过 non-null assertion `!` 掩盖缺失状态；
- 使用 `Record<string, unknown>` 长期替代已经稳定的 config schema。

边界输入必须通过 runtime validation 后才能进入 domain。类型断言只能出现在明确的 adapter/boundary，并附有可验证依据。

### 7.4 Identity

- 持久化对象使用 UUID string。
- template/definition key 使用稳定的 `snake_case`。
- 业务引用使用 ID，不使用显示名称、数组下标、Figma node ID 或坐标。
- duplicate/template instantiation 必须 remap 所有 owned IDs。

## 8. 交互状态机

复杂编辑器不得使用一组彼此独立的 boolean 表达交互状态：

```ts
// 不推荐
isDraggingNode
isDraggingResource
isConnecting
isConfiguring
```

应使用互斥的状态联合：

```ts
type InteractionState =
  | { type: 'idle' }
  | { type: 'dragging-node'; nodeId: string }
  | { type: 'connecting'; source: HandleRef }
  | { type: 'dragging-resource'; resource: ResourceRef }
  | {
      type: 'dragging-agent'
      sourceSlotId: string | null
    }
```

状态改变应通过统一 `transition(state, event)` 或同等明确的 transition action。组件不得各自维护互相矛盾的 drag flag。

需要显式状态机的典型区域：

- drag/drop；
- canvas connect；
- autosave；
- destructive confirmation；
- panel create/edit/dirty/submit；
- conflict resolution。

## 9. Drag and Drop 规范

### 9.1 Typed payload

所有拖拽使用统一、可解析的 typed payload。不同交互必须拥有不同 `kind` namespace。

### 9.2 Drop preflight

drop target 必须先调用纯函数：

```ts
evaluateDrop(payload, target, domainState)
```

返回结构化结果：

```ts
type DropEvaluation =
  | { status: 'valid'; action: DropAction }
  | {
      status: 'invalid' | 'occupied' | 'duplicate'
      reason: DropErrorCode
    }
```

只有 `valid` 才能派发 domain command。`dragover` 只提供视觉反馈，不得提前修改 domain state。

### 9.3 中央协调

Canvas node、Agent、Pattern、Tool 和 Knowledge Space drag 必须通过同一协调层识别 active drag kind。

必须保证：

- resource drop 不创建 workflow node；
- workflow node drop 不绑定 resource；
- nested resource zone 阻止 pane 二次消费有效 drop；
- 阻止二次消费不能破坏 pan、node move 和 connect；
- invalid drop 不留下部分修改。

## 10. Canvas 规范

### 10.1 Graph 与 Layout 分离

```text
WorkflowGraph
  semantic nodes、edges、configuration

CanvasLayout
  node placement、container placement、viewport

Editor Session
  selection、panel、mode、focus、drag
```

- node move 只能修改 CanvasLayout。
- node configuration 只能修改 WorkflowGraph。
- selection、hover、dragging 不得进入上述两者。
- graph validator 不得依赖节点像素坐标。

### 10.2 Vue Flow adapter

adapter 是 Vue Flow 和 domain 的唯一转换入口：

```text
toCanvasNodes(graph, layout)
toCanvasEdges(graph)
toViewport(layout)
fromViewport(viewport)
createConnectionIntent(connection)
createNodePlacementIntent(dropEvent)
```

Vue Flow event 不得直接写入 domain object。

### 10.3 Edge validation

连接分两层验证：

1. UI preflight：handle compatibility、自连接、duplicate 等即时检查。
2. Domain validation：候选 edge 加入后的 cycle、Start/End、Branch 和 Loop invariant。

UI 可以提前阻止明显错误，但 domain validation 是权威结果。

错误不得通过部分 mutation 后再回滚；应先在候选新状态上验证，成功后一次性提交。

### 10.4 Nested canvas

Loop body 等嵌套 canvas 必须拥有独立 adapter context：

- 独立 graph/layout；
- 独立 viewport；
- 独立 selection；
- namespaced DOM/Vue Flow IDs；
- 明确的 parent command boundary。

child canvas event 不得隐式修改 parent canvas session。

### 10.5 Read-only canvas

Workflow Preview 和只读 graph 必须由 read-only adapter/config 生成，而不是只靠隐藏按钮模拟只读。

必须禁用：

- node drag；
- connect；
- delete；
- configuration mutation；
- editable keyboard shortcut。

## 11. Pattern 规范

Built-in Pattern 使用 strategy 派生 topology、route 和 layout：

```ts
interface PatternStrategy {
  instantiate(template: PatternTemplate): PatternConfig
  validate(config: PatternConfig): ValidationResult
  deriveRoutes(slots: PatternSlot[]): PatternRoute[]
  deriveLayout(slots: PatternSlot[]): SystemCanvasLayout
  evaluateOperation(
    operation: PatternOperation,
    config: PatternConfig,
  ): OperationEvaluation
}
```

System Canvas 不是自由编辑的 Vue Flow canvas。Built-in slot 坐标属于派生 presentation，不进入 PatternConfig。

Pattern 操作必须保持：

- slot ID 稳定且唯一；
- route 只引用存在 slot；
- 一个 Agent 最多占用一个 slot；
- Agent exchange 不交换 topology role；
- linear reorder 后 route/layout 重新派生；
- template card/Figma layer 不成为持久化对象。

## 12. Autosave 与异步安全

### 12.1 Save state

保存状态必须显式建模：

```ts
type SaveState =
  | { type: 'clean'; revision: number }
  | { type: 'dirty'; mutationSeq: number }
  | { type: 'saving'; requestSeq: number; snapshotSeq: number }
  | { type: 'failed'; mutationSeq: number; error: SaveError }
  | { type: 'conflict'; localRevision: number; serverRevision: number }
```

### 12.2 防止旧响应覆盖新状态

至少跟踪：

```text
localMutationSeq
saveRequestSeq
snapshotSeq
serverRevision
```

只有确认对应当前 snapshot 的响应才能把状态改为 `clean/saved`。较旧响应不得覆盖较新的本地 document。

### 12.3 必须覆盖的竞态

- saving 中继续编辑；
- 多次 debounce；
- 较早请求晚于较新请求返回；
- 路由切换时存在 pending save；
- request abort；
- 网络失败后继续编辑；
- revision conflict；
- conflict 尚未解决时再次触发保存。

### 12.4 Destructive action

Pattern replacement、Agent deletion 等 destructive action 不得依赖普通 autosave 自动提交。必须：

- 明确展示影响范围；
- 用户确认；
- 作为原子 command/API operation；
- 失败时不留下部分状态。

## 13. 错误模型

Domain、repository 和 UI error 必须分层：

```text
DomainError
  CYCLE_DETECTED
  DUPLICATE_EDGE
  INVALID_DROP_TARGET
  START_NODE_IMMUTABLE

RepositoryError
  NETWORK_FAILED
  RESPONSE_INVALID
  NOT_FOUND
  REVISION_CONFLICT

UI presentation
  localized message、highlight、toast、dialog
```

Domain 返回稳定 error code，UI 负责将其映射为文案和反馈。不得在 domain 中写最终展示文案，也不得让组件通过 CSS state 或字符串推测错误原因。

## 14. Runtime validation

TypeScript 只能验证编译期，所有外部输入必须在边界验证：

- API response；
- imported JSON；
- local/session storage；
- drag payload serialization；
- route parameter；
- feature flag/configuration。

验证失败的数据不得以类型断言强行进入 domain。应返回结构化 boundary error，并保留足够诊断信息。

## 15. 测试规范

### 15.1 Domain unit tests

每个 domain command 至少覆盖：

- 成功路径；
- 每个 precondition 失败路径；
- 操作前后 invariant；
- 输入对象未被意外修改；
- ID/reference 完整性。

### 15.2 Invariant/property tests

对于 Pattern 和 Workflow，推荐使用随机操作序列持续验证：

```text
slotId 始终唯一
一个 Agent 最多占用一个 slot
所有 route 引用存在 slot
Start/End 始终存在
nodeId/edgeId 始终唯一
所有 edge 端点存在
graph 不存在任意环
layout placement 只引用存在 node
graph 不包含坐标
UI state 不进入 repository payload
```

可使用 `fast-check`，但是否引入依赖应由项目统一决定。

### 15.3 Adapter round-trip tests

Canvas adapter 必须验证：

```text
Domain Graph + Layout
→ Canvas View Model
→ User Intent
→ Domain Command
→ New Graph/Layout
```

至少覆盖：

- node move 只改变 layout；
- config edit 只改变 graph；
- viewport round-trip；
- Vue Flow 临时字段不进入 domain；
- read-only adapter 不暴露 mutation；
- nested canvas 不污染 parent state。

### 15.4 Component tests

组件测试关注用户可观察行为，不依赖内部实现细节：

- props 对应正确状态；
- event 转换为正确 intent；
- valid/invalid/occupied/duplicate 反馈；
- disabled/read-only 行为；
- panel/preview/mode 切换。

不要用大量 snapshot 替代行为断言。

### 15.5 Integration tests

复杂前端必须测试交互组合：

| 操作 A | 操作 B | 必须验证 |
| --- | --- | --- |
| 拖 workflow node | 经过 resource zone | 不触发 resource binding |
| 拖 resource | 落到 canvas pane | 不创建 workflow node |
| Focus Mode | panel 已打开 | viewport、selection 不丢失 |
| node move | autosave | 保存 layout，不污染 graph |
| 删除 node | panel 指向该 node | panel 进入稳定关闭/空态 |
| 切换 Agent Slot | preview 已打开 | preview 内容替换且只有一个 |
| 创建 edge | 形成 cycle | graph 保持原样并返回错误 |
| linear reorder | Agent 已配置 | Agent identity 保持稳定 |
| 较旧 save response | 新编辑已发生 | 不覆盖新 document |

### 15.6 Browser E2E

关键 canvas 行为最终应在真实浏览器验证：

- drag/drop；
- pointer capture；
- pan/zoom；
- connect；
- keyboard delete/Escape；
- Focus Mode resize；
- route navigation；
- autosave race。

推荐使用 Playwright。jsdom component test 不能替代真实浏览器的坐标和拖拽验证。

## 16. 视觉与设计系统

- Figma 是视觉和交互参考，不是代码或路由结构来源。
- 精确实现页面前读取对应 Figma node。
- Figma 输出的 React/Tailwind 代码必须转换为 Vue 和项目样式体系。
- 不得因 Figma 示例代码引入 Tailwind。
- 重复导航、panel、toolbar、card、status 和 canvas control 应抽成共享组件。
- 颜色、字体、spacing、radius、shadow 优先进入 `@odyssey/design-tokens`。
- feature component 不应散布 raw hex 和无命名 magic number。
- Figma 顶层 frame 可能是同一页面的 UI state，不得默认一 frame 一 route。
- visual detail 与领域规则冲突时，以领域规则为准并记录差异。

## 17. 可访问性与键盘交互

所有新交互必须至少考虑：

- 可聚焦元素；
- 可见 focus ring；
- 按钮/菜单/slot 的语义角色；
- Esc 取消 drag、menu、dialog 或临时 mode；
- Delete/Backspace 不误删正在编辑输入框之外的对象；
- context menu 可通过键盘打开；
- 颜色不是 valid/invalid 的唯一反馈；
- Focus Mode 进入和退出后的焦点恢复；
- dialog 的 focus trap 和返回焦点。

如果 drag 是唯一操作路径，必须规划等价的点击或键盘操作。M2 可以分阶段实现，但组件 API 不应阻止后续补充。

## 18. 性能规则

- 不因 hover、selection 或 viewport change 深拷贝整个 graph。
- 高频 pointer/node move 不触发 API save；使用节流后的 layout update 与 debounce persistence。
- computed/selectors 应按 ID 定位，避免在模板中重复扫描大型数组。
- Vue Flow view model 应保持稳定 key 和必要的引用稳定性。
- Preview/read-only canvas 不应订阅不相关 editor session。
- 对 graph validation 的复杂度建立基准；大图场景不得在每次 pointer move 时运行全图校验。
- 性能优化不得以破坏 graph/layout/state 边界为代价。

## 19. Observability 与调试

复杂交互应保留可诊断信息，但不得记录 secrets 或完整敏感文档内容。

推荐记录：

- command name；
- document ID 和 revision；
- mutation/request sequence；
- domain error code；
- drag kind 与 target kind；
- validation duration；
- save transition。

开发环境可以提供可关闭的 editor debug panel，显示：

```text
current revision
dirty/save state
selected IDs
interaction state
last command/error
graph/layout counts
```

debug state 不得进入 production persistence contract。

## 20. 代码组织与命名

- Vue component 使用 PascalCase。
- composable 使用 `useXxx`，但纯 domain function 不使用 `use` 前缀。
- command 使用业务动词，例如 `connectNodes`，不用 `handleConnectionDataChange`。
- event handler 可以使用 `handleXxx`，但必须尽快转换为 domain intent。
- boolean 使用可读前缀：`is`、`has`、`can`、`should`。
- ID 名称必须带实体语义：`nodeId`、`slotId`，避免通用 `id` 在跨实体参数中混用。
- 一个文件应围绕一个稳定职责组织，避免 `utils.ts` 无限扩张。
- 纯函数、adapter、repository、component test 尽量与实现共置或采用一致镜像目录。

## 21. 禁止模式

以下模式不得进入正式实现：

- 组件直接修改持久化 JSON；
- Canvas、side panel、preview 分别保存配置副本；
- Vue Flow node/edge 直接作为 API contract；
- 使用多个 boolean 表示互斥交互状态；
- 在 template/DOM handler 中实现复杂领域规则；
- 用数组 index、显示名称或坐标作为 identity；
- drop 过程中先修改状态、失败后尝试回滚；
- store action 同时混杂规则判断、HTTP mapping、toast 和 DOM 操作；
- 用 `any` 或类型断言绕过 boundary validation；
- 把每个 Figma frame 建成独立 route；
- 只依赖 snapshot 或人工测试复杂交互；
- autosave response 无序号地覆盖当前文档；
- 为快速演示创建无法替换的 mock 特例。

## 22. Definition of Done

一个前端功能完成必须至少满足：

1. Domain、UI state 和第三方 adapter 边界清晰。
2. 所有持久化修改通过 command/store action。
3. 外部输入在 boundary 完成 runtime validation。
4. Domain error 使用稳定错误码。
5. 成功和失败路径有测试。
6. Canvas 功能有 adapter round-trip test。
7. 复杂状态有显式 union/state machine。
8. Autosave 相关功能覆盖异步竞态。
9. 无无说明的 `any`、双重类型断言或直接 state mutation。
10. loading、empty、error、disabled、conflict 等相关状态已处理。
11. 基本键盘操作和 focus 行为可用。
12. lint、typecheck、test 和 production build 全部通过。

项目当前标准命令：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 23. Code Review Checklist

### Architecture

- [ ] Domain 是否依赖了 Vue、Pinia、Vue Flow、DOM 或 HTTP？
- [ ] 第三方类型是否通过 adapter 隔离？
- [ ] persisted state 与 UI-only state 是否分开？
- [ ] 是否存在重复事实来源？

### State and commands

- [ ] 用户事件是否转换成 typed intent/command？
- [ ] component 是否直接修改 domain object？
- [ ] 一次业务操作是否原子完成？
- [ ] 状态组合是否存在不合法 boolean 组合？

### Type safety

- [ ] union 是否具有 discriminator？
- [ ] switch 是否 exhaustive？
- [ ] 外部输入是否 runtime validated？
- [ ] identity 是否使用稳定 ID？

### Canvas and DnD

- [ ] graph、layout、selection 是否分离？
- [ ] node/resource/agent drag 是否可能串扰？
- [ ] invalid operation 是否在 mutation 前拒绝？
- [ ] nested/read-only canvas 是否真正隔离？

### Async

- [ ] 较旧 response 是否可能覆盖新状态？
- [ ] pending request 是否支持 abort 或 stale-result ignore？
- [ ] conflict、failure、retry 状态是否明确？

### Tests

- [ ] domain invariant 是否有测试？
- [ ] adapter 是否有 round-trip test？
- [ ] 是否测试了交互组合而非只有单组件 happy path？
- [ ] 真实 drag/pan/zoom 是否计划或已有 browser test？

## 24. 架构例外

如确需违反本规范中的“必须”规则，提交者必须在 PR 或 ADR 中记录：

```text
违反的规则
当前约束
替代方案为何不可行
风险范围
测试或隔离措施
移除例外的条件
```

“先做出来”“组件很小”或“第三方库就是这样”不能单独作为例外理由。

## 25. 最终原则

Odyssey 前端的复杂度主要来自状态与交互组合，而不是页面数量。稳定实现依赖以下顺序：

```text
先定义领域不变量
→ 再定义 command 与状态机
→ 再建立 adapter 和 repository 边界
→ 最后连接组件与视觉实现
```

组件可以变化，Canvas 库可以升级，API 可以替换，Figma 可以继续迭代；领域规则、identity 和状态边界必须保持稳定、明确且可测试。
