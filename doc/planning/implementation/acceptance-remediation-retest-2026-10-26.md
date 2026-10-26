# Odyssey 整改复验记录 · 2026-10-26

状态：本文为先期复验历史记录。下文列出的待补验项目现已完成，最新结论见[待补验收尾记录](./acceptance-remediation-closure-2026-10-26.md)。

关联：[整改 ToDo](./acceptance-remediation-todo-2026-10-24.md)、[上一轮交付](./acceptance-remediation-delivery-2026-10-24.md)。本文记录本轮实测，不替代原验收窗口最终签署，不批量勾选未执行事项。

## 版本与环境

- 基线 HEAD：`2661756`。工作区有其他窗口的 DSL、知识图谱、后端及 RustFS 修改；本轮基于这些当前源码测试，保留已有修改，没有提交或推送。
- 初轮代码修改为 `apps/web/src/views/AgentWorkflowView.vue`：成功应用 Branch 后清理对应 UI 草稿缓存；失败时保留草稿。后续直接整改追加 Preview 名称解析 composable、展示 props 和测试，详见下文；保留其他窗口已有修改。
- Web：`http://127.0.0.1:5173`；独立 API：`http://127.0.0.1:18200/api/v1`。原有 API 8200 未重启。
- PostgreSQL 17：55432；真实 S3：RustFS `1.0.3`，9000。两容器健康。现有 compose 的 service 仍名为 `minio`，实际镜像已是 RustFS；10 月 24 日镜像下载阻塞不再代表当前状态。
- 最初尝试 API 8316 被 Windows 拒绝绑定，改用 18200 后正常。Web 5173 在现有 S3/API CORS 白名单中。
- 配置项：`ODYSSEY_DATABASE_URL`、`ODYSSEY_DEVELOPMENT_WORKSPACE_ID`、`VITE_API_BASE_URL`；S3 使用项目 Settings 中的 endpoint、bucket、region、access/secret 配置及 compose `RUSTFS_CORS_ALLOWED_ORIGINS`。凭据和签名 URL 未写入证据。
- API：在 `apps/api` 设置上述专用 Workspace 与本地 DB 环境变量，运行 `.venv/Scripts/python.exe -m odyssey_api.bootstrap`，再运行 `python -m uvicorn odyssey_api.main:app --host 127.0.0.1 --port 18200`。Web 设置对应 `VITE_API_BASE_URL` 后运行 `pnpm --filter @odyssey/web dev --host 127.0.0.1 --port 5173 --strictPort`。
- 自动后端测试使用新建数据库 `odyssey_retest_20261026`，先 `alembic upgrade head`，再 pytest；没有在业务数据库上跑测试初始化。

## 专用测试数据

| 对象 | ID |
| --- | --- |
| Workspace | `a8e21026-2026-4026-8026-000000000001` |
| Knowledge Space | `2ab56e8d-12a9-479b-be05-b81570234b91` |
| Markdown resource | `bb46f429-95b6-40e9-969b-27d9eb023c0f` |
| Journey | `5e6476ec-8c90-4f5b-9619-d06e617cb3f3` |
| Agent | `bae1c78f-862d-44fe-b397-feece6213b89` |
| Loop | `6c911432-f1e8-4759-9f21-ab1bf82f6b4d` |
| Branch | `f23a8bd5-461b-48fd-9617-23ec246f2ed2` |

名称均使用 `Acceptance Retest 2026-10-26`。只改专用数据，未改现有 Knowledge QA / Moonberry Island 示例业务记录。证据目录：[acceptance-2026-10-26](../../temp/acceptance-2026-10-26/)。

## 本轮结果

