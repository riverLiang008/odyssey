# Odyssey Workflow Canvas Figma UI Calibration 实施计划

> Status: Proposed — awaiting review  
> Scope: M2.9 accepted 后的 Workflow Canvas UI 校准批次  
> Primary reference: Figma `Research Agent — Workflow Canvas` (`Odyssey-Design`, frame `62:2`)  
> Depends on: M2.8 First/Second Batch PASS、M2.9 PASS、现有真实 Web API 与 autosave/revision-CAS 能力  
> Primary outcome: 将当前横向 Resource Browser 迁移为设计稿中的右侧统一面板，并在不回退已验收功能的前提下校准页面骨架、Canvas controls、Palette、节点视觉和响应式行为

## 1. 背景与结论

当前 Workflow Editor 功能路径已经通过 M2.9 验收，但页面结构没有完全采用当前 Figma 的可见设计：

- 当前实现把 Tool / Knowledge Space inventory 展开成 Canvas 上方的横向 shelf；
- Figma frame 中该旧横向 shelf 图层仍然存在，但处于 hidden；
- 当前可见且权威的资源展示是 Canvas 右侧的 `Available Tools` panel；
- 顶部 `Tools / Knowledge Spaces / Agent Variables / DSL Edit / Reusable Tools` 是资源类别导航，不是资源内容本身；
- 当前 App banner 与 Workflow toolbar 构成重复的两层上下文导航；
- Resource Browser 与 Inspector 使用两套不同布局位置，无法形成稳定的右侧工作区；
- Focus Mode 直接移除 Palette，而设计要求可折叠且可恢复的 Canvas chrome。

因此本批不是简单换 CSS，而是一次受控的信息架构和页面 composition 校准：

```text
Global App Navigation
└─ Unified Product Header
   ├─ back / Agent context
   ├─ resource category navigation
   └─ persistence status / save actions

Canvas Workspace
├─ Workflow Palette
├─ Graph Canvas
│  └─ Canvas-local Flow / Configure / Focus controls
└─ Unified Right Panel Host
   ├─ Resource inventory
   └─ Node / Loop configuration
```

领域模型、canonical graph/layout、typed DnD、autosave state machine 和 API contract 不因视觉校准而改变。

## 2. Authority and required reading

实施前必须完整阅读：

1. `AGENTS.md`
2. `doc/frontend-engineering-guidelines.md`
3. `doc/planning/implementation/frontend/m2.8-modes-nested-loop-resource-dnd-implementation-plan.md`
4. `doc/planning/implementation/frontend/m2.8-first-batch-inline-loop-supplement-implementation-plan.md`
5. `doc/planning/implementation/frontend/m2.8-second-batch-node-drafts-resource-browser-hardening-implementation-plan.md`
6. `doc/planning/implementation/frontend/m2.9-autosave-races-e2e-adr-implementation-plan.md`
7. `doc/planning/implementation/frontend/m2.9-completion-report.md`
8. `doc/product/feature-specifications/resources/Update Agent Action Resource Configuration UI.md`
9. `doc/architecture/execution/Canvas Execution Model.md`
10. 对应 Figma frame 的最新 design context 与 screenshot

若 Figma 视觉示例与 accepted domain constraint 冲突，以领域约束为准，并在 completion report 中记录差异。

## 3. Frozen product decisions

### 3.1 Top category navigation

顶部冻结为资源配置类别导航：

- Tools；
- Knowledge Spaces；
- Agent Variables；
- DSL Edit；
- Reusable Tools。

规则：

- 点击类别切换右侧 Panel Host 的资源内容；
- Tools 与 Knowledge Spaces 使用真实 aggregate/API；
- 尚未实现的类别显示真实 unavailable/coming-soon state；
- 不提供 mock inventory、假 ID 或不可工作的操作入口；
- category selection 属于 editor session，不进入 save payload。

### 3.2 Unified right Panel Host

右侧只有一个稳定的 panel region：

```text
resource category selected
→ resource inventory panel

node / Loop configuration requested
→ configuration panel replaces resource inventory

configuration closed
→ restore previous resource category panel
```

Resource Panel 与 Inspector 不并排，也不形成第四列。Panel 的 open/collapsed/view state 全部属于 session。

