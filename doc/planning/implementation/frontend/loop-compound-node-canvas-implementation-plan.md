# Loop Compound Node 单画布实施计划

状态：部分浏览器验收通过；Loop 内 Branch 越界和模式切换视野问题待修复
适用范围：Agent Workflow Editor / Canvas / workflow import-export / persisted editor layout
产品依据：`doc/product/information-architecture/odyssey-figma-information-architecture.md` §5.3.1

## 1. 目标

把当前“打开 Loop 后切换到独立 InlineLoopCanvas”的实现替换为单画布 Compound Node：Loop 是根图中的可移动、可缩放容器，Loop body 的子图直接显示在容器内部；Task 与 Agent Action 可从 palette 拖入并成为 Loop body 子节点。

## 2. 已冻结的产品决策

1. Loop 始终显示在根 Canvas 中，不再进入独立 Canvas 或替换整个画布。
2. Loop 在根图仍是一个节点；根图连线只连接 Loop 边界。
3. Loop body 保持独立的 graph/layout 所有权，不把子节点扁平写入根图。
4. 子节点坐标相对 Loop 容器存储；移动 Loop 不改写所有子节点坐标。
5. Loop 可缩放，宽高属于可持久化 editor layout。
6. Task 与 Agent Action 可拖入 Loop；V1 不允许 Loop 嵌套。
7. 子节点不得被拖出 Loop；其内部连线只属于 Loop body。
8. 创建任何节点都不自动打开右侧栏；拖放 Loop 也不打开创建弹框，而是使用合法默认值立即创建。点击 Loop header/border 才打开 Loop 配置；点击内部节点选择内部节点。

## 3. 架构约束

- Domain graph 与 Canvas layout 继续分离；尺寸进入 layout，不进入 Loop 业务 config。
- Vue Flow 的 parent/extent 等第三方 view-model 只存在于 Canvas adapter 与 presentation 层。
- 所有移动、缩放、创建、连线都转换为显式 intent，再由 store 调用纯 domain command；组件不得直接改写持久化对象。
- root context 与 loop-body context 必须由目标节点来源明确决定，不能依赖当前是否“进入 Loop”。
- import/export、后端持久化与未来 DSL 编译输出必须共享同一 schema。

## 4. 分阶段 Todo

### Phase A — Schema 与 domain commands

- [x] 在 node placement 中加入可选且有边界的 `width` / `height`，兼容现有文档。
- [x] 为 Loop 创建提供默认尺寸；为缩放提供纯 layout command。
- [x] 保证 import/export 与 schema round-trip 保留尺寸。
- [ ] 增加独立的 schema、layout command 与旧文档兼容性测试。

### Phase B — 单画布 projection

- [x] Canvas adapter 将 Loop body 节点投影成 Loop 的 visual children；当前以 domain UUID 作为稳定投影 ID。
- [x] body edge 只连接投影后的 body children；root edge 仍连接 Loop。
- [x] Loop renderer 显示 header、body background、Loop Start/End 与 resize affordance。
- [x] body children 使用相对坐标并受 parent extent 约束。

### Phase C — Intent、拖放与选择

- [x] root 节点移动继续写 root layout；body child 移动写对应 Loop body layout。
- [x] resize intent 写 root Loop placement 的宽高。
- [x] palette drop 命中 Loop body 时，只允许 Task / Agent Action，并创建 body child。
- [x] root drop 仍创建 root node；命中判断由 Canvas presentation 产生明确 target。
- [x] 点击 Loop chrome 选择根 Loop；点击 body child选择 loop-body context。
- [x] root connection 与 body connection 根据投影 endpoint 路由到各自 domain command，并拒绝跨边界连线。

### Phase D — 清理旧模式

- [x] 删除 `InlineLoopCanvas` 的运行时分支与 Open/Collapse Loop 交互。
- [ ] 清理不再参与运行时的 expanded-inline session 类型与旧组件文件。
- [x] Loop Inspector 只负责配置，不负责切换画布。

### Phase E — 验证

- [x] adapter tests：parent 关系、root/body edge 同时投影、尺寸与 domain 不变性。
- [ ] component tests：resize、drop target、选择路由、创建不弹侧栏。
- [ ] store/domain tests：body move/connect/create、Loop resize、非法嵌套拒绝。
- [ ] import/export round-trip tests：Loop 尺寸和 body 相对坐标不丢失。
- [ ] 运行 web typecheck、相关 Vitest 与 ESLint。

## 5. 验收标准

1. 新建 Loop 后原地显示一个带 Start/End 的可缩放容器，右侧栏不自动出现。
2. Task/Agent Action 拖入 Loop 后显示在容器内部，刷新、保存、导出再导入后位置与 Loop 尺寸保持一致。
3. 移动 Loop 时内部节点整体随动且相对布局不变；内部节点无法拖出边界。
4. Loop 内可移动、选择和连接子节点；根图不能直接连接内部节点。
5. 点击 Loop 外框打开 Loop 配置；点击内部节点选择内部节点；点击空白取消选择。
6. 整个过程不发生主 Canvas 替换，不出现 Open Loop / Collapse Loop 导航。

## 6. 实施顺序与风险控制

按 A → B → C → D → E 实施。先扩展兼容 schema，再建立纯 projection，最后移除旧模式，避免持久化文档在中间状态不可读取。主要风险是 Vue Flow parent node 的坐标、尺寸与事件 ID 语义；通过 adapter 统一映射并用测试固定，不让第三方结构进入 store/domain。

## 2026-10-23 补验收

已在真实 HTTP / PostgreSQL 环境验证 Loop 移动、调整尺寸、已有子节点的拖动边界、Loop 内 Task / Branch 创建，以及 JSON 导出再导入后的尺寸和相对位置保持。嵌套 Loop 入口禁用。

仍不能整项验收通过：Loop 内新建的展开 Branch 可能超出容器；切换到 Flow 后当前节点可能移出视野。两项都有浏览器复现和截图，见 [本轮验收记录](../../project/odyssey-acceptance-2026-10-23.md)。没有把未覆盖的拖放、连线和兼容清理项目勾为完成。
