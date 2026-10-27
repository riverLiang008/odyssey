# System Tools 第二批：前后端分工与依赖 TODO

> 状态：第二批 A 已验收 / TODO 已收口
> 日期：2026-10-06
> 目标：在不混淆 Tool Definition、Agent Reusable Tool 与 Task ToolStep 的前提下，完成 System Tool 在 Agent Action Toolbox 中的创建、配置、绑定与持久化，并补齐后续变量与资源管理能力。

## 1. 先回答：这是前端 UI 还是后端接口？

下一阶段不是纯前端，也不是先增加一组后端 CRUD；它包含三类工作：

1. **前端 UI / 交互为主**：资源拖拽、Agent Action Toolbox 内联标签、配置草稿、取消/保存、root/Loop child 上下文和 Flow/Configure 权限。
2. **共享合同 / 领域命令是串行起点**：冻结三种 identity、ownership、配置字段和原子 mutation 语义。这部分会同时约束前端和后端。
3. **后端以合同复核和聚合持久化验证为主**：现有 `GET /tool-definitions` 和 Agent Workflow aggregate save 已经覆盖 Definition inventory 与 `reusableTools` 保存；第一阶段原则上不新增独立 Reusable Tool CRUD API。只有确认现有 aggregate contract 无法安全表达需求时，才新增 endpoint 或 migration。

### 三种对象必须严格区分

| 对象 | 含义 | 所有者 | ID 用途 | 当前状态 |
| --- | --- | --- | --- | --- |
| `SystemToolDefinition` | 全局只读的五类内置 Tool 定义 | Platform | inventory/template identity | API 已完成 |
| `AgentReusableTool` | 基于 Definition 配置出的 Agent-owned Tool 实例 | Agent Workflow aggregate | Agent Action Toolbox 引用 | 合同、创建 UI 与持久化已完成 |
| `ToolStep` | Task 内的单次、有序执行步骤 | Task node | Task sequence identity/order | 第一批已完成 |

禁止用一个 ID 同时代表上述多个对象，也禁止让 Agent Action 直接引用 Definition ID。

## 2. 总体依赖关系

```text
P0 冻结共享合同与交互语义
        │
        ├──────────────┐
        ▼              ▼
FE-A 前端领域命令   BE-A 后端合同/持久化复核
        │              │
        └──────┬───────┘
               ▼
FE-B Agent Action 配置面板与 DnD
               │
               ▼
FE-C root / Loop child / autosave 集成
               │
               ▼
QA-E2E 跨端 round trip 验收
               │
               ▼
P2 Task Variable / Reusable Tools 管理面
```

结论：

- `P0` 必须先完成，是串行阻塞点。
- `FE-A` 与 `BE-A` 可以并行。
- UI 接线 `FE-B` 必须等 `P0`，并最好等 `FE-A` 的 command/preflight 可用。
- `FE-C` 依赖 UI 与后端 aggregate round-trip 均成立。
- 最终真实浏览器验收必须串行地放在跨端集成完成之后。

## 3. Phase 0 — 共享合同与交互语义（串行，所有工作的前置）

### P0.1 冻结 Definition → Reusable Tool 实例化规则

- [x] 每种 `SystemToolDefinition.kind` 生成同 kind 的 `AgentReusableTool` 配置草稿。
- [x] 默认 name 取 Definition name，用户可在配置草稿中修改。
- [x] `sourceTemplateId` 仅表示 `tool_template` provenance；System Tool Definition 实例化时必须为 `null`。若未来需要 Definition provenance，另行新增明确合同和 migration。
- [x] kind-specific `configuration` 保存执行配置；`inputBindings`/`outputBinding` 保持 Agent reusable Tool 的 canonical binding，不复用 Task failure/order 字段。
- [x] Knowledge Retrieval 只允许引用当前 Workspace 可见且可用的 Knowledge Space。
- [x] 取消为零 mutation，保存为一次原子 mutation。

### P0.2 冻结拖拽与点击等价路径

