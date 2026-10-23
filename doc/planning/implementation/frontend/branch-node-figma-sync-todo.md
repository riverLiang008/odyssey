# Branch 节点与 Figma 同步 TODO

状态：实现与自动检查完成；浏览器视觉验收待完成  
日期：2026-10-23  
范围：仅 Branch 节点、Branch 配置侧栏及其必要的领域命令、store、adapter 接线和测试。

## 设计依据

- [UI-25 · Branch Configuration](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=875-98)
- [UI-26 · Branch Flow Overview](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=875-214)
- [UI-27 · New Branch](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=875-271)
- [UI-28 · Branch Validation States](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=875-362)
- [UI-29 · Branch Editing Details](https://www.figma.com/design/P3EF9io2DhyhwkNYBVqB5Z/Odyssey-Design?node-id=875-480)
- `doc/frontend-engineering-guidelines.md`
- `doc/architecture/execution/Canvas Execution Model.md` 的 Branch 章节。
- `doc/architecture/data/contracts/canonical-json-contracts-draft.md` 的 8.5 节。

视觉以最新确认版本为准：白底、黄色细边框、与 Task / Agent Action 一致的圆角卡片，不使用实心黄色类型标签。选中与键盘聚焦可使用独立外层提示，保留黄色类型边框。

## 当前实现与可复用能力

- `WorkflowNodeRenderer.vue` 已显示 Case / Default 摘要，但缺少具体条件、配置状态和与每行对齐的出口；出口目前按整张卡片高度均分。
- `WorkflowSidePanelHost.vue` 尚无 Branch 专属配置表单，仍展示通用类型和 ID。
- `workflowCommands.ts` 已有 `addBranchCase`、`updateBranchCase`、`reorderBranchCase`、`removeBranchCase`；删除 Case 会同时移除其出线，应复用并补齐上下文接线。
- 连接命令已有 handle 所属校验及单出口最多一条出线校验。
- `workflowCanvasAdapter.ts` 已通过 Case / Default UUID 生成端口，根图与 Loop body 都有对应投影。
- 当前 schema 支持 AND、全部十种比较运算符、literal / variable 操作数；每个普通 Case 必须至少包含一条结构完整的条件，Default 可独立存在。
- 当前工作区包含大量既有未提交修改。实施时基于当前内容增量修改，不能覆盖、回退或格式化无关代码。

## 范围边界

只实现 Branch 的画布表现、配置交互和保存接线。共享文件允许添加必要的 Branch 条件分支，但不改其他节点行为、页面布局、导航、资源面板或通用保存机制。

不修改 Task、Agent Action、Loop、Start / End、Pattern，也不调整其他节点的颜色、尺寸、端口和拖放行为。不增加执行引擎、OR、并行路径或跨层连线。不变更 API、数据库、schema 或持久化格式。已有合法的 Default-only Branch 保持可读、可编辑，不在加载时自动补写 Case。

Branch 位于 Loop body 时应具备相同配置能力；只复用既有嵌套图命令边界，不改变 Loop 容器本身。只读 Preview 可自然复用 Branch 新外观，不修改 Preview 的布局、缩放或交互。

## 必须先处理的草稿边界

Figma 的“Case 1 / No conditions yet”是待配置状态，与当前 schema 对普通 Case 的要求不同。采用临时 UI 草稿满足设计，不放宽契约，也不伪造一个永远为真的条件。

- 新建 Branch 与新增 Case 的未完成字段放入 session draft，使用稳定 UUID；成功确认后才提交合法领域配置。
- 新建时展示 Case 1 + Default 的配置草稿。若画布同时显示新建预览，预览必须作为 adapter 的临时呈现，不能混入真实 WorkflowGraph / CanvasLayout；未提交出口不允许建立真实 edge。
- 普通 Case 完成至少一条有效条件后，通过创建或新增 command 原子提交。已存在的 Case 在编辑期间保持最后一次合法配置，不能被不完整输入覆盖。
- 面板、Canvas 与 Preview 不各自保存一份独立领域配置；临时草稿由一个 session owner 管理，画布如需展示草稿从同一来源派生。
- 草稿表单使用明确的确认 / 取消边界；提交后的领域修改进入现有 dirty / autosave 流程。未确认草稿不会显示“已保存”，也不会进入导出或 API payload。
- 切换节点、关闭面板、删除宿主、切换 Agent 时明确处理未提交草稿；不得把旧节点的草稿应用到新节点。存在外部更新或 revision conflict 时不静默覆盖。
- 一个出口尚未连线可以作为编辑中状态保留，显示诊断；不能因此禁止用户分步搭图。不要把结构可保存与工作流已可运行混为一谈。

## TODO

### 1. 实施准备

- [x] 完整阅读本次前端规范并检查当前 Branch 入口与契约。
- [x] 实施当天重新完整阅读前端规范，读取最新 Figma 对应节点的设计上下文。
- [x] 记录实施前 diff 和检查结果；把后续新增修改与已有工作区修改区分开。
- [x] 核对 Branch 创建入口、变量可见性 resolver、root / Loop body command 通路及已有测试，确定最小修改集合。

### 2. Branch 草稿与命令接线

- [x] 增加 Branch 专属 typed draft / intent 和纯解析、验证函数，覆盖新建、Case 编辑和条件增删。
- [x] 从现有类型导出或推导条件联合，不引入 `any`、不以弱类型字典代替条件模型。
- [x] 复用现有 Case/出口校验语义，以 Branch 专属批量原子命令和 store action 提交；同时携带 `WorkflowCanvasContext` 和稳定 node / case / condition UUID。
- [x] root 与 Loop body 都通过既有命令边界提交；删除 Case 和对应出线作为一次原子操作，失败时无部分状态。
- [x] 重命名、重排与条件修改保留 Case UUID 和已有 edge；Default 不能删除或排到普通 Case 之前。

### 3. Branch 配置侧栏

- [x] 新增独立 `BranchConfigPanel.vue`，由 Host 仅在 Branch 分支挂载，避免把完整表单堆进共享 Host。
- [x] 提供节点名称、Case 名称、添加 / 删除 Case、上下移动及拖动排序；键盘有等价排序路径。
- [x] 提供条件增删，显式展示 AND 与“按顺序判断，首个命中生效”的规则。
- [x] 支持变量选择与搜索、操作符、literal / variable 右值；按值类型解析数字、布尔、字符串和 JSON，不接受空数字输入隐式转换为 0。
- [x] 支持 `eq`、`neq`、`gt`、`gte`、`lt`、`lte`、`contains`、`not_contains`、`is_empty`、`is_not_empty`；一元条件不保留 `right`。
- [x] 变量从现有可见性规则派生，不能暴露其他 Task 私有变量；失效引用保留原 ID 并提示修复，不自动替换。
- [x] 核对已有运算符类型兼容规则后复用；若尚无完整类型矩阵，先实现 Branch 专属前端验证并测试，不宣称它是已存在的后端约束。
- [x] Default 固定在末尾、无条件；去向通过画布连线配置，侧栏不增加可编辑 `routeTo`。
- [x] 删除已连接 Case 时列出条件数、连线数和受影响目标，确认后删除 Case 与连线，保留目标节点。
- [x] 提供未完成、无可选变量、变量失效、保存失败、冲突及只读状态；错误紧邻字段，不只靠颜色传达。

### 4. Branch 画布展示

- [x] Flow 显示名称、Case / Default 顺序与出口；Configure 显示条件摘要、Fallback 与待配置 / 错误提示。
- [x] Branch 专属黄色细边框、白底、圆角，复用现有 design tokens；仅使用 Branch 选择器，不改 `.workflow-node-card` 通用规则。
- [x] 以 Case UUID 对齐行与 source handle；Default 独立出口，不能只按总高度均分。
- [x] 动态添加、删除、排序和文本换行后刷新 Vue Flow handle 测量，根图和 Loop body 保持一致。
- [x] 节点尺寸由 Branch 内容与既有 adapter 机制推导，不改变其他节点尺寸或已有布局坐标。
- [x] 面板编辑不误触发节点拖动、画布平移、连线或 Delete 快捷键；保持 click / double-click 与现有模式规则一致。

### 5. 验证与交付

- [x] Domain / draft：输入不变性、合法和失败路径、稳定 UUID、Case 增删改排、默认分支保护、一元运算符、类型解析与失效变量。
- [x] Store：root / Loop body 的原子更新、草稿取消、节点切换、宿主删除、dirty / autosave 接线和 conflict 下的草稿保护。
- [x] Adapter：Case 排序 / 重命名前后 sourceHandleId 不变，临时草稿不进入保存数据，配置改变不污染布局。
- [x] Component：用户可观察的 Case / 条件编辑、校验反馈、删除确认、只读行为和键盘操作。
- [ ] 浏览器：对照 UI-25～29，验证长名称、多 Case、滚动侧栏、动态端口、连线、保存重载，以及 Loop body 内的 Branch。
- [x] 最小回归：Task / Agent Action / Loop、Preview、资源拖放和 Flow / Configure 切换保持原有行为；不为此顺带修改其他节点。
- [x] 执行 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`，记录本次新增问题与既有失败；浏览器验收单独记录。
- [x] 复查最终 diff：每处修改均能解释为 Branch 的必要实现；更新本 TODO 的完成项与验证证据。

## 预期文件范围

新增以 Branch 命名的草稿、表单和测试文件优先，命名可按实际模块约定细化：

- `apps/web/src/domain/workflow/branchDrafts.ts` 及对应测试。
- `apps/web/src/features/workflow-editor/BranchConfigPanel.vue` 及对应测试。
- Branch 专属展示组件 / 样式（如有必要），避免修改通用卡片行为。

必要接线可能涉及以下共享文件，但仅允许 Branch 相关增量：

- `apps/web/src/features/workflow-editor/WorkflowNodeRenderer.vue`
- `apps/web/src/features/workflow-editor/WorkflowSidePanelHost.vue`
- `apps/web/src/features/workflow-editor/WorkflowCanvas.vue`
- `apps/web/src/features/workflow-editor/InlineLoopCanvas.vue`
- `apps/web/src/features/workflow-editor/workflow-editor.css`
- `apps/web/src/views/AgentWorkflowView.vue`
- `apps/web/src/stores/workflowEditor.ts`
- `apps/web/src/domain/workflow/workflowCommands.ts`、`loopBodyCommands.ts` 及相关创建入口。
- `apps/web/src/canvas/workflow/workflowCanvasAdapter.ts` 及相关 adapter / transaction（仅当 Branch 动态出口和草稿投影确有需要）。

不预设上述文件全部需要修改。实施前按实际调用链缩小范围；如果发现必须修改后端或契约才能完成某项能力，记录具体缺口并单独说明，不夹带到此次 Branch 前端实现中。

## 实施记录

- 新增 `branchDrafts.ts`、`branchCommands.ts`、`BranchConfigPanel.vue`、`BranchOperandField.vue`、`BranchNodeContent.vue` 与 UI-only 的 `branchPanelSession.ts`。
- 采用一次 Apply 提交完整 Branch 草稿及删除 Case 的出线变更，覆盖 root / Loop body；避免多个表单事件分次提交留下中间状态。沿用既有 graph validator 和稳定 UUID 语义，不修改 schema、后端或其他节点命令。
- 新建 Branch 先打开 Case 1 + Default 的草稿表单，确认合法配置后落入画布；本批次不增加可连线的临时画布节点。旧 Default-only 节点不会被加载操作自动改写。
- 未提交草稿按节点缓存在当前 editor session，切换面板可恢复；关闭时可确认丢弃。离开页面接入既有 unsaved guard；宿主删除和 Agent 切换清理对应缓存。
- Branch 外观使用黄色类型边框和独立选中提示；Case 行内拥有 UUID handle，动态尺寸变化后更新端口几何。没有可测量布局时等待 ResizeObserver，避免向 Vue Flow 提交零尺寸。
- 为 Preview 的 Branch 补充只读变量名称输入；未改变 Preview 的缩放、布局与其他节点的输入行为。
- 侧栏或确认弹窗中的 Delete / Backspace 不触发画布节点删除；确认删除 Case 后把焦点返回仍存在的控件。
- 对象字段顺序不参与 Branch 并发快照比较，Case / 条件的数组顺序仍保留语义。
- 浏览器阻碍：两次通过内置浏览器打开本地验收页面均未成功，分别为 webview attach 超时与本地页面连接超时。尚未确认实际像素、拖拽、滚动、端口几何及长文本布局；jsdom 测试不代替该项验收。

## 自动检查结果

- `pnpm lint`：通过；最后的 Branch 改动另以定向 ESLint 验证通过。
- `pnpm typecheck`：通过；最终 `pnpm build` 同时再次执行 web 的 `vue-tsc -b` 并通过。
- `pnpm build`：通过。产物中已核对包含无布局时跳过端口刷新、确认弹窗与焦点返回的最终实现。
- 测试：schemas 9 个文件 / 93 项通过；web 最终完整重跑 `pnpm --filter @odyssey/web test --pool=threads`，92 个文件 / 534 项全部通过，无未处理异常。线程池是本次运行参数，没有修改仓库测试配置。
- `pnpm test` 首轮暴露了 Branch 对象字段顺序造成的误判，以及 jsdom 无布局时触发的 Vue Flow DOMMatrix 异常；均已修复，并包含在上述最终完整回归中。
- 另有 Branch 专项 17 项通过，以及最终确认弹窗 / 新建流程专项 7 项通过；最终完整回归包含这些用例。
- 原工作区已有改动保持原样；此次增量限定为 Branch 展示、草稿、表单、命令接线、只读变量输入与对应测试。

剩余验收只保留上方未勾选的浏览器项目，不能据自动测试宣称像素与真实拖拽已验收。