### 3.3 Persistence controls

M2.9 已验收的以下能力必须保留：

- Saved / Unsaved changes / Saving / Save failed / Conflict 状态；
- Save now / Retry / Resolve conflict；
- route guard、conflict dialog 和 focus/accessibility contract。

Figma 旧 frame 未绘制这些能力不构成删除依据。它们应视觉整合进统一 Product Header，并在 Focus Mode 中继续可见。

### 3.4 Panel and Palette collapse

- 左侧 Palette 与右侧 Panel 分别独立折叠；
- 折叠不卸载 canonical document 或清空 selection/context；
- 关闭 Inspector 与折叠右侧 Panel 是不同 intent；
- Focus Mode 使用明确的 chrome policy，不通过散落的 `v-if` 直接销毁工作区；
- collapse/focus/category 属于 UI-only state。

## 4. Scope

### 4.1 In scope

- 单层 Workflow Product Header；
- 顶部资源类别导航；
- Canvas workspace 三区域 composition；
- 右侧统一 Panel Host；
- Tool/Knowledge Space inventory 从横向 shelf 迁移为纵向 sidebar；
- Resource Panel 与 Agent Action/Loop Inspector 的互斥切换和恢复；
- Canvas-local Flow / Configure / Focus controls；
- Palette 折叠和恢复；
- right panel 折叠和恢复；
- Tool/Knowledge cards、search、真实 supported filters、pagination/sort 的视觉校准；
- Start/End、普通 node、inline Loop、edge/handle 的视觉校准；
- 1440×900 基准布局；
- 1024×900 responsive/collapsed/overlay policy；
- Focus、Configure、inline Loop、panel、autosave 状态组合；
- keyboard/focus/accessibility；
- component/integration/browser regression。

### 4.2 Explicitly out of scope

- 新的 domain node type；
- Workflow graph/layout schema 变更；
- Tool、Knowledge Space、Variable、Reusable Tool 或 DSL 的后端 CRUD；
- 为 Figma 示例伪造 Built-in/Community/Recent metadata；
- 修改 DnD payload 或资源绑定业务语义；
- 修改 Loop parent/child ownership；
- nested Loop；
- execution/runtime；
-重新设计 autosave、CAS 或 conflict resolution；
-把 Figma 示例中的具体节点、坐标或名称写成默认业务数据。

## 5. Entry audit and blockers

编码前记录：

1. 最新 Figma `Research Agent — Workflow Canvas` frame geometry、visible/hidden layers；
2. 当前 AppShell、Workflow toolbar、Resource Browser、Palette、Canvas、Inspector 的 component tree；
3. 当前 editor session 中 focus/mode/panel/resource browser state 的所有权；
4. Tool 与 Knowledge Space API/aggregate 真实字段；
5. 是否存在 source/provenance/sort metadata；
6. M2.9 persistence controls 的 component ownership；
7. 1440×900 与 1024×900 当前 browser screenshots；
8. accepted M2.8/M2.9 aggregate IDs 与 retained 状态。

### 5.1 Metadata blocker rule

若 Tool contract 不提供 Built-in/Community/Recent 等信息：

- 不得从 `kind`、名称或 ID 猜测；
- 第一版只显示真实支持的筛选和稳定排序；
- Figma 中未被 contract 支持的 chip 标记为 deferred；
- 不阻塞右侧栏结构和真实 inventory 的迁移。

### 5.2 Visual authority rule

同一 Figma frame 中 hidden legacy layer 不作为实现目标。验收以 visible layer tree 与 screenshot 为准，禁止再次实现 hidden horizontal shelf。

## 6. Session and panel state model

建立或收敛为单一 discriminated union，避免 `isResourceOpen / isInspectorOpen / isCollapsed` 等不合法组合：

```ts
type WorkflowRightPanelState =
  | {
      type: 'collapsed'
      restoreCategory: WorkflowResourceCategory
    }
  | {
      type: 'resource'
      category: WorkflowResourceCategory
    }
  | {
      type: 'node-configuration'
      context: CanvasContext
      nodeId: string
      restoreCategory: WorkflowResourceCategory
    }
```

