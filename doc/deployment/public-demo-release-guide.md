# Odyssey 公开 Demo 打包与更新规范

日期：2026-10-27

适用范围：Cloudflare Workers 静态资源或 Pages 的公开演示。发布的是前端、精选示例及公开文档，不部署 API、数据库、对象存储或工作流执行服务。

## 1. 产品边界

公开版以 `vite --mode demo` 构建，与普通生产构建分开；两种构建必须使用同一套路由页面、组件和样式。

- 可浏览两个 Journey，打开 Agent Workflow、查看节点配置、变量、工具与生成的 DSL。
- 可切换 Flow / Configure、平移缩放、Fit view、Focus；可浏览知识图谱、Inspector 和七篇文档。
- 不开放 Journey / Workflow 创建、节点编辑、删除、文件上传、导入、保存或实际执行。
- 页面明确标注 `PUBLIC DEMO · Read only`。没有登录、云端保存或真实模型调用。
- 只读画布通过 adapter flags 禁止节点拖动、连接、删除，配置卡片按控件禁用写操作，禁止对整个节点使用 `inert` 屏蔽查看入口；展示宿主只接收选中事件，不启动编辑 store 或 autosave。Repository 的修改入口也返回拒绝，不伪造保存成功。

公开版直接使用正式的 JourneyListView、JourneyEditorView、AgentWorkflowView、KnowledgeSpaceListView 和 KnowledgeSpaceDetailView。只替换 Repository 数据来源，并通过只读能力禁用写操作；不得另建简化页面代替。真实 API、事务、冲突及上传验收继续使用正常开发环境。

### UI 一致性：发布阻断规则

- 禁止为 Demo 新写一套页面布局、工具栏、导航、配置面板或知识库界面。禁止使用 Demo 专用 CSS 改变页面宽高、间距、字号、画布几何或默认缩放规则。
- 允许的差异仅限：精选公开数据、原位置写操作控件的禁用/只读状态、保存状态的只读文案，以及不改变布局的小型 Demo 标识。浏览入口、查看配置、Preview、模式切换及 Focus 应沿用正式交互。
- 不得用原始 JSON、简化卡片、单独案例入口或额外工具栏替换正式面板。新增页面和 UI 更新必须由同一源文件进入两种构建。
- 每次发布必须使用同一份数据、同一视口和同一操作状态，对普通构建与 Demo 构建进行页面对照。至少覆盖 1440/1024 两档宽度下的 Journey 列表、两个 Journey、两个 Workflow、DSL、知识库列表、图谱和文档，共 18 个状态。
- 自动校验页面结构与主要区域的位置/尺寸，允许误差不超过 2px；保留成对截图供人工复核。该检查不宣称所有像素完全相同，禁用状态与只读文案属于预期差异。
- 必须真实点击 Task 的 Tool step、Agent Action 的 Toolbox Tool 和 Reusable Tools 中已有条目，验证相同侧栏、配置值、关闭/返回、键盘与滚动。表单只读、保存禁用，但查看入口不能禁用；仅对照初始布局不足以通过验收。
- 任一必要区域缺失、布局超差或发现独立替代页面时，禁止生成可发布包。

首版 `odyssey-demo-20261026T163207Z-0230193` 使用独立 DemoWorkspaceView，违反本节，已弃用。后续上传必须选择完成共享页面修正后的新包，不能继续复用旧 ZIP。

## 2. 代码与数据来源

| 内容 | 来源 | 更新方式 |
| --- | --- | --- |
| Demo 数据适配与只读能力 | `apps/web/src/demo/`、Repository capabilities | 修改后重跑构建与浏览器检查 |
| 两个 Journey / Agent 快照 | 本地 API 中 Document Curator 和 Knowledge QA | pnpm demo:sync，只读导出 |
| 关联知识库、图谱和文档 | 仅导出两个案例固定引用的知识库 | 同步时保留 IDs、版本、配置、布局、变量、正文、摘要及关系 |
| 数据白名单 | apps/web/src/demo/data/selection.json | 修改案例范围必须明确检查 |
| 展示页面 | 正式 Vue 组件 | 共用源码与样式 |

