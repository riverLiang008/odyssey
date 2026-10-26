# Odyssey 待补验项目收尾 · 2026-10-26

状态：待补验技术项目全部执行通过；补验发现的 5 处缺陷已修复并通过浏览器复测，最终整套检查通过。原验收窗口签署栏不代勾。

本记录承接[先期复验记录](./acceptance-remediation-retest-2026-10-26.md)中列出的待补验范围，不能用先期“部分通过”的结论替代本次结果。

## 版本和隔离

- HEAD：`2661756d2339ac4a020ff3b7a06ac701dcbf6a39`，叠加当前未提交工作区。保留其他窗口已有的后端、DSL、知识图谱、资料及基础设施修改。本次没有提交或推送。
- 沿用专用 Workspace `a8e21026-2026-4026-8026-000000000001`、Journey `5e6476ec-8c90-4f5b-9619-d06e617cb3f3`、Agent `bae1c78f-862d-44fe-b397-feece6213b89`、Knowledge Space `2ab56e8d-12a9-479b-be05-b81570234b91`。
- 真实 API 18200、PostgreSQL 55432、RustFS 9000。测试 Web 4173 → 本地请求代理 18201；S3 测试代理 19000 仅转发到真实 RustFS。代理只注入失败或控制请求/响应释放时机，没有伪造成功响应、CAS 或存储结果。
- 内置浏览器用于真实上传、关系图、绑定限制和传输异常；其 viewport capability 本轮未真正改变 `innerWidth/innerHeight`，因此不以它证明指定视口。尺寸矩阵改用独立 Headless Chrome，每档断言真实 `innerWidth/innerHeight`。先期依赖 capability 设置的尺寸结论由本次实测取代。
- 浏览器测试通过公开 API准备两 Loop 的专用场景，结束后恢复原专用 Workflow；不改业务 Journey。失败分析状态是额外的负向 fixture，因为 V1 没有自动索引器；没有给真实上传文件强写成功索引状态。

## 补验结果

最终浏览器汇总：[closure-browser-results.json](../../temp/acceptance-2026-10-26/closure-browser-results.json)。这是 10 组检查的汇总，内部矩阵数量分列如下，不把每次点击另算一个测试。