资源类别使用 exhaustive union：

```ts
type WorkflowResourceCategory =
  | 'tools'
  | 'knowledge-spaces'
  | 'agent-variables'
  | 'dsl-edit'
  | 'reusable-tools'
```

要求：

- state 只存在 store/session 或专门 composable；
- 不进入 graph、layout、Agent payload 或 autosave；
- selection 消失、node 删除、route change 时进行显式 transition；
- Loop child/root context 不相互污染；
-关闭 configuration 恢复此前 category；
- stale async inventory response 继续由 request sequence/abort 防护；
- component 只 emit typed intents。

Palette 另用明确状态：

```ts
type WorkflowPaletteState = 'expanded' | 'collapsed'
```

Focus Mode 可以驱动默认 chrome presentation，但不得篡改用户的 canonical resource/selection state。

## 7. Target layout

### 7.1 1440×900 baseline

以 Figma 为基准：

- Global Navigation：约 `204px`；
- Product Header：约 `64px` 高；
- Canvas workspace outer panel：约 `1180 × 786px`；
- Palette expanded width：约 `190px`；
- Right Panel expanded width：约 `384px`；
- Graph Canvas：`minmax(0, 1fr)`；
- controls 位于 Canvas workspace 内部右上；
- browser page 不产生非预期纵向/横向 overflow。

建议结构：

```css
grid-template-columns:
  var(--workflow-palette-width)
  minmax(0, 1fr)
  var(--workflow-side-panel-width);
```

折叠列使用命名 token，不通过散落 magic number 或负 margin 实现。

### 7.2 1024×900 policy

- Canvas 保留最小可操作宽度；
- Palette 默认可以折叠为窄 rail；
- Right Panel 默认可以折叠；
-展开 Right Panel 时使用受控 overlay/drawer 或明确的 compact column；
-不得把 Resource Panel 回退成 Canvas 顶部横向 shelf；
- overlay 不阻断关闭、键盘 focus 或 Canvas pan/zoom；
-不得产生页面级水平滚动。

### 7.3 Single header hierarchy

移除视觉重复，但保留必要语义：

```text
Back + Agent / Workflow context
Resource category navigation
Persistence status + Save action
```

Flow / Configure / Focus 独立放在 Canvas workspace control layer。

## 8. Resource sidebar

### 8.1 Tools panel

目标顺序：

1. `Available Tools` title；
2. Collapse action；
3. labeled search；
4. supported filter/sort controls；
5. vertical Tool card list；
6. loading / empty / no-match / error；
7. pagination 或稳定的增量浏览；
8. drag/click usage hint。

Tool card 读取真实 canonical inventory，展示：

- name；
- kind/description 中真实存在的信息；
-可验证的来源或状态；
- draggable/disabled reason；
- keyboard/click equivalent binding path。

### 8.2 Knowledge Spaces panel

复用相同 sidebar shell，但保留 Web API 的：

- loading；
- empty；
- no-match；
- error/retry；
- server search/page；
- stale request ignore；
- root/Loop-child bind/unbind。

### 8.3 Deferred categories

Agent Variables、DSL Edit、Reusable Tools 在没有完整产品能力时：

- 顶部类别可见；
-右侧显示准确的阶段性状态和能力说明；
- 不伪造列表和 disabled-looking-but-clickable action；
-不改变 M2.8 既有 Variable prerequisite/domain 数据路径。

## 9. Configuration panel integration

现有 Inspector 内容迁入统一 Panel Host：

- Agent Action configuration；
- Loop configuration；
-其他已有 node Inspector。

要求：

- Inspector 仍读取同一 canonical node config；
-表单 draft 保持 UI-only，确认后走既有 typed application command；
- root/Loop-child context 显式携带；
-关闭 Inspector 恢复先前 resource category；
-删除当前 selected node 时 panel 稳定回到 resource/empty state；
- Configure → Flow 不丢失 canonical config，也不产生隐式 save；
-不复制 node config 到 sidebar local source of truth。

## 10. Canvas visual calibration

### 10.1 Protected nodes

不再将 Start 与 End 强制为同一尺寸：