- [x] System Tool Definition → Agent Action Toolbox：打开 create-config draft，不立即修改 document。
- [x] 保存 draft：原子地创建 `AgentReusableTool` 并把新 ID 加入目标 Agent Action `reusableToolIds`。
- [x] 取消 draft：`reusableTools`、node config、mutation sequence 均不变化。
- [x] 已存在 Agent Reusable Tool → Agent Action Toolbox：只绑定既有 ID，不创建副本。
- [x] 重复绑定在 preflight 阶段返回稳定错误码。
- [x] 点击/键盘激活提供与拖拽等价的可访问路径。
- [x] Flow 模式完全只读；Configure 是默认编辑模式。

### P0.3 合同决策记录

- [x] 在本计划中记录三种 identity 与 ownership。
- [x] 本批沿用现有 aggregate contract，不新增 Definition provenance 字段。
- [x] 本批未新增合同字段；现有 TypeScript Zod、Python Pydantic、fixtures、API examples 和 parity tests 保持一致。

## 4. Frontend Track — 前端工作

### FE-A 领域命令与状态机（可与 BE-A 并行）

- [x] 新增纯 `instantiateAndBindReusableTool` transaction command。
- [x] 输入包含 Definition/kind、目标 canvas context、Agent Action node ID、确认后的配置和 ID factory 结果。
- [x] command 在候选文档上同时新增 `AgentReusableTool` 与 node binding，完整验证后一次返回新 document。
- [x] 不允许 Vue component 直接 push `reusableTools` 或 `reusableToolIds`。
- [x] 增加 Definition drop 到 Agent Action Toolbox 的 typed payload、target 和 preflight。
- [x] 区分：Definition drop、existing reusable Tool drop、Task ToolStep drop；switch 必须 exhaustive。
- [x] 增加 create/edit reusable-tool draft 的 discriminated session state。
- [x] 保存成功只增加一次 mutation sequence；取消、invalid、duplicate 不增加。
- [x] 覆盖 root 与 `loop:{loopNodeId}` canvas context，child command 通过 parent aggregate replacement 提交。

#### FE-A 测试

- [x] 每个 Tool kind 的成功实例化。
- [x] invalid configuration、missing target、wrong target kind、duplicate binding。
- [x] 输入 document 不被修改。
- [x] ID 唯一且 Agent Action 只引用 aggregate-owned reusable Tool。
- [x] root/Loop child 隔离。
- [x] Flow 模式拒绝。
- [x] cancel/rejection mutation sequence 不变，success 恰好 +1。

### FE-B UI 与 DnD（依赖 P0、FE-A）

- [x] Available Tools 卡片拖到 Agent Action `Toolbox` 区域时进入配置草稿。
- [x] 配置 UI 使用独立的 `AgentReusableTool` form，不把 `ToolStep` form 当作 reusable Tool form。
- [x] Agent Action Toolbox 显示已绑定 Tool 名称标签，而不是 `Added`、数量或打开通用 inspector。
- [x] 标签支持移除；点击标签进入该 reusable Tool 的编辑草稿。
- [x] Agent Action 本体继续保持 canvas-inline 配置，不因 Tool 配置恢复右侧 node inspector。
- [x] drop target 有明确 hover/valid/invalid 视觉状态，但不提前修改 domain。
- [x] invalid/duplicate 使用顶部短暂 toast，不使用整页常驻错误横幅。
- [x] 右侧资源栏仍为悬浮层，Canvas 铺满底层；不因为配置面板改变图布局。
- [x] 键盘 Enter/Space 能从 inventory 打开等价配置流程，Esc 取消并恢复焦点。

#### FE-B 测试

- [x] component tests 验证 props/emits 与用户可观察结果。
- [x] DnD integration 验证 resource drop 不创建 workflow node、pane 不二次消费。
- [x] 标签显示 name、移除、编辑、重复提示。
- [x] Draft 关闭、焦点恢复、Flow read-only。

### FE-C Store、Autosave 与 nested canvas 集成（依赖 FE-A、FE-B、BE-A）