快照存放在 apps/web/src/demo/data/snapshot.json，通过正式 schemas 校验。禁止重新编造案例、改名、重建简化图谱或从测试 fixture 代替本地案例。当前应为 Document Curator、Knowledge QA 两个 Journey，两个 Agent，Document Curator Playbook 与 Moonberry Island Guide 两个知识库，共七篇文档。不得导出其他测试 Journey。

只读 GET 导出，不修改本地数据。发布时将临时签名下载地址替换为内嵌文件，不发布凭据或签名。原存储文件缺失时，仅允许使用仓库案例目录中同名且 SHA-256 与资源记录完全相同的文件；无校验和或不一致则阻断。此回退不代表本地对象存储故障已修复。

同步前后复核版本，防止混合并发修改。打包末尾再次从本地导出核对；数据变化、API 不可用、文档缺失或校验失败均阻断发布。数据核对与 UI 对照是独立检查，不能以两个页面读取同一份错误数据作为本地一致性的证据。

禁止打包整个 Workspace、数据库导出、验收目录、.env、API 密钥、签名下载链接或个人资料。公开包内容均可下载。公开网站始终读取静态快照；本地更新后须重新打包并上传，不会自动同步。

## 3. 构建环境

- Node.js 22 或以上，使用仓库 `packageManager` 指定的 pnpm；安装时使用锁文件。
- Windows 浏览器检查默认使用已安装的 Google Chrome。其他平台可先运行 `pnpm --filter @odyssey/web exec playwright install chromium`。
- 如需指定 Chrome 路径，设置 `DEMO_CHROME_PATH`。
- 导出与发布核对需要启动本地 API 及其依赖。静态网站运行与已有快照预览不依赖后端。

首次准备：

```powershell
corepack enable
pnpm install --frozen-lockfile
```

如果机器尚未启用 Corepack，可沿用项目现有的 pnpm 安装方式，保持版本与仓库声明一致。

## 4. 每次更新的标准命令

在仓库根目录执行：

```powershell
pnpm demo:package
```

该命令依次执行：

0. `pnpm demo:sync`：按白名单导出本地两个案例及依赖，校验文档内容。
1. `pnpm check`：lint、类型检查、共享合同 / Web 测试和普通生产构建，保护正常编辑器。
2. `pnpm demo:build`：构建公开包 `apps/web/dist-demo` 和普通 UI 对照包 `apps/web/dist-demo-reference`；导出同一份只读数据供浏览器对照。记录源码和输出的 SHA-256 摘要，构建期间源码变化则失败。对照包仅供本地测试，不上传。
3. `pnpm demo:smoke`：启动两个临时静态服务与无界面浏览器，完成上述 18 个 UI 对照状态，以及正式页面的导航、Preview、只读限制、DSL、Focus 和深层刷新检查。公开包拒绝任何外部、API 或非 GET 请求。普通对照包使用正式 HTTP adapter，测试仅向其拦截并提供同一份 GET 数据，不连接真实后端，不伪造写成功。结束后关闭测试浏览器与服务。
4. `scripts/package-demo.mjs`：核对源码、公开构建、对照构建和通过的 UI 一致性结果属于同一版本，再次核对本地数据一致性，扫描本机地址与意外文件，再生成独立发布目录及 ZIP。没有通过共享页面对照时禁止出包。

任一步失败都不应上传。修复后重新执行完整命令。`pnpm build` 生成的是正常应用，不是公开 Demo。

本地仅检查展示：

```powershell
pnpm demo:build
pnpm demo:preview
```

打开 `http://127.0.0.1:4188`。手动预览不会自动替代发布前检查。

## 5. 发布包格式

每次输出独立目录，名称含 UTC 构建时间与 Git 短提交号：

```text
artifacts/demo/odyssey-demo-<UTC时间>-<短提交号>/
  site/                   可上传的网站，index.html 位于根目录
  upload.zip              site 内容的压缩包，index.html 也在 ZIP 根目录
  upload.zip.sha256        压缩包校验值
  release-manifest.json   源码摘要、发布文件清单和各文件校验值
  SHA256SUMS.txt           网站文件校验值
  browser-evidence/       浏览器结果、ui-parity.json 和成对截图，不上传
  UPLOAD-README.txt        本次上传说明
```

`site/release.json` 用于线上核对版本，包含提交号、源码摘要、构建时间及工作区是否存在未提交修改。

