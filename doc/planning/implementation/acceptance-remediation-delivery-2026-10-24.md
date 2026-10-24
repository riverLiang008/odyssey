# Odyssey 整改实施与验证记录

日期：2026-10-24  
依据：[整改清单](./acceptance-remediation-todo-2026-10-24.md)、[实施计划](./acceptance-remediation-plan-2026-10-24.md)。

## 状态

本记录是实施窗口交付记录，不是独立验收结论。原清单中的原验收窗口复验 checklist 未勾选。

| 编号 | 状态 | 实际范围 |
| --- | --- | --- |
| FIX-01 | 已实施，待独立复验 | 真实浏览器已验证 Loop 区域切换、连续切换、1440×900、1024×900 Focus 和缩小视野；未覆盖完整根图及所有选中状态组合 |
| FIX-02 | 已实施，待补充复验 | 浏览器已验证 Loop 内新建布尔 Branch、增加 Case、缩小容器及已保存内容恢复；超出持久化尺寸上限的显示扩展有自动测试，浏览器超长内容仍待验证 |
| ENV-01 | 仍阻塞 | PostgreSQL 健康；无 MinIO 容器/缓存镜像，三条官方获取路径失败，见下文 |
| E2E-01 | 仍阻塞 | 未执行真实上传、Manifest 应用、绑定和刷新整条链路；不能视为通过 |
| QA-01 | 部分执行 | 已复验部分 Branch、模式切换、Focus；真实冲突已触发并观察到草稿保留/自动保存暂停，覆盖取消与最终覆盖后的结果未确认 |

## 版本及修改边界

基线 commit：`b4ddb2ff1cf377dd714d63896c34fc06d6454e7c`。本轮没有 commit 或 push。

实施开始时工作区已经有大量前后端、CI、知识图谱、DSL、Preview、示例资料及文档修改。本轮保留已有内容，没有 reset、清空数据库或覆盖业务 Journey。完整工作区 diff 包含其他工作，不能将其全部归属本轮。

本轮新增/修改的实现及测试：

- `apps/web/src/canvas/workflow/modeViewport.ts` 及测试。
- `apps/web/src/canvas/workflow/loopBounds.ts` 及测试。
- `apps/web/src/canvas/workflow/measuredLoopProjection.ts` 及测试。
- `apps/web/src/features/workflow-editor/WorkflowCanvas.vue`、`WorkflowCanvas.test.ts`（在已有内容上追加）。
- `apps/web/src/features/workflow-editor/WorkflowNodeRenderer.vue`。
- `apps/web/src/stores/workflowEditor.ts`（在已有内容上追加）、`workflowLoopBounds.test.ts`。
- `apps/web/src/views/AgentWorkflowView.vue`。
- `apps/web/src/features/journey-editor/WorkflowPreviewCanvas.vue`（在已有内容上追加）。

未修改后端、共享 API 合同或数据库 schema。

## 修复策略

### FIX-01

根因是 Configure 按 X/Y 不同系数扩大根节点间距，原 viewport 没有随之映射。另一个实际浏览器中确认的问题是 `useVueFlow()` 未显式绑定模板使用的 canvas ID，视野操作可能落到错误实例。

现在显式绑定 canvas ID。模式切换以可见选中节点为优先锚点，否则选择离视野中心最近的可见节点；无可见节点时使用最近节点。连续切换沿用同一锚点，用户手动移动视野或改变选择后才重新选择，防止压缩后最近节点改变导致漂移。Loop 子节点的坐标包含父容器偏移。保持锚点屏幕位置和 zoom，不改业务配置、节点持久化坐标或模式状态合同。程序化切换视野不派发保存 intent；Flow 下手动平移/缩放保存时映射回 Configure 的视野规则，刷新默认恢复 Configure。

浏览器在 1440×900 下连续往返五轮，Loop 坐标前后均为 `(433.3333, 79.3333)`，没有漂移。

### FIX-02