| 项目 | 实测结论 | 未完成范围 |
| --- | --- | --- |
| ENV-01 | **通过**。健康服务、真实浏览器 PUT、完成接口、GET 预览、SHA-256、GET/PUT CORS 均验证 | 无环境阻塞 |
| FIX-01 | **核心复现通过**。平移到 Loop 后切换 Flow，原区域仍可见；4 轮双向切换无漂移；选中子节点、根图、1024 宽 Focus 已检查 | 全部缩放/无选中/1440 与 1024 普通模式的组合矩阵仍须逐项签署 |
| FIX-02 | **核心复现及大尺寸通过**。新建布尔 Branch、长名称、多 Case、多条件、父容器移动、缩放、持久化、JSON 往返、Preview 测量通过 | 四边拖动、主动缩小容器、全部创建入口矩阵仍待补齐 |
| E2E-01 | **主链路通过**。创建 → 文件夹 → 真实上传 → 预览 → Manifest 校验/预览/应用 → 刷新 → 根图/Loop Action 与 Task 绑定 → 保存刷新 | 浏览器中归档/失败/未索引不可绑定原因与上传异常重试提示还需逐项核对；关系图本轮 fixture 为 0 条关系 |
| QA-01 | **部分通过**。冲突取消/确认覆盖/刷新、真实 API 中断保存失败与重试、离开保护、Case 排序与连线身份、连接 Case 删除确认、Preview 只读通过 | 再次冲突/覆盖途中失败、乱序旧响应、跨根图/不同 Loop 拖线、资源拖放隔离、完整键盘矩阵仍待补齐 |

### 画布证据

Configure 平移到 Loop 后，Loop 左上角为 `(630.83, 354.83)`；切换 Flow 后相同。连续四轮 Configure/Flow 坐标均相同，见 [mode-cycles.json](../../temp/acceptance-2026-10-26/mode-cycles.json)、[切换前](../../temp/acceptance-2026-10-26/loop-configure-before.png)、[切换后](../../temp/acceptance-2026-10-26/loop-flow-after.png)。

Loop 内通过选中子节点 → Palette Branch 创建布尔条件 Branch。增加第二个 Case 和长名称后，卡片高约 408.16，Loop 从 480 扩到 502；卡片相对顶部为 70，底部约有 24 余量，见 [branch-grown.png](../../temp/acceptance-2026-10-26/branch-grown.png)。选中 Loop 子节点时，嵌套 Loop 按钮明确禁用。

10 Case × 4 条件压力图中，Branch 实际高约 1464.32，Loop 派生显示高 1558，持久化高仍为合法的 1200。0.35 倍缩放后，Loop 高 545.30，Branch 高 512.51，缩放一致；新页面仍可恢复。见 [large-branch-bounds.json](../../temp/acceptance-2026-10-26/large-branch-bounds.json)、[large-loop-scaled.png](../../temp/acceptance-2026-10-26/large-loop-scaled.png)。

JSON 通过实际菜单导出，再通过 Import 文件选择器导入，Agent 身份保持；规范化可选 null/缺省字段后，根图/Loop 的 placement、尺寸、viewport 和 Case ID 相同，负坐标 `y=-72.021` 保留。见 [roundtrip-result.json](../../temp/acceptance-2026-10-26/roundtrip-result.json)。DSL 压力图替换出现 Review replacement → Confirm and recheck 保护，确认后才允许应用。

Preview 实际容器与 Branch 的缩放边界也保持包含关系。其 surface 有 `inert`、`aria-hidden=true`、`pointer-events:none`，不能交互编辑；见 [preview-large.png](../../temp/acceptance-2026-10-26/preview-large.png)。该截图中的知识库名称误判已在后续修复，仍不把未执行的 Preview 扩展场景整体判通过。

### 真实知识库链路