- Start 使用更明确的入口层级；
- End 使用更轻量的终点层级；
-尺寸、文字、handle 和 edge intersection 使用 token；
- root Start/End 与 Loop Start/End 语义可区分，但共享一致的 visual grammar。

### 10.2 Workflow nodes

校准 Agent Action、Task、Branch、Loop：

- type label、name、summary 的文字层级；
- border/accent/status color；
- padding、radius、最小/最大宽度；
- compact Flow state 与 detailed Configure state；
- resource chips、`+N more` 和 drop zone；
- selection/focus/invalid/disabled state；
- handle 与 node boundary 对齐。

Figma 示例数据不写入 canonical defaults，节点内容由真实 aggregate 决定。

### 10.3 Inline Loop

继续保持 accepted 结构：

```text
Root Start / End
└─ Loop parent container
   └─ Loop Start → child graph → Loop End
```

- child canvas 保持独立 adapter context；
- parent/child graph、layout、selection、viewport 不混用；
- container padding、header、boundary 和 child controls 对齐 Figma；
-不得退回“进入 Loop 后整个 root canvas 被替换”的旧表现。

### 10.4 Edges and handles

- edge 连接 node/card boundary；
-箭头不进入节点文字或容器边界；
- selection ring 不改变 endpoint geometry；
- branch/loop/root/child edge 层级清晰；
-缩放、Focus、panel resize 后 handle/edge 仍对齐；
-不通过 DOM 测量结果写回 domain graph。

## 11. Interaction rules

### 11.1 Category and panel transitions

-点击顶部类别打开/切换 Resource Panel；
-选择节点并请求 Configure 时切到 configuration；
-关闭 configuration 恢复此前 category；
- Collapse 保存 restore target；
- route/document change 重建合法 baseline；
- Escape 只关闭当前最上层临时 UI，不触发 Canvas delete。

### 11.2 DnD preservation

迁移布局时继续使用现有 canonical typed payload、drop preflight 和 application commands：

- sidebar resource → valid Agent Action zone；
- resource → pane 不创建 node；
- node template → resource panel 不绑定资源；
- root/child target 不串扰；
- duplicate/cross-type/unavailable 在 mutation 前拒绝；
-折叠/overlay 不留下 active drag session；
-invalid feedback 不显示大面积红框。

### 11.3 Focus and mode

- Flow / Configure 是 Canvas capability，不是 resource category；
- Focus 进入/退出保留 selection、viewport、panel restore state；
- Focus 下 persistence 状态仍可见；
- Palette/Panel chrome 根据 policy 折叠而不是销毁 canonical context；
- return focus 明确且可测试。

## 12. Component boundaries

建议目标组件：

```text
WorkflowProductHeader
├─ WorkflowContextBreadcrumb
├─ WorkflowResourceCategoryNav
└─ EditorSaveStatus

WorkflowCanvasWorkspace
├─ WorkflowPalette
├─ WorkflowCanvasStage
│  └─ WorkflowCanvasControls
└─ WorkflowRightPanelHost
   ├─ WorkflowResourcePanel
   │  ├─ ToolInventoryPanel
   │  ├─ KnowledgeSpaceInventoryPanel
   │  └─ ResourceUnavailableState
   └─ WorkflowConfigurationPanel
```

要求：

- presentational components 只接 props/emits；
- repository 只由 container/store 调用；
- Panel Host 不复制 canonical node/resource config；
- Vue Flow types 不进入 resource/navigation/session domain；
- geometry/token 放入命名 CSS variables/design tokens；
-避免一个 View 同时承担 route、repository、panel transition、DnD 和全部视觉 markup。

## 13. Implementation sequence

### Step 0 — Baseline evidence and contract freeze

-保存 Figma visible layer、1440/1024 当前截图；
-记录当前 component/session ownership；
-审计 Tool metadata 和真实 supported filters；
-冻结 header/panel/collapse transitions；
-补充现有 M2.8/M2.9 regression baseline。

Gate：无 mock 假设；每项 visual delta 均有 Figma 或产品决定依据。

### Step 1 — Pure panel state and transitions

-新增/收敛 `WorkflowRightPanelState`；
- resource category exhaustive union；
- open/configure/close/collapse/restore/node-removed/route-change transitions；
- Palette collapse state；
- save payload isolation tests。