| 范围 | 实测与结果 | 证据 |
| --- | --- | --- |
| FIX-01 完整视口矩阵 | **通过**。1440/1024 × 900、普通/Focus、根图/Loop、选中/未选中、放大/缩小，共 32 组，每组双向切换 3 轮。无空白、无漂移；业务图、placement、revision 不被模式切换修改 | [viewport-matrix.json](../../temp/acceptance-2026-10-26/viewport-matrix.json) |
| FIX-02 四边及容器操作 | **通过**。子 Branch 向左、上、右、下边界拖动，主动请求缩小 Loop，移动父容器，再刷新。实际卡片保持包含，领域配置不变；不允许的缩小按实际内容夹紧 | `remaining-browser-results.json` 中 four borders 项、[刷新图](../../temp/acceptance-2026-10-26/loop-boundaries-refreshed.png) |
| FIX-02 创建入口 | **通过**。Task、Agent Action、Branch × Palette 点击/拖入，6 组。正确写入 Loop body，根节点数量不误增；不受夹紧的内部落点与指针释放位置误差小于 2px。嵌套 Loop 仍被拒绝 | [creation-browser-results.json](../../temp/acceptance-2026-10-26/creation-browser-results.json)、`creation-position-final.log` |
| 非零关系知识图谱 | **通过**。2 篇真实文件、1 条 references 关系，经校验预览、应用、刷新后仍存在。选中详情包含对应摘要、指南、标签、关系；实际 SVG edge 数为 1 | [Manifest](../../temp/acceptance-2026-10-26/manifest-relations.json)、[刷新截图](../../temp/acceptance-2026-10-26/graph-relations-refreshed.png) |
| 不可绑定资源 | **通过**。Action 中失败/未索引资源禁用并显示原因，归档/外 Workspace 不出现在候选列表；Task 下拉只有可用空间及事件绑定选项。绕过 UI 提交不可用 ID，前三类返回 409，外 Workspace 返回 404，图与 revision 不变 | [negative-binding-results.json](../../temp/acceptance-2026-10-26/negative-binding-results.json)、`visual-browser-results.json` 中 taskOptions |
| 浏览器上传失败/重试 | **通过**。PUT 中断显示 NETWORK_FAILED，complete 中断显示错误；失败均不产生可见成功文件。恢复后重新选择文件重试，只有一个成功记录且刷新仍在 | [PUT 失败](../../temp/acceptance-2026-10-26/browser-put-failure.png)、[重试刷新](../../temp/acceptance-2026-10-26/upload-retry-refreshed.png)、`transport-events.jsonl` |
| 二次冲突与覆盖失败 | **通过**。覆盖 GET 后、PUT 前由第二写入者推进真实 revision，恢复 PUT 得到真实 409，服务器新内容保留；覆盖 PUT 失败时保留本地草稿并显示 Save failed，恢复后 Save now 成功 | [overwrite-race-result.json](../../temp/acceptance-2026-10-26/overwrite-race-result.json)、[失败图](../../temp/acceptance-2026-10-26/overwrite-failure.png) |
| 旧响应与保存中离开 | **通过**。第一笔保存已提交但延迟返回时继续编辑，释放旧响应后新文本保留并继续保存；保存响应未回时点击返回，导航等待保存，释放后完成导航，数据已持久化 | [旧响应图](../../temp/acceptance-2026-10-26/late-response-browser.png)、`extra-browser-results.json` 中 pending save navigation |
| 跨图连接与拖放隔离 | **通过**。根图→Loop、Loop→根图、Loop→另一 Loop 均有拒绝提示且不改图/不额外保存；资源拖到 pane 不新建节点，节点拖到资源区域不绑定资源且只创建一次 | [qa-browser-results.json](../../temp/acceptance-2026-10-26/qa-browser-results.json)、[拒绝截图](../../temp/acceptance-2026-10-26/cross-loop-connection-rejected.png) |
| Branch 快速确认、键盘与 Focus | **通过**。输入框 Backspace 不删节点；菜单 Escape 恢复焦点；Focus 退出恢复入口；草稿确认框 Tab 限制及取消焦点恢复；连接 Case 取消不变，连续 Confirm/Apply 后只删 Case 和相关边，目标节点保留 | [qa-browser-results.json](../../temp/acceptance-2026-10-26/qa-browser-results.json) |
| Preview 扩展 | **通过**。1440/1024 下包含负坐标、长 Goal/Case、两个 Loop 和特殊出口的 Preview，所有卡片位于视口内、Branch 位于 Loop 内，SVG 路径起点与对应 Case 端口误差小于 2.5px；inert 生效，输入控件不进入 Tab 顺序 | [extra-browser-results.json](../../temp/acceptance-2026-10-26/extra-browser-results.json)、[1024 截图](../../temp/acceptance-2026-10-26/preview-extra-1024.png) |
| 右键菜单键盘路径 | **通过**。Shift+F10 打开节点菜单、动作取得焦点、Escape 关闭并恢复节点焦点；组件另测方向键跳过禁用项和外部点击不抢焦点 | [context-keyboard-results.json](../../temp/acceptance-2026-10-26/context-keyboard-results.json) |

不可用 fixture ID 见 `negative-fixture-ids.json`。实际成功上传文件 ID/状态见 `final-resources.json`；中断上传的 staging 对象不当成成功文件。当前空间额外有一个成功上传但未索引的重试文档，不把它冒充 Manifest 中的已索引文档。

## 补验中修复的 5 处问题

| 问题 | 修复与回归 |
| --- | --- |
| Branch 表单内 Escape 无效 | form 阻断了冒泡，外层 Escape 处理收不到事件。form 内明确处理 Escape，仍保留对子控件事件的隔离；真实浏览器草稿确认/取消/焦点恢复通过，新增组件回归 |
| Branch 点击和拖入入口不一致 | Loop drop 白名单只允许 Task/Action，遗漏 Branch。允许 Branch，继续拒绝嵌套 Loop；三种节点四类适配器输入及真实 6 组入口验证 |
| 下拉框关闭丢焦点、禁用占位无法键盘进入 | 关闭/选择后恢复 trigger；打开时跳过禁用占位；关闭状态的 Escape 继续交给父面板。新增组件回归及 4 档真实视觉/键盘检查 |
| Configure 拖入 Loop 落点偏移 | 根图模式坐标转换错误地再次缩放了 Loop 内部偏移。实测曾偏左约 54px、偏上约 152px。现在直接命中实际 projection 中的 Loop 显示边界并换算局部坐标，根图创建仍走原坐标转换；包括测量扩展后的显示边界。边缘按安全余量夹紧，内部点按实际释放位置验证 |
| Canvas 右键菜单没有动作焦点 | 新增只负责菜单焦点的展示组件，支持首次聚焦、方向/Home/End、Escape 恢复，以及外部点击关闭不抢焦点。菜单项仍由视图发出既有 command，不改变领域规则 |