- [x] Store action 编排 command、dirty state 与 autosave，不复制规则。
- [x] 保存 payload 同时包含更新后的 `workflow` 与 `reusableTools`，不包含 panel/drag/draft state。
- [x] revision conflict 使用现有 conflict 状态机，不为本功能创建特殊保存通道。
- [x] root 与 Loop child context 共用同一 aggregate replacement/store orchestration；真实 save→refresh 仍留在浏览器矩阵验收。
- [x] 删除 reusable Tool 前验证是否仍被任一 root/child Agent Action 引用。
- [x] 编辑 reusable Tool 后所有引用它的 Agent Action 读取同一 canonical instance。
- [x] 较旧 save response 不覆盖新 Tool 配置。

## 5. Backend Track — 后端工作

### BE-A 现有合同与持久化复核（可与 FE-A 并行）

- [x] 确认 `GET /api/v1/tool-definitions` 的五类 Definition 足以驱动 create draft。
- [x] 确认 `SaveAgentWorkflowRequest.reusableTools` 能保存五类 `AgentReusableTool`。
- [x] workflow DTO/domain 校验 Agent Action `reusableToolIds` 只引用本 aggregate owned Tool。
- [x] root/Loop child graph 中的引用均递归验证，而不是只扫 root nodes。
- [x] 确认 Knowledge Space、Agent Variable 引用均 Workspace-scoped 且写前验证。
- [x] 确认保存使用同一个 aggregate transaction/CAS，成功 revision 恰好 +1，失败不消耗 revision。
- [x] 删除/覆盖 reusable Tool 时 dangling reference 在 DTO validation 阶段被拒绝，而非进入数据库变成 500。

### BE-A 测试补强

- [x] 五类 reusable Tool save → load round trip。
- [x] root 与 Loop child Agent Action binding validation。
- [x] unknown reusable Tool ID、cross-Workspace Knowledge Space、unresolved variable reference。
- [x] duplicate reusable Tool ID 与 unknown root/Loop child binding。
- [x] stale revision、rollback、cross-Workspace not-found hiding（既有 PostgreSQL suite 保持通过）。
- [x] stored JSON 与 response aggregate 均经过 Pydantic validation。

### BE-B 仅在复核失败时启动（条件性、串行于 BE-A 结论）

- [x] 现有 aggregate save 可安全满足需求：**未新增 API、未新增 migration**。
- [ ] 若 `sourceTemplateId` 不能表达 Definition provenance：先改共享合同与 parity，再改 Python DTO/domain/persistence；不能只补数据库列。
- [ ] 若产品明确要求跨 Agent 独立管理/分页 reusable Tool，才设计 Workspace/Agent-scoped resource API；不为 CRUD 对称性提前增加 endpoints。
- [ ] 任何新写接口必须使用 Current Workspace、service-owned transaction、数据库 CAS 与稳定错误 envelope。

## 6. 可以并行的工作

| 并行组 | 工作 A | 工作 B | 合并条件 |
| --- | --- | --- | --- |
| Group 1 | FE-A command/preflight/state machine | BE-A aggregate/validation tests | P0 合同冻结 |
| Group 2 | FE-B presentational components/visual states | 后端 negative/round-trip tests | UI props/emits 不绕过未冻结合同 |
| Group 3 | root context component tests | Loop child context component tests | 共用同一 command，context 显式传递 |
| Group 4 | keyboard/a11y path | pointer DnD browser path | 两条路径派发同一 typed intent |

并行不等于复制实现：每组必须共享同一 domain command、schema 和 error code。

## 7. 必须串行的工作

| 顺序 | 原因 |
| --- | --- |
| P0 合同 → 前后端实现 | 未冻结 identity/ownership 会导致两边各自发明模型 |
| Pure command/preflight → Vue UI 接线 | 组件不能先写直接 mutation 再补领域层 |
| BE-A round trip 通过 → FE-C 真实保存验收 | 否则 UI 成功但刷新丢失 |
| root happy path → Loop child 集成 | 先证明 transaction，再验证 nested context，不复制两套逻辑 |
| 自动化全绿 → 真实浏览器 drag/autosave 验收 | jsdom 不能证明坐标、pointer capture 和真实刷新 |
| 第二批 A 完成 → Task Variable/Reusable Tools 管理面 | 避免同时扩展两个 ownership 模型，降低返工 |