1. 浏览器创建知识空间及 `Reviewed` 文件夹，上传 `retest-guide.md`。API prepare 201、complete 200；真实 S3 PUT 完成后文件显示 indexing，而非伪造 indexed。
2. 刷新后文件数为 1、类型 text/markdown、177 B；预览读到正文“3 successful checks”。见 [upload-preview.png](../../temp/acceptance-2026-10-26/upload-preview.png)。
3. 使用本轮人工检查过、路径为 `Reviewed/retest-guide.md` 的 [manifest.json](../../temp/acceptance-2026-10-26/manifest.json)。校验预览为 matched 1/unmatched 0、摘要 1、指南 1、标签 1；应用后刷新为 indexed/healthy，节点选中详情显示对应摘要、指南及标签。见 [manifest-validation.png](../../temp/acceptance-2026-10-26/manifest-validation.png)、[graph-refreshed.png](../../temp/acceptance-2026-10-26/graph-refreshed.png)。本轮未以 0 条关系证明关系连线验收。
4. 根图与 Loop 内 Action 从真实资源列表选择；根图与 Loop 内 Task 通过系统工具键盘入口、真实 Knowledge Space 下拉配置 Knowledge Retrieval。刷新后四个引用仍为上表同一 Knowledge Space ID，见 [bindings-after-refresh.json](../../temp/acceptance-2026-10-26/bindings-after-refresh.json)。
5. 通过 [retest_upload.py](../../temp/acceptance-2026-10-26/retest_upload.py) 对本轮空间执行真实 API/S3 附加检查：下载内容 SHA-256 与持久化 checksum 一致；GET 与 PUT preflight CORS 生效；无 PUT 的 complete 被 409 拒绝且文件数不增加；错误大小也被 409 拒绝；重新 PUT 正确字节后完成；重复 complete 不重复增长 revision。结果：[real-storage-checks.json](../../temp/acceptance-2026-10-26/real-storage-checks.json)。这部分是 HTTP 检查，不冒充浏览器异常提示验收。脚本会新建专用 retry fixture，重复运行应留意同名文件。

后续 retry fixture 是未索引文件，专用空间最终文件数已不再是主链路截图中的 1；截图对应当时状态，没有将后续测试数据强制索引。

### 并发、失败与 Branch 编辑

- 使用真实 API 另行推进服务器 revision，再在旧浏览器编辑 Goal，保存返回 409，界面显示 Conflict 并保留本地文本。Stay and review 保留草稿；Overwrite 另有二次确认，确认后刷新与本地版本一致。见 [conflict-confirmation.png](../../temp/acceptance-2026-10-26/conflict-confirmation.png)。这模拟第二个写入者，未声称执行了完整双浏览器竞态矩阵。
- 停止本轮专用 API，再编辑 Goal，界面明确 Save failed，保留文本，离开出现保护；恢复 API 后 Save now 成功，刷新 Goal 仍为 `Local conflict retest edited retry`。原有 8200 API 不受影响。见 [save-failure.png](../../temp/acceptance-2026-10-26/save-failure.png)。Stay and retry 是留在页面的操作，不直接承诺已完成重试。
- 专用 Loop Branch Case 连接到 Loop End。浏览器排序后，API 核对原 Case UUID、edge UUID、sourceHandleId、target 均未变。删除提示准确列出 4 条件、1 出边、Loop End；取消不改持久化图。单步确认、检查草稿、应用并等待 Saved 后，仅 Case 与相应边移除，Loop End 和无关边保留。见 [branch-edit-results.json](../../temp/acceptance-2026-10-26/branch-edit-results.json)。
- 第一次连续快速操作删除确认/Apply 未得到预期持久化结果；后续按每步页面状态独立确认后通过。不能将快速连点时序据此判定无问题，保留在异常时序待验范围。

## 本轮发现与处理

### 已修复：成功应用 Branch 后残留未应用草稿标记

复现：编辑 Loop Branch 并 Apply → 面板因应用流程切换/卸载 → 状态 Saved、DSL Synced → 返回 Journey 仍弹 Leave without saving。原因是应用成功时面板可能来不及观察更新节点并清缓存，视图拥有的 `branchDraftCache` 仍非空。

修复由视图在领域应用成功后删除对应 Branch 缓存并更新 dirty 标记；创建分支同样清理，失败不清。没有修改领域图、序列化格式或第三方画布状态。

修复后全新页面中再次修改并 Apply Branch，等待 Saved，点击返回已进入 Journey，没有虚假拦截；随后 Case 排序/删除也经过同一路径。验证以真实浏览器为主，后续 lint、typecheck、相关 35 项测试及 build 均通过。没有把仅有单元测试当作该卸载时序的浏览器证明。

### 已修复：Preview 误显示有效 Knowledge Space 为 Unavailable