Gate：所有合法状态由 union 表达；UI-only state 不进入 document/payload。

### Step 2 — Unified Product Header

-合并重复 App banner/editor context；
-加入顶部 resource category nav；
-迁移并保留 M2.9 persistence status/actions；
-将 Flow/Configure/Focus 移到 Canvas-local controls；
-键盘/focus/ARIA。

Gate：只有一层上下文 header；所有 M2.9 save/conflict actions 仍可达。

### Step 3 — Three-region workspace shell

-建立 Palette / Canvas / Right Panel 的统一 layout；
-命名 width/spacing tokens；
-迁移现有 canvas，不改变 graph/layout adapter；
-实现独立 Palette/Panel collapse；
-禁止页面级 overflow regression。

Gate：1440×900 结构与 Figma 对齐；Resource content 不再位于 Canvas 顶部。

### Step 4 — Vertical Resource Panel migration

-将 Tools/Knowledge inventory 迁入 Right Panel Host；
-纵向 search/filter/list/pagination/status；
-真实 supported metadata only；
-保留 typed DnD、click/keyboard binding；
-删除/停用 legacy horizontal shelf render path。

Gate：root/child Tool 与 Knowledge bind/unbind/save/reload 无回归。

### Step 5 — Inspector integration

- Agent Action/Loop/other Inspector 接入 Panel Host；
- configuration replace/close/restore transitions；
- selected-node delete、mode switch、route change；
-表单 draft/canonical config 单一事实来源回归。

Gate：任何时刻右侧只有一个合法 panel view，无配置副本。

### Step 6 — Canvas and node visual calibration

- protected node proportions；
- node card typography/spacing/accent；
- inline Loop container；
- edges/handles/selection/focus；
- Figma-aligned empty/loading/disabled states。

Gate：不同 viewport/zoom/panel state 下 edge geometry 正确，Canvas domain 未改变。

### Step 7 — Responsive, Focus and accessibility hardening

- 1024×900 rail/overlay behavior；
- 1440×900 exact composition；
- Flow/Configure/Focus/panel/Loop combinations；
- focus trap/return、Escape、keyboard category/collapse；
- screen reader labels 和 reduced-motion-safe transition。

Gate：无 page overflow、无不可恢复 panel、无键盘死路。

### Step 8 — Real browser regression and documentation

-真实 API aggregate browser matrix；
- M2.8 creation/resource/Loop 回归；
- M2.9 autosave/failure/conflict/route guard 回归；
- console、visual screenshots、quality gates；
- completion report 与独立 acceptance prompt。

## 14. Required tests

### 14.1 Pure/session tests

- category switch；
- resource → configuration → close → restore；
- collapsed → restore；
- selected node removed；
- root/Loop child context；
- document/route replacement；
- exhaustive unavailable category；
- Panel/Palette/category/focus 不进入 save payload。

### 14.2 Component tests

- single header hierarchy；
- resource category keyboard navigation；
- save state/actions preserved；
- Canvas controls placement and capability；
- Palette/Panel collapse buttons and focus return；
- Tool/Knowledge loading/empty/error/no-match；
- vertical card DnD serialization；
- Inspector replacement/restoration；
- unsupported category honest unavailable state。

Teleport/overlay 测试必须 attach 到 document 并清理，不重复 M2.4 context-menu 测试失效问题。

### 14.3 Integration tests

- resource bind while Configure mode；
- Panel collapsed during drag cleanup；
- Focus with Inspector open；
- node delete while configuration open；
- Loop child configuration then restore resource inventory；
- autosave state transitions across panel/mode changes；
- session-only UI changes do not increment mutationSeq；
- resource mutation increments exactly once and saves canonical config。

### 14.4 Browser matrix

至少验证：

