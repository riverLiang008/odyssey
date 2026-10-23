# Workflow Preview 布局还原 TODO

状态：实现及自动检查完成，浏览器验收受阻  
日期：2026-10-23

## 目标

点击 Agent Slot 后，Workflow Preview 保留实际 Workflow Canvas 的节点相对位置、尺寸比例、节点形状和连线关系。采用完整几何包围盒的等比缩放，不重新自动排版。

当前问题：预览只缩放节点位置，节点仍使用固定 64 × 32 尺寸；placement 的坐标原点与预览中心坐标未统一；节点形状及连线路径被简化后与实际 Canvas 存在差异。

## 实施决策

直接复用 `projectWorkflowCanvas(..., 'configure')` 和 `WorkflowNodeRenderer`，在独立只读 Vue Flow 实例中渲染。复用既有投影而非另建几何计算，保留 Configure 的横向 2.45、纵向 2.35 坐标扩展，以及实际卡片、动态高度、端口、smoothstep 连线和 Loop 子节点。

预览固定采用 Configure 展示，不持久化或同步编辑器的临时模式和 viewport。通过预览自身的 DOM 测量得到实际节点外框，节点初始化、容器及卡片尺寸变化后执行带 16px 留白的 `fitView`，统一缩放全部几何。无需提前打开编辑器，也不依赖编辑器页面 DOM。内容随整体缩放，保留实际卡片而非另做简化卡片。

只读由 adapter 的节点/边能力、Vue Flow 交互配置和原生 `inert` 共同保证；无任何领域修改事件绑定。每个实例使用独立 ID，切换 Agent 时重新挂载；销毁时清理观察器与待执行帧。

## TODO

- [x] 实施前完整重读 `doc/frontend-engineering-guidelines.md`。
- [x] 核对 Canvas placement 的坐标语义、各节点尺寸、动态高度、端口和连线路径，以及 Flow / Configure 模式差异。
- [x] 明确预览模式：固定 Configure，匹配本次截图。
- [x] 复用既有 canvas adapter 投影；不将 Vue Flow 类型或临时测量状态引入领域模型。
- [x] 动态尺寸通过预览自身渲染测量，不依赖编辑器页面 DOM。
- [ ] 使用节点完整外框计算内容包围盒；必要时将越出节点边界的连线路径纳入包围盒。
- [x] 对位置、尺寸、端口及连线路径应用同一等比缩放和居中平移，支持容器尺寸变化。
- [x] 复用真实节点形状和内容，避免文字最小字号或固定节点大小造成新增重叠。
- [x] 复用 Canvas 的缺失 placement 回退及 Loop 父子关系，支持空图和负坐标。
- [x] 保持只读能力及现有加载、错误、重试、关闭和打开 Canvas 行为。
- [ ] 添加几何和 adapter 测试：相对位置、比例、边界留白、坐标原点、端口一致性、无新增重叠及输入不变性。
- [x] 更新组件测试，验证真实节点渲染、inert 及现有预览交互；adapter 测试覆盖最小图、research、Loop、Configure 投影一致性、只读能力与输入不变性。
- [ ] 在真实浏览器中对照截图场景，并验证不同预览宽高与动态卡片内容。
- [x] 执行 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`，记录结果与遗留限制。

浏览器验收阻碍：内置浏览器连续两次创建本地页面均因 webview 连接超时失败，尚未确认视觉结果。`fitView` 按节点外框适配；超出节点外框的特殊绕行连线仍需浏览器检查裁切情况。jsdom 不计算真实布局，组件测试不能替代缩放、留白及动态高度的浏览器验收。

自动检查：`pnpm lint`、`pnpm typecheck`、`pnpm build` 全部通过。完整 `pnpm test` 通过：schemas 9 个文件、93 项测试；web 86 个文件、515 项测试。包含 adapter 6 项、Preview 组件 3 项，以及 Journey Editor 集成 13 项测试。

## 验收标准

- 原 Canvas 中不重叠的节点，预览中不因节点固定尺寸而新增重叠。
- 节点位置与尺寸使用统一变换，保留相对位置及宽高比例。
- Start / End 的形状和连线端口与选定展示模式一致；连线可见且不被错误节点覆盖。
- 内容在预览区域内完整呈现并保留留白；简化内容不改变几何布局。
- 不新增领域状态副本，不修改持久化布局，不引入编辑入口或可变配置行为。

## 首要涉及文件

- `apps/web/src/canvas/workflow-preview/workflowPreviewAdapter.ts`
- `apps/web/src/canvas/workflow/workflowCanvasAdapter.ts`
- `apps/web/src/features/journey-editor/WorkflowPreviewCanvas.vue`
- 相应节点呈现、样式及测试文件；具体范围在几何核对后确定。