生产修改涉及 `AppSelect`、`BranchConfigPanel`、`WorkflowCanvas`、新增 `WorkflowCanvasContextMenu` 及 AgentWorkflowView 的菜单宿主。没有改后端、数据库 schema、持久化合同；之前已修复的 Branch 缓存与 Preview 名称解析保持。

## UI-25～29 视觉和可访问性复核

参考 Figma 文件 `P3EF9io2DhyhwkNYBVqB5Z`，节点 875:98/214/271/362/480；UI-28 本轮重新取图，其余沿用本会话已读取的同一设计源。

| 参考状态 | 对照结果 |
| --- | --- |
| UI-25 Configure | 白卡、Branch 类型色、Case 顺序、条件摘要、Default 最后、长名称换行、配置面板在两档宽度内；通过 |
| UI-26 Flow | 紧凑路由摘要与出口随卡片统一缩放；模式切换保留工作区域；通过 |
| UI-27 New Branch | 使用未提交草稿，验证通过才创建领域节点，避免把未配置的非法数据持久化；点击和拖入一致；通过 |
| UI-28 Validation | 无效布尔输入有明确字段提示且不能应用；选项不可用状态与有效绑定区分，旧领域图保留；通过 |
| UI-29 Editing details | Case 顺序/身份/连线保持；删除展示条件及出边影响、保留目标；取消、确认、键盘和焦点路径通过 |

截图：`visual-1440-normal-configure.png`、`visual-1440-focus-configure.png`、`visual-1024-normal-configure.png`、`visual-1024-focus-configure.png` 及对应 Flow 图，均在证据目录。结构化结果见 [visual-browser-results.json](../../temp/acceptance-2026-10-26/visual-browser-results.json)。

差异处理：沿用仓库统一节点侧边类型色条、显式 Apply/Reload、扩展的变量来源和类型控件；不为静态稿重新引入重复配置或无效的持久化状态。对照以布局可用、状态语义、信息可见、键盘与焦点为准，不宣称像素级完全一致或已获得设计负责人签字。

## 重跑方法和质量检查

证据根目录：`doc/temp/acceptance-2026-10-26/`。

1. 启动真实 API/数据库/RustFS；启动 `transport_harness.py`，测试 Web 设置 `VITE_API_BASE_URL=http://127.0.0.1:18201/api/v1` 后在 4173 启动。
2. 测试工具依赖装在证据子目录，没有改项目 package.json/lock：`npm install --prefix doc/temp/acceptance-2026-10-26/browser-suite --no-save --ignore-scripts playwright@1.56.1`。使用机器现有 Chrome，可按机器路径调整 executablePath。
3. 运行 `node doc/temp/acceptance-2026-10-26/browser-suite/remaining.cjs`。可设置 `TEST_MATCH` 选检查组、`RESULTS_NAME` 改结果文件。不要同时运行两个会改相同专用 Workflow 的套件；fixture 恢复也遵守 CAS。首次依赖服务和负向 fixtures，重跑前确认本地测试数据。
4. `pnpm check` 覆盖 lint、typecheck、共享合同/Web 全套测试和 production build。最终日志为 `closure-check-final.log`；未运行远程 CI，不宣称 CI 通过。

最终 `pnpm check` **exit 0**：lint、typecheck、共享包 9 文件 93 项、Web 106 文件 611 项、production build 全部通过。`git diff --check` 在本次修改范围内通过。同日先期隔离 PostgreSQL 测试 154 项通过，本次没有新增后端生产代码；本次额外执行的真实 HTTP/S3 与浏览器异常检查单列在上表，没有用测试存储替代真实上传证明。

已停止本轮临时 4173 Web、18201/19000 请求代理，恢复内置浏览器的视口设置并关闭本轮专用标签；保留原有开发服务及专用测试数据供复现。

此前失败日志保留：遮挡的测试点击、冷启动超时、fixture 并发、浮点严格相等、近边界夹紧与测试预期不符，均没有当作软件缺陷掩盖；真正的 Escape、Branch 拖入、下拉焦点、落点、菜单焦点问题均先有失败再修复复测。最终结果仅采纳上表通过的记录。

## 交付结论

先期报告列出的待补验范围已完成执行，本轮没有遗留的已确认软件缺陷。原验收窗口 checklist 保留给最终独立复核，不代签；本地检查与远程 CI 分别记录。本轮代码、回归测试及整改文档按用户要求纳入 Git 提交，未推送；证据目录为本地复验产物，未纳入代码提交。