1. 1440×900 default Flow；
2. 1440×900 Configure + Tools；
3. 1440×900 Knowledge loading/empty/error/loaded；
4. Agent Action Inspector replace/close/restore；
5. inline Loop Inspector 与 child context；
6. Palette collapse/restore；
7. Right Panel collapse/restore；
8. Focus enter/exit preserves viewport/selection/panel；
9. 1024×900 collapsed/overlay policy；
10. Tool root/child bind/unbind/save/refresh；
11. Knowledge root/child bind/unbind/save/refresh；
12. Agent Action/Loop create regression；
13. autosave edit-during-save；
14. revision conflict recovery；
15. route guard；
16. keyboard-only category/panel/configuration path；
17. console warning/error/unhandled rejection zero。

## 15. Visual acceptance checklist

### Header

- [ ] 不再出现重复的 OdyJourney 返回/上下文栏；
- [ ] 顶部类别是 navigation，不展开资源内容；
- [ ] save status/actions 始终可达；
- [ ] Flow/Configure/Focus 位于 Canvas control layer。

### Workspace

- [ ] Resource inventory 位于右侧栏；
- [ ] Palette、Canvas、Right Panel 属于同一个 workspace；
- [ ] Inspector 与 Resource Panel 共用一个 host；
- [ ] 折叠后 Canvas 合理扩展；
- [ ] 不渲染 legacy horizontal shelf。

### Canvas

- [ ] Start/End 层级和尺寸符合设计；
- [ ] Agent Action/Task/Branch/Loop 卡片层级清楚；
- [ ] inline Loop 保持 parent container + child graph；
- [ ] edge、arrow、handle、selection 对齐；
- [ ] Figma 示例内容未成为 mock/default data。

### Responsive

- [ ] 1440×900 与 Figma composition 对齐；
- [ ] 1024×900 无页面级 overflow；
- [ ] 窄屏 Resource Panel 不回到顶部 shelf；
- [ ] Focus/overlay/collapse 可恢复且键盘可用。

## 16. Quality gates and Definition of Done

本批只有在以下条件全部满足时 PASS：

1. lint、typecheck、test、production build 全绿；
2. 当前 Figma visible design 被实现，hidden legacy shelf 未被渲染；
3. Tool/Knowledge inventory 使用右侧统一 Panel Host；
4. top categories 控制右侧 panel，并对未实现能力诚实降级；
5. Inspector 与 Resource Panel 不并存、不复制 canonical config；
6. M2.8 typed DnD、root/child、inline Loop、save/reload 无回归；
7. M2.9 autosave、retry、conflict、navigation guard 无回归；
8. UI-only panel/category/collapse/focus state 不进入 payload；
9. 1440×900、1024×900、Focus/Configure/Loop 组合通过真实浏览器验收；
10. keyboard/focus/accessibility contract 可用；
11. console 无 warning/error/unhandled rejection；
12.无 P0/P1；
13. completion report 记录 Figma 差异、deferred metadata、真实 acceptance IDs 与 cleanup 状态。

## 17. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| UI 重排破坏 Canvas 尺寸/viewport | 使用 ResizeObserver/Vue Flow adapter 的既有 resize 路径；测试 viewport/selection 保持，不写回错误 domain layout |
| Inspector 与 Resource Panel 双重事实来源 | 单一 Panel Host + canonical config selector；panel form draft 只在明确提交后进入 command |
| Focus/Collapse 状态组合爆炸 | discriminated union + pure transition tests，不新增互相独立 boolean |
| DnD target 因 sidebar/overlay 迁移而穿透 | 保留 canonical payload/preflight；补充 sidebar、overlay、root/child propagation browser matrix |
| Figma filter 缺后端字段 | 只暴露 contract 真正支持的 filter；记录 deferred，不推断 metadata |
| 删除旧 shelf 导致测试只查 wrapper 失败 | 组件测试面向用户行为；Teleport/overlay attach document 并在 afterEach 清理 |
| M2.9 persistence UI 在视觉重排中丢失 | 将保存能力列为冻结 contract；每个 state 都有 component/browser regression |
| 追求像素一致引入 magic number | 几何先进入命名 token/CSS variable；1440 基准 + 1024 policy，不散落负 margin/absolute patch |

## 18. Deliverables

完成后交付：

- Workflow Canvas Figma UI calibration implementation；
- pure panel transition tests；
- component/integration/browser regression；
- 1440×900、1024×900 before/after evidence；
- completion report；
- 独立验收 prompt；
- retained acceptance data 与 cleanup 说明。