首次本地预览可以使用工作区构建，但必须如实标注。稳定发布应先将所有需要的源码、锁文件、Demo 数据和发布脚本提交，再打包，确保别人可以复现。不要仅凭提交号推断未提交构建的准确内容。

`artifacts/`、`dist-demo/` 与临时证据被 Git 忽略。代码、Demo 数据和本规范需要纳入版本管理；构建产物单独保留。

## 6. 上传 Cloudflare 静态托管

1. 当前已发布项目是 Workers 静态资源，网址为 `https://shiny-dawn-ff43.houliang008.workers.dev/`。进入该项目，点击 **New deployment** 上传新包即可，不需要重新建项目。首次使用 Pages 时，也可以创建 Pages 项目并选择直接上传。
2. 保留现有项目和公开地址，只更新静态资源；不添加 Functions、数据库或动态 API。
3. 上传本次 `upload.zip`，或拖入本次 `site` 文件夹。只选择其中一种。
4. 不上传发布目录的上一级，不上传源码仓库，也不上传 `apps/web/dist`。
5. 部署后沿用现有 `*.workers.dev` 或 `*.pages.dev` 地址，后续按需绑定自有域名。

Pages 对没有顶层 `404.html` 的应用使用 SPA 回退。本包不生成顶层 `404.html`，以支持 `/journeys/...` 及文档页面直接打开和刷新。Workers 静态资源需另确认其 SPA / 未找到资源回退设置，不能把 Pages 的默认行为当作 Workers 的配置证明。`_headers` 为入口与版本文件设置重新验证，并声明基本响应头。

平台入口文案可能调整，以 [Cloudflare 直接上传文档](https://developers.cloudflare.com/pages/get-started/direct-upload/) 和 [SPA 页面处理说明](https://developers.cloudflare.com/pages/configuration/serving-pages/) 为准。

## 7. 发布验收 checklist

### 打包前

- [ ] 所需代码、Demo 数据与锁文件已检查；没有误覆盖其他窗口修改。
- [ ] Document Curator、Knowledge QA 的版本与本地一致，依赖文档校验通过。
- [ ] 示例内容可公开；没有凭据、个人数据、本机 API 或对象存储签名链接。
- [ ] `pnpm demo:package` 成功，浏览器结果与 `uiParity` 均为 `passed`，至少 18 组对照完整。
- [ ] 查看 `browser-evidence` 内的普通版 / Demo 成对截图，页面结构与主要布局一致，差异仅为已声明的只读状态。
- [ ] 本地打开两个案例，能辨认主要节点，Flow / Configure、Fit 和 Focus 可用。
- [ ] 已确认本次是工作区预览包还是干净提交发布包，版本记录符合实际。

### 上传后

- [ ] 首页、案例列表、两个 Journey 和 Agent 页面可打开。
- [ ] 从独立浏览器或无痕窗口直接访问 Workflow 深层链接并刷新，未出现 404。
- [ ] 两个知识库分别显示 3 篇 / 4 篇文档、各 6 条关系，可打开 Inspector 和正文。
- [ ] 创建、上传、删除、保存入口不可用；键盘也不能编辑图或触发写入。
- [ ] Network 中无 `/api/`、`localhost`、`127.0.0.1`、非 GET 或意外第三方请求；Console 无新增异常。
- [ ] 访问 `/release.json`，其 `releaseId`、`commit` 和 `sourceDigest` 与本次包一致。
- [ ] 记录网址、Cloudflare deployment、releaseId 和上传日期。

## 8. 后续更新与回滚

更新代码或案例后，重新执行 `pnpm demo:package`，在**同一 Workers 或 Pages 项目**中创建新的部署，上传新的 ZIP。不要新建一个项目来替换同一个公开地址，也不要手工混合新旧 assets。

保留上一个通过线上检查的完整发布目录。新版本异常时，可使用平台可用的部署回滚功能，或将旧包重新上传为一次新部署。回滚后重新检查 `/release.json` 和深层链接。

如果浏览器仍显示旧内容，先核对线上 `/release.json` 与对应部署，再用无痕窗口确认；不要靠手工修改构建后的 JS 修补线上版本。

新增页面和 UI 更新应通过共用源码同时进入正常版和 Demo。新增写操作默认不得在公开版启用；新增路由、领域 schema、数据来源或外部资源时，必须明确其只读行为，并扩展同源页面和权限检查。