使用 `ResizeObserver` 观察实际卡片，读取未乘 zoom 的 `offsetWidth/offsetHeight`；测量、第三方 node 和 DOM 留在画布边界。store 接收普通尺寸数据，经纯布局函数一次应用根容器布局和子图布局，不修改节点配置。

常规内容先在现有容器内最小调整位置；单张卡片无法容纳时扩大基础容器。标题区域保留 70px，左侧 16px，右/底部 24px。缩小容器时根据实际尺寸约束最小尺寸并将子节点移入边界。测量不保存为子节点宽高，稳定输入不重复 dirty/save；路由重新加载时清理测量缓存。容器拖动尺寸按实际显示缩放比例换算。

持久化基础尺寸继续遵守既有 `1600×1200` 上限。超出上限的内容由共享 adapter 根据子节点实际边界派生更大的显示外框；编辑器和只读 Preview 使用同一函数，基础尺寸和子节点位置仍通过布局命令持久化。显示尺寸会在刷新后由同一内容重新测量恢复，不向 API 提交非法尺寸，不裁切内容或取消展开。

另修复资源拖放目标只搜索根图、应用时依赖当前选中上下文的问题：现在从真实目标节点解析所属根图/Loop。此项仍需真实知识库链路复验。

## 浏览器环境与复现

- Web：`http://127.0.0.1:5174`，本轮独立启动的当前源码 Vite。
- API：`http://127.0.0.1:8316`，本轮独立启动的当前源码 Uvicorn；进程级 CORS 加入 `5174`，未修改本地凭据文件。
- PostgreSQL：`127.0.0.1:5432`，`odyssey-postgres-1`，健康。历史 `55432` 不适用于本轮。
- Workspace：`0195f076-b6e6-7ef0-98db-d721990f8001`。
- 专用 Journey：`b5b4530f-f606-4adc-ac50-cf8937028703`，名称 `Remediation 2026-10-24`。
- Agent：`dd5d8892-0cbf-42a9-9b47-aaa885ac0363`。
- Loop：`092f6f5f-826c-4b4e-a64d-439a840f77cc`。
- Branch：`53cc4b09-914b-46ff-b4c8-e16c1116173e`。
- 没有为本轮创建 Knowledge Space，也没有改动现有知识库。

复现步骤：

1. 打开上述 Agent，Configure 下平移至 `Review Loop`，使根节点离开视野。
2. 切 Flow，再切 Configure；可见 Loop 区域应保持。连续往返并检查位置。
3. 选中 Loop 中的 `Review`，点击 Add Branch，配置 `approved == true` 并创建。
4. 卡片宽约 390px、高约 278px，完整位于 720×480 容器内。
5. 增加第二个 Case `approved == false` 并应用，高约 370px；卡片自动上移，底部仍有余量。
6. 拖动 Loop 缩放手柄缩小；容器根据实际卡片保留最小尺寸，出口可见。
7. 保存后刷新，Branch、两个 Case 和调整后的布局仍存在；在 1440×900、1024×900 和 Focus 下复验模式切换与保存状态。

证据目录：`doc/temp/acceptance-2026-10-24/`。

- `flow-loop-visible.jpg`：原失败路径修复后，Flow 中 Loop 保持可见。
- `loop-branch-contained.jpg`：新建 Branch 完整处于容器内。
- `loop-branch-two-cases.jpg`：动态增加 Case 后的高度约束。
- `loop-shrunk-contained.jpg`：缩小容器后边界处理。
- `flow-1440.jpg`、`focus-1024.jpg`、`flow-zoom-focus-1024.jpg`：响应式与 Focus/缩放。

修复前证据继续使用原报告中的 `doc/temp/acceptance-2026-10-23/flow-viewport-failure.png`、`loop-branch-overflow.png`；本轮测试数据独立，因此不是同一数据集的前后对照。

浏览器随后连续发生 CDP/页面快照超时，恢复 tab 也超时；因此后续覆盖操作结果、最终刷新尺寸测量、全部键盘/异常时序及完整 UI-25～29 Figma 对照没有完成。第二窗口可能仍保留冲突草稿，应在继续验收时先检查状态，不直接刷新丢弃。临时 1024×900 viewport 覆盖也尚未因连接失败而重置。