## 8. 后续第二批 B（不与核心路径混做）

以下可以在第二批 A 验收通过后继续：

- [x] Output Mapping 中原子创建 New Task Variable。
- [x] Agent Variables 管理面：分组、搜索、create/edit/delete、引用保护与 aggregate autosave。
- [x] Reusable Tools 顶部栏目：inventory、search、create/edit/delete 和引用影响提示。
- [x] Task ToolStep 完整排序体验（拖拽插入反馈，并保留上下移动按钮作为键盘等价路径）。
- [x] Knowledge Retrieval 使用真实 Knowledge Space 数据完成浏览器 happy path。
- [ ] 模型 inventory 后端合同；在此之前保留 model identifier，不伪造模型列表。
- [ ] System Variable inventory；在正式 API 前不创建生产 mock 特例。
- [ ] 对照 Figma 完成间距、卡片密度、浮动 panel、响应式与 1024/1440 视觉校准。

## 9. 验收门禁

### Frontend

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`（58 files / 374 tests）
- [x] `pnpm build`
- [x] 真实浏览器：Definition → root Agent Action Toolbox → configure → save → refresh。
- [x] 真实浏览器：Definition → Loop child Agent Action Toolbox → configure → save → refresh。
- [x] duplicate、cancel、invalid、Flow read-only、revision conflict。
- [x] 浏览器 console 无 warning/error。

### Backend

- [x] `cd apps/api && uv run ruff check .`
- [x] `cd apps/api && uv run pytest`（104 passed）
- [x] PostgreSQL round-trip、CAS、rollback、Workspace isolation。
- [x] OpenAPI 与共享 schema parity（schema suite 69 tests）。

### Release 判定

- [x] 四项前端门禁与两项后端门禁全绿。
- [x] 成功 mutation revision 恰好 +1；取消/失败不变化。
- [x] 保存刷新后 ID、配置、binding、root/Loop ownership 均保持。
- [x] 不存在 UI-only state、Vue Flow object 或 draft 进入 API payload。

## 10. 第二批 A 验收记录（2026-10-06）

结论：**PASS，可以进入第二批 B。**

- 专用验收 Journey：`System Tools Batch A Acceptance 2026-10-06`（保留，便于复查）。
- root Agent Action 创建并保存 `Root API Acceptance`；刷新后 Tool 名称、配置与 binding 回显正确。
- Loop child Agent Action 创建并保存 `Loop Script Acceptance`；刷新并重新展开 Loop 后回显正确，未串写 root graph。
- root Task 连续加入 `Root Task Script One`、`Root Task API Two`，顺序保持为 1、2。
- Cancel 前后 revision 均为 7；重复绑定被拒绝且 revision 保持 7；顶部 toast 自动消失。
- Flow 模式下 palette disabled、resource card 不可键盘激活，未产生 mutation。
- API 最终核对：root Task 两个步骤；root/Loop 各一个 reusable Tool binding；aggregate revision 为 7。
- 浏览器 console 仅有 Vite connect debug 日志，无 warning/error。
- pointer DnD 的 pane 消费与错误路径由 integration tests 覆盖；真实浏览器同时验收了与拖拽派发同一 typed intent 的键盘 Enter 路径。
- 当前内置浏览器视口较窄，1024/1440 视觉校准仍属于第二批 B 的 Figma/响应式任务，不作为第二批 A 阻塞项。

验收数据标识：

- Journey：`c755a8ff-5880-4ee3-9c7c-0fd60eddb68c`
- Agent：`85552fe9-23e5-4506-8679-d58ad59e4634`
- root Agent Action：`7bba1920-72fb-4dba-901a-3a2c4a49c632`
- root Task：`dbe44368-c8e3-4bbf-9e05-1a76f04aa2dd`
- Loop：`72d6cbf6-3b6f-4a89-807a-ba4358c8b604`

说明：验收自动化定位过程中在专用 Journey 的 Loop body 留下了一个未连线、未配置的 `New Task`。它不参与上述 ownership、保存或执行路径；保留专用 Journey 时一并保留，避免通过未确认的删除操作掩盖验收痕迹。

## 11. 建议执行顺序

1. 评审并冻结 Phase 0。
2. 并行执行 FE-A 与 BE-A。
3. BE-A 若证明现有接口足够，不启动 BE-B。
4. 完成 FE-B，再完成 FE-C。
5. 跑全量门禁与真实浏览器矩阵。
6. 第二批 A 验收通过后，再开启第二批 B。

### 第二批 B 进度（2026-10-06）

- Output Mapping 已支持在 Tool 配置草稿内切换到 `New Task Variable`，填写 name/data type。
- 保存通过同一个 domain command 原子新增 Task-local variable 与 Tool output binding；重复 key、重复 ID、无对应 output binding 等情况整次拒绝，不留下孤儿变量。
- Task Variable 只进入所属 Task 的 `localVariables`，继续沿用现有 aggregate save，不新增 API 或 migration。
- 真实浏览器已验证 `Task Variable Acceptance → task.browser_output` 创建、autosave 与刷新回显。
- 针对性领域、组件和 store 测试：31 passed；包含 save→reload round trip。
- Agent Variables 已按 Figma 资源面板实现 System / User-managed / Shared / Agent-managed 分组，以及创建、编辑、删除确认、引用计数保护和类型变更保护。
- Agent Variable 继续复用现有 Agent aggregate 的 `variables` 字段，无需新增后端接口或 migration；System Variable inventory 尚无正式 API，界面明确显示不可用，未加入生产 mock。
- 真实浏览器已验证 `agent.browser_acceptance` 创建为 Shared、autosave 成功，并在整页刷新后回显；针对性领域、组件和 store 测试 23 passed。
- Reusable Tool → Task 语义已冻结为独立快照：拖入时复制当前 kind/configuration 并生成新的 Task ToolStep ID；之后可保持或本地修改，双方不再同步，来源删除不影响既有步骤。
- Reusable Tool → Agent Action 继续保持 canonical ID 引用；Figma 中的 `Linked / Detach / Update source` 不属于 V1，除非未来先新增明确 provenance/synchronization 合同。
- Reusable Tools 管理面已实现 Agent-owned inventory、搜索、引用次数、编辑、受引用保护的删除，以及面向 Agent Action / Task 的拖拽入口。
- 2026-10-24 已恢复本地 API，并用 `Knowledge QA` Journey 完成真实 Knowledge Retrieval happy path：选择 `Moonberry Island Guide`、保存 workflow、整页刷新并重新打开配置后，Knowledge Space 与 query 均保持。
- 决策修正：Task Tool step 的右键复用操作命名为 `Save to Reusable Tools`，目标是当前 Agent aggregate 内的 `AgentReusableTool`，不是 Workspace `ToolTemplate`。
- [x] Task Tool step 右键菜单支持 `Save to Reusable Tools`；保存生成新 ID 的独立快照，原 step 不变，并通过现有 Agent aggregate autosave 持久化。
  - 快照仅复制 Tool kind/configuration；Task-local output mapping 等宿主绑定不进入 Agent-level reusable definition。
- [x] Task ToolStep 支持按稳定 step ID 拖拽排序；root/Loop 共用同一 store command，排序不修改配置与 output mapping，并已验证 autosave + refresh 保序。
- [ ] Workspace `ToolTemplate / Save as Template` 暂不进入本批；其跨 Agent library、API、visibility 与 Knowledge Space dependency 另行设计。

这个顺序优先消除 identity、ownership 和原子性风险，避免 UI 做完后才发现 API/aggregate 语义不成立。