Preview 根图 Action 已持久化的知识空间显示 `Unavailable Knowledge Space`。API 和工作流编辑器均确认绑定 ID 正确、资源真实存在；Preview 渲染器没有传入知识空间名称清单，因而把缺少展示数据解释成资源不可用。影响为预览误导，不是引用丢失。

用户授权直接整改后，新增 `usePreviewKnowledgeSpaces`，由 Journey container 通过现有 typed repository 按引用 ID 查询展示元数据。根图/Loop 引用去重；loading、404 不可用、请求失败与归档名称明确区分；请求失败可单独重试，不阻塞图预览。切换 Agent、关闭 Preview 或卸载时取消旧请求，忽略晚到结果。名称只进入展示 props，不修改 Workflow、绑定 ID 或持久化格式。

真实浏览器重新打开该 Journey Preview，现已显示 `Acceptance Retest 2026-10-26`，surface 的 `inert` 和 `pointer-events:none` 保持。证据：[preview-knowledge-fixed.png](../../temp/acceptance-2026-10-26/preview-knowledge-fixed.png)。新增测试覆盖根图/Loop 去重解析、失败重试/404/归档、切换 Agent 的旧响应隔离，以及名称传递与只读限制：2 文件 8 项通过，见 `preview-fix-tests.log`。完整检查另见 `preview-fix-check.log`。本次没有改后端 API。

修复后完整 `pnpm check` exit 0：lint、typecheck、共享包 93 项、Web 105 文件 603 项及 production build 均通过。额外真实浏览器尝试根图 Action → Loop End 跨上下文拖线后，服务器仍为 revision 27、根图/Loop 边数量未变；因未取得明确拒绝反馈，不以此次尝试替代完整跨图连接验收，见 `cross-context-attempt.json`。

### 视觉源核对范围

本轮实际通过 Figma 连接读取文件 `P3EF9io2DhyhwkNYBVqB5Z` 的 UI-25～29 截图（875:98、214、271、362、480，读取日 2026-10-26）。已核对白卡、黄色 Branch 类型标识、Case 顺序、Default 最后、长文本换行、新建草稿、删除连线提示等要点。当前采用侧边类型色条、系统工具扩展字段及独立的 Apply/Reload 控件，与静态稿有布局差异；本轮没有取得这些差异的设计签署，也未完成全部键盘路径。因此视觉与可访问性保持“部分核对”，不是像素一致或全部通过。

## 自动检查

| 检查 | 结果与范围 |
| --- | --- |
| 初始 `pnpm check` | exit 0；lint/typecheck/test/build；共享包 9 文件 93 项，Web 104 文件 599 项。日志 [check.log](../../temp/acceptance-2026-10-26/check.log) |
| 后端 Ruff | `ruff check .` 通过；`ruff format --check .`：71 文件已格式化 |
| 隔离 PostgreSQL 全套 | migration 到 `20261017_0004`；154 passed，1 个既有 Starlette/httpx 弃用警告，19.09 秒。[api-pytest.log](../../temp/acceptance-2026-10-26/api-pytest.log) |
| Branch 缓存修复后 | Web lint、typecheck 通过；BranchConfigPanel + workflowEditor 2 文件 35 项通过；production build 通过。见 `final-lint.log`、`final-types.log`、`final-regression.log`、`final-build.log` |

后端集成测试覆盖 Workspace 隔离、归档可见性、引用同步/CAS/回滚等，但使用测试存储的用例不替代本轮真实 S3 HTTP/浏览器证据。没有远程 CI 结果。

## 后续验收门槛

1. Preview 名称误判已修复；继续补非零关系图的选中/刷新，以及浏览器不可绑定原因与上传失败/重试提示。
2. 补 FIX-01 全部视口/缩放/选中组合及 FIX-02 四边、主动缩小容器、全部创建入口。
3. 补二次冲突、覆盖中断、乱序旧响应、跨图连接与拖放隔离的浏览器场景，单独核对快速操作时序。
4. 完整视觉/键盘签署后，再由原验收窗口决定整体验收结论。

本轮可以关闭旧对象存储环境阻塞，并确认知识库配置主链路可运行；尚不具备把所有整改验收项改为通过的证据。