## ENV-01 的实际阻塞

已通过提升权限只读检查确认 Docker 状态；普通沙箱访问 Docker pipe 返回 Access denied，提升权限后可访问，不能将沙箱拒绝误判为 Docker 不可用。

宿主机存在 9000 监听，但对 `http://127.0.0.1:9000/minio/health/live` 的无代理请求在 5 秒内未收到任何响应；该监听尚不能作为可用对象存储证据，未修改或停止该服务。

宿主机存在 9000 监听，但对 `http://127.0.0.1:9000/minio/health/live` 的无代理请求在 5 秒内未收到任何响应；该监听尚不能作为可用对象存储证据，未修改或停止该服务。

实际失败命令及摘要：

```text
docker pull quay.io/minio/minio:RELEASE.2025-07-23T15-54-02Z
→ unauthorized: access to the requested resource is not authorized

docker pull minio/minio:RELEASE.2025-07-23T15-54-02Z
→ pull access denied / requested access to the resource is denied

curl.exe -I -L --max-time 20 https://dl.min.io/server/minio/release/windows-amd64/minio.exe
→ HTTP 410 Gone
```

剩余依赖：合法可访问的 MinIO 镜像/官方发行物，或现有项目支持的真实 S3 兼容 endpoint；随后仍需健康、bucket、浏览器 CORS 与签名 PUT 验证。没有采用 mock、伪造上传成功或强行修改索引状态。

## 自动检查记录

第一轮 `pnpm check` 已退出 0，覆盖 lint、共享合同/Web 类型检查、测试及 production build；日志为 `doc/temp/acceptance-2026-10-24-check.log`。最终显示扩展修改发生在该轮之后，最终结果另记，不用旧结果替代。

针对性第一轮：3 文件 8 项通过；增加布局保存/刷新集成测试后：4 文件 9 项通过，退出 0，日志 `doc/temp/acceptance-2026-10-24-targeted.log`。

追加的模式切换组件测试最初因未等待 `nextTick` 后的异步操作而失败（期望调用 1 次，实际 0 次）；补 `flushPromises` 后重跑。原失败摘要保留在 `doc/temp/acceptance-2026-10-24-canvas-final.log`，重跑见 `doc/temp/acceptance-2026-10-24-canvas-rerun.log`。

最终针对性检查：6 文件 15 项通过，退出 0，含 Preview、实际尺寸约束、超大内容显示扩展及布局保存/刷新。日志：`doc/temp/acceptance-2026-10-24-final-targeted.log`。随后补充无选中节点时最近节点改变的锚点回归，再跑模式/组件测试，2 文件 7 项通过，退出 0，日志：`doc/temp/acceptance-2026-10-24-anchor-regression.log`。

最终一轮 `pnpm check` 曾在新增显示 adapter 的 UUID 品牌类型索引处失败，错误 `TS2345`；已将 adapter 测量索引明确为 `Map<string, LoopChildSize>`，没有用断言绕过类型。失败保留在 `doc/temp/acceptance-2026-10-24-final-check.log`。

修复后最终 `pnpm check` **退出 0**：lint、共享合同/Web 类型检查、测试及 production build 均完成；共享合同为 9 文件 93 项通过，production build 耗时 1m25s。日志为 `doc/temp/acceptance-2026-10-24-final-check-rerun.log`。该日志未保留 Web 测试完整总数汇总，因此不从部分文件条目推断总数；实际命令范围为 Web 默认全量 `vitest run`。针对性测试的明确通过数量见上文，不沿用历史验收数字。

本轮实现文件范围的 `git diff --check` 通过。全工作区检查另外发现三份既有规划文档的行尾空白，未改动其他窗口文档。jsdom 测试仍输出既有 Vue Flow 容器尺寸/样式警告；不能用这些测试代替浏览器尺寸证据。

本轮没有新增后端实现，未运行本轮专用 PostgreSQL 后端全套测试；没有远程 CI 运行结果，未宣称 CI 通过。
