# Knowledge Space V1：前后端纵向切片 TODO

> 状态：KS-A create/list/detail 与 mutation 管理闭环已实现并通过验收
> 日期：2026-10-08
> 目标：暂时冻结 Workflow Canvas 的非阻塞视觉微调，优先完成可由正常 UI 创建、浏览和维护的 Knowledge Space，并用真实 Knowledge Space 数据收口 Canvas 的绑定与 Knowledge Retrieval 配置。

## 1. 决策与边界

### 1.1 当前决策

- [x] Knowledge Space 作为 Workspace 独立资产，不属于某个 Journey 或 Agent。
- [x] 暂停 Canvas 的非阻塞视觉优化；已完成的 Canvas、Tool、Variable 和 Reusable Tool 能力继续保留。
- [x] Knowledge Space 使用现有产品术语；“KB”仅作为口语简称，不新增 `KnowledgeBase` 领域对象。
- [x] V1 交付 CRUD、文件工作区、持久化 seed graph 和只读图谱，不实现自动索引执行引擎。
- [x] Knowledge Family 是由 tags/graph 派生的只读 UI 投影，不新增独立可编辑 Family aggregate。
- [x] Canvas 中的 Knowledge Space 绑定继续保存 UUID 引用，不复制 Knowledge Space 内容。

### 1.2 Figma 权威画面

| 页面/状态 | Figma frame | Node ID | V1 用途 |
| --- | --- | --- | --- |
| Knowledge Space List | `OdyJourney — Asset - Knowledge Space` | `145:8` | 搜索、筛选、分类卡片、创建入口 |
| Graph Overview | `Knowledge Space — Graph Overview` | `147:44` | 文件树、概览、只读知识图谱 |
| Document Inspector | `Knowledge Space — Document Inspector` | `148:58` | 选中文档后的上下文详情 |
| Document Detail | `Knowledge Space — Document Detail` | `157:2` | 元数据编辑、引用与内容预览 |
| Canvas Knowledge Retrieval | `Agent Workflow Canvas — Tool Configuration (Knowledge Retrieval)` | `177:33` | 最终真实数据回接 |

Figma 尚未完整画出的状态，以 `knowledge-space-specification.md` 为产品依据：

- List loading / empty / no-results / partial-failure；
- active filters；
- New Knowledge Space modal；
- Needs Review / graph error；
- upload/indexing/failure feedback；
- keyboard focus、窄桌面和可访问性状态。

### 1.3 当前真实基线

#### 已有

- [x] 数据库已有 Knowledge Space、Category、Workflow reference 等基础表。
- [x] `GET /api/v1/knowledge-spaces` 支持 Current Workspace scoped list、搜索、分页和稳定排序。
- [x] Pydantic/Zod 已有 Knowledge Space summary、lifecycle status 和 graph status 合同。
- [x] Agent Workflow save 已验证 Knowledge Space 引用并同步 derived reference rows。
- [x] Canvas 资源面板能够读取 Knowledge Space inventory，并保存引用。

#### 尚缺

- [x] Category inventory/create contract 已落地；rename/reorder/delete 仍待后续管理批次。
- [x] Knowledge Space create/detail/update/archive/delete contract 已落地。
- [ ] Folder metadata CRUD（tree read 与 root-level create 已完成；rename/move/delete 待续）。
- [ ] Document metadata CRUD。
- [ ] Object storage upload/download/delete workflow。
- [x] Graph Overview projection、node、edge、tag/family、reference 和 issue read API 已落地；development seed command 待续。
- [x] Knowledge Space List、Create modal 和 Detail shell 已落地；Inspector/Document Detail 属于 KS-C。
- [ ] 使用真实 Knowledge Space 数据的 Canvas 与 Knowledge Retrieval 浏览器验收。

## 2. 总体依赖关系

```text
KS-0 冻结合同、V1 范围与删除语义
        │
        ├────────────────────┐
        ▼                    ▼
KS-A-BE 基础资产 API     KS-A-FE 页面骨架/状态
        └─────────┬──────────┘
                  ▼
        KS-A 创建→打开→刷新闭环
                  │
                  ▼
KS-B Folder/Document/Object Storage
                  │
                  ▼
KS-C Seed Graph/Inspector/Document Detail
                  │
                  ▼
KS-D Canvas Picker/Knowledge Retrieval 回接
                  │
                  ▼
QA 全量门禁与真实浏览器验收
```

串行阻塞点：

1. `KS-0` 必须先于前后端写接口。
2. Create/Detail contract 和 Category 语义必须先于真实页面联调。
3. 文件上传必须先于“真实文档列表”；不得用只存在于浏览器内存的文件伪装完成。
4. Graph read contract 必须先于 Vue Flow/read-only graph adapter。
5. Canvas Knowledge Retrieval 真实验收必须等至少一个可用 Knowledge Space 能从 UI 创建并持久化。

可以并行：

- 合同冻结后，后端 asset API 与前端页面骨架/纯组件可以并行。
- Folder tree UI 与 object-storage port/fake 可以并行，但联调必须等待 staged upload contract。
- Graph presentational components 与 seed/read API 可以并行，但不得各自发明 view model。
- 键盘路径、loading/error states 与 pointer interaction 可以并行，最终派发同一 typed intent。

## 3. KS-0 — 合同和产品语义冻结

### KS-0.1 Knowledge Space aggregate

- [x] 冻结 Create request：本批为 name、description、category ID；initial files 明确延后到 KS-B staged upload，不进入同一 HTTP create transaction。
- [x] 冻结 Detail response：overview、真实 counts、timestamps、status、root folder identity 和 revision，不把 presentation string 放进 API。
- [x] 冻结 Update request 与数据库级 `expectedRevision`/CAS。
- [x] 冻结 normalized name 的 Workspace 唯一性与稳定冲突错误。
- [x] 冻结 lifecycle transition：initializing、ready、syncing、failed、archived。
- [x] 已确认现有 schema 包含 revision，但不含 archived；本切片不伪造归档，archive 进入后续明确 migration/contract 批次。
- [x] 冻结 archive 与 delete 的区别：archive 可逆；delete 仅允许 archived、无文档且无引用的资产。
- [x] 删除前检查 Workflow、Agent Template、Tool Template 等引用；cross-Workspace 统一 `NOT_FOUND`。

### KS-0.2 Category

- [x] Category 是 Workspace-scoped list organization，不是 Workspace type 或 knowledge tag。
- [ ] 冻结 list/create/rename/reorder/delete 行为。
- [ ] 冻结 default category；删除非空 Category 时禁止、迁移或要求显式目标 Category。
- [ ] Category color token 只接受受控 token，不接受任意 CSS。

### KS-0.3 Folder、Document 与 Artifact

- [x] Folder hierarchy 只表示用户目录，不推导语义关系。
- [x] Document 属于一个 Knowledge Space 和一个 folder。
- [x] 冻结文件名、folder identity、MIME、size、SHA-256 checksum、index status 和 active artifact contract。
- [x] 冻结 staged upload happy path：prepare/direct PUT/complete，外部 I/O 不占用数据库事务；失败清理仍保留在下方任务。
- [ ] 冻结 rename/move/delete 的 revision、冲突和引用行为。
- [x] Document content 默认 preview；Markdown 文档支持源码编辑与渲染预览，不提供富文本正文编辑器。

### KS-0.4 Graph read model

- [x] Graph snapshot 是只读 projection；node/edge/family 不复用 Workflow graph contract。
- [x] Node identity 使用 document ID；edge identity 和 direction 稳定。
- [ ] Knowledge tags 与 user-reviewable references 可编辑；index timestamp 和 issue code 只读。
- [ ] Knowledge Family 由 tags/graph 派生，不建立双重 source of truth。
- [x] V1 graph projection 仅从持久化 resource/tag/relation/issue 数据读取，production component 无硬编码 mock；development seed command 待续。
- [x] 无 graph snapshot 时返回明确 `not_indexed` 状态，而不是空图冒充 healthy。

### KS-0.5 Shared contract parity

- [x] 已更新本切片所需的 Zod request/response schema。
- [x] 已更新本切片所需的 Python Pydantic boundary models。
- [x] 已添加 create/detail/summary/mutation 的 positive/negative contract tests。
- [x] 已更新 OpenAPI operation、repository adapter 和现有稳定错误映射。
- [x] 本切片所有 request/response strict，拒绝多余字段。

## 4. KS-A — 基础管理闭环

目标：用户能够从 Knowledge Space List 创建真实资产，打开 Detail，刷新后仍存在。

### KS-A-BE 后端

- [ ] 扩展 list API：Category、graph status、sort 和 archive filters；保持稳定分页。
- [x] list summary 补齐 Figma 所需的 category、真实 file/family/issue counts 和 created/updated 时间。
- [x] 实现 Workspace-scoped Category inventory。
- [x] 实现 Workspace-scoped Category create，供空 Workspace 与 inline category creation 使用。
- [x] 实现 Knowledge Space create：同一事务创建 KS、root folder 和初始 revision。
- [x] 实现 Knowledge Space detail read。
- [x] 实现 Knowledge Space metadata update，使用数据库 CAS。
- [x] 实现 archive/unarchive；默认 list 隐藏 archived。
- [x] delete 在存在引用、documents 或不可满足 precondition 时返回稳定冲突错误。
- [x] Router 仅负责 boundary；service 拥有 transaction；repository 不 commit。

#### KS-A-BE 测试

- [x] strict request/response、normalized-name conflict、empty/list/detail contract 已覆盖；并发 conflict 将随完整 mutation suite 补齐。
- [x] create 成功一次 commit；root folder 与 KS 位于同一 transaction。
- [x] stale update/archive 产生 `REVISION_CONFLICT`，失败不消耗 revision。
- [x] Workspace isolation 已覆盖 list/read/create/update/archive/delete endpoint。
- [x] referenced/document delete 被保护且不泄漏 foreign existence。
- [x] PostgreSQL create→detail→root folder→cross-Workspace hidden integration test 已通过。

### KS-A-FE 前端

- [x] 新增 `/assets/knowledge-spaces` route 和 List page。
- [x] 按 Category 分组渲染 responsive card grid。
- [x] 已实现 search、Category/graph status/archive filters 和 sort。
- [x] 实现 loading skeleton、empty、no-results、full failure 与 retry；partial category failure 仍待分页/分段加载策略。
- [x] 实现 New Knowledge Space modal：name、description、existing/inline new category；initial upload 留给 KS-B。
- [x] 实现 `/assets/knowledge-spaces/:knowledgeSpaceId` route 和 Detail shell。
- [x] 前端 repository 对所有 response 做 runtime validation。
- [x] server entity/state 与 modal/filter/selection state 分离。
- [x] request race、route switch、unmount 和 stale response 使用 abort/latest-request identity 保护。

#### KS-A-FE 测试

- [x] shared schema 与 HTTP repository adapter tests。
- [x] 已覆盖 list grouping、create happy path、detail metadata update、archive 与 protected delete；filters、cancel、duplicate conflict 继续作为增量覆盖。
- [x] create success 后导航到服务端返回的真实 ID，而不是客户端临时 ID。
- [ ] route 切换时旧 detail response 不覆盖新页面。
- [ ] 真实浏览器：create → open → refresh → list/search 能再次找到。

### KS-A 验收门

- [x] 正常 UI 创建 Knowledge Space 已由用户验收。
- [x] 数据来自 PostgreSQL，刷新后仍存在；服务重启持久性沿用同一数据库验收。
- [x] 当前 Workspace 可见，其他 Workspace 不可见。
- [x] Figma list 布局和创建流完成首轮视觉校准。
- [x] 无生产 mock、无组件直接 mutation、无 ORM 泄漏。

## 5. KS-B — Folder、Document 与对象存储

目标：用户能够维护真实目录并上传、查看和删除文件。

### KS-B-BE 后端

- [x] 实现 folder tree read。
- [x] 实现 root-level create folder（Workspace/KS/parent scope、CAS revision、同级重名冲突）。
- [ ] 实现 nested create、rename/move/delete folder，并验证 cycle、root 和非空规则。
- [x] folder tree 返回持久化 document summary；独立 document detail 留到 KS-C。
- [x] 按 object-storage design 实现 staged upload port 和 S3-compatible MinIO adapter。
- [x] finalize 时校验 Workspace ownership、KS/folder identity、MIME、size、checksum。
- [x] 实现 download/preview 的短期授权访问，不把存储 secret 暴露给客户端。
- [ ] 实现 document rename/move/delete（move/delete 已完成；rename 待续）。
- [ ] 上传/删除失败具备幂等重试和 orphan/staged cleanup 策略。
- [x] 文件外部 I/O 不进入数据库事务。

#### KS-B-BE 测试

- [ ] folder cycle、duplicate sibling name、root protection、cross-KS move rejection。
- [x] upload prepare/finalize/idempotency 与 checksum persistence；mismatch/error 分支仍需专门用例。
- [ ] object upload 成功但 DB finalize 失败的补偿/清理。
- [ ] DB 成功后 response/runtime validation 失败的 rollback/诊断。
- [x] cross-Workspace folder/document/artifact not-found hiding。

### KS-B-FE 前端

- [x] Figma 对齐的 left folder panel，已接 persisted folder/resource tree；resize 属于可选视觉微调。
- [x] file/folder tree expand/collapse，状态仅保存在 UI state。
- [x] 文件可拖放到其他文件夹；drop preflight、目标反馈、revision-aware 持久化与失败不回滚 UI 已覆盖。
- [x] Upload 与 New Folder 使用可见按钮；Upload 在 staged-upload contract 落地前保持明确禁用，context menu 仅作为补充。
- [ ] Upload 已接真实 prepare/direct PUT/complete 与 visible uploading/failure state；percent progress、retry、cancel 仍待完成。
- [x] 文件点击直接导航到 nested Document Detail route；folder tree 不触发 Inspector，Inspector 保留给未来 graph node 单击。
- [x] 文件可从右键菜单或 Document Detail 删除；确认、revision-aware 持久化、树/计数更新和对象缺失容错已覆盖。
- [ ] keyboard navigation、focus restore 和 accessible labels。

### KS-B 验收门

- [ ] 浏览器创建 folder 并上传至少一个 `.md` 文件。
- [ ] 刷新后 folder/document hierarchy、metadata 和 preview 一致。
- [ ] 删除/失败/重试不会留下前端 ghost item 或后端孤儿 active artifact。
- [ ] MinIO/DB ownership、checksum 和 cleanup 测试通过。

## 6. KS-C — 只读图谱、Inspector 与 Document Detail

目标：用持久化 seed 数据完整走通 Figma 的渐进披露路径。

Demo graph 的前端 Manifest Import、辅助 seed 与未来 Graph Producer 边界见 [`backend/knowledge-graph-demo-seed-plan.md`](./backend/knowledge-graph-demo-seed-plan.md)。

### KS-C1 — Manifest Import 纵向切片

目标：用户先通过正常 UI 上传文档，再从 Graph Overview 导入 reviewed `manifest.json`；后端完成严格校验、变更预览和原子 Apply，最终由正式 Graph Overview API 返回持久化结果。

#### KS-C1-0 合同与语义冻结

- [x] 冻结 Manifest V1 strict schema；同步 TypeScript Zod、Python Pydantic/internal model 与 positive/negative fixtures。
- [x] 冻结 document key 与 root-relative canonical path 规则：统一 `/`、大小写敏感、禁止绝对路径、`.`、`..` 和路径逃逸。
- [x] 冻结 document path 的 missing、duplicate 和 ambiguous 行为；V1 任一错误均拒绝整次 Apply。
- [x] 冻结 Manifest 可写字段：summary、guide、tags、relations、issues，以及由候选结果派生的 graph status。
- [x] 冻结 Manifest 禁止修改字段：Workspace/KS/folder/resource identity、文件名、目录位置、正文、MIME、size、checksum、object key 和系统时间戳。
- [x] 冻结 provenance：至少区分 `manifest`、`user` 与未来 `llm`；新 Manifest 仅替换上一份 manifest-managed projection。
- [x] 冻结重复导入语义：同一 checksum 返回 `already_up_to_date` 且不消耗 revision。
- [x] 冻结 Family V1 继续由 tag membership 派生，不新增 Family aggregate 或第二份 source of truth。
- [x] 决定 provenance 的持久化位置：使用专用 Import 记录及 annotation `source/source_key` 字段；下一批以最小 migration 落地，不使用显示名称或无约束 metadata 推断来源。
- [x] 冻结 Validate/Apply request、response 与稳定错误码；OpenAPI examples 随下一批路由注册落地。

#### KS-C1-BE Validate

- [x] 实现 `POST /knowledge-spaces/{knowledgeSpaceId}/graph-manifest/validate`。
- [x] Validate 使用 Current Workspace scope 加载 KS、revision、root folder 和当前 document paths。
- [x] Manifest 作为不可信输入完成 strict parsing、cross-reference validation 和 candidate graph validation。
- [x] 校验所有 source/target/resource/relation key 存在，禁止 self relation 和 cross-KS relation。
- [x] 校验 relation kind/status/confidence、issue kind/severity/resolution status 和 graph status 一致性。
- [x] 返回 matched/unmatched document、summary/guide/tag/relation/issue counts 和 resulting graph status。
- [x] 返回结构化 validation issues，包含稳定 `{path, code}`；不得只返回英文 message。
- [x] Validate 不执行任何数据库或对象存储 mutation，不消耗 Knowledge Space revision。
- [x] 生成短期 validation token，绑定 Workspace ID、Knowledge Space ID、expected revision、manifest checksum 和 expiry。
- [x] token 不携带完整 manifest、文档正文、对象存储 URL 或 secret。

#### KS-C1-BE Apply

- [x] 实现 `POST /knowledge-spaces/{knowledgeSpaceId}/graph-manifest/apply`。
- [x] Apply 重新验证 validation token、checksum、Current Workspace、KS identity、expiry 和 expected revision。
- [x] revision 与 Validate 时不一致返回 `REVISION_CONFLICT`，不尝试部分合并。
- [x] 定义内部 `ManifestGraphProducer`，输出 validated document annotations、tags、relations 和 issues；producer 不直接访问 repository。
- [x] Application service 拥有唯一数据库事务；repository 不 commit。
- [x] 在候选状态完整验证后，一次性更新 document summary/guide、manifest-managed tags/relations/issues。
- [x] 保留 provenance 为 `user` 的 annotations；不得因替换 Manifest 静默删除用户数据。
- [x] 使用稳定 manifest key/UUIDv5 保持可复现 identity；禁止数组下标、显示名称或随机顺序成为引用 identity。
- [x] Apply 成功时 Knowledge Space revision 恰好递增一次，并更新 graph status、last indexed time 和 derived counts。
- [x] 同一 checksum 重复 Apply 返回 `already_up_to_date`，不创建重复行、不递增 revision。
- [x] 任一 validation/constraint/response assembly 失败时整笔数据库事务回滚。
- [x] Apply 返回 mutation result 与新 revision；前端随后重新读取正式 Graph Overview API，不维护第二份 graph 副本。
- [x] production 不自动导入 Manifest；UI 能力受明确 Demo/development feature flag 控制，production 默认关闭。

#### KS-C1-BE 测试

- [ ] Pydantic/Zod parity：Healthy、Needs Review、unknown fields、duplicate keys、missing references、invalid confidence 和非法 issue/status 组合。
- [ ] path validation：absolute、`.`、`..`、separator normalization、case mismatch、missing 与 ambiguous document。
- [ ] Validate read-only：成功和失败均不产生数据库写入或 revision 变化。
- [x] token：过期、篡改、cross-Workspace、wrong KS、wrong checksum 和 wrong revision 均拒绝。
- [x] PostgreSQL 首次 Apply 创建完整 graph projection，Graph Overview API 返回相同 nodes/edges/families/issues。
- [x] PostgreSQL 重复 Apply 幂等且不消耗 revision。
- [ ] PostgreSQL stale revision、mid-transaction failure 和 response validation failure 后独立 session 验证无 partial rows。
- [x] replacement 只删除 manifest-managed annotations，并保留 user-managed annotations。
- [x] cross-Workspace validate/apply 统一 `NOT_FOUND`，不泄漏其他 Workspace 资源存在性。

#### KS-C1-FE

- [x] Graph Overview 右上角增加 `Import manifest`；不得复用文件树 Upload intent 或把 Manifest 加入文件树。
- [x] `not_indexed` 空状态明确说明自动分析尚未启用，并提供 `Import graph manifest` 主入口。
- [x] 已存在 graph 时将 Validate/Replace 入口放入 Graph actions；`Download current manifest` 延后，不阻塞本批。
- [x] 实现只接受 `.json` 的文件选择与本地大小上限；前端不自行相信或持久化解析结果。
- [x] 实现 Manifest Import 显式状态机：`idle → validating → invalid|ready-to-apply → applying → succeeded|failed|conflict`。
- [x] Preview 展示 matched/unmatched documents、summary/guide/tag/relation/issue counts 和 resulting graph status。
- [x] validation issues 使用稳定 code 映射为用户文案；存在 blocking issue 时禁用 Apply。
- [x] Apply 提交后端签发 token、checksum、expected revision 与同一 Manifest；后端重新 canonicalize/校验且三者 checksum 必须一致，不把前端候选 graph 当成权威输入。
- [x] Apply 成功后关闭面板、显示统一 toast `Graph manifest imported`，并重新加载 Detail 与 Graph Overview。
- [x] Apply conflict 显示明确的重新 Validate 操作，不复用过期 token 自动重试。
- [x] route switch/unmount abort pending validate；旧 response 不得覆盖新 KS 或较新的 manifest selection。
- [ ] dialog/drawer 支持 focus trap、Esc、返回焦点和 keyboard file selection。
- [x] 前端 repository 对 validate/apply response 做 runtime validation，不在组件内直接 `fetch()`。

#### KS-C1 Demo 数据与辅助 seed

- [ ] 在 `doc/demo-data/knowledge-spaces/coffee-guide/` 创建 6–8 篇 Markdown 与 Healthy manifest。
- [ ] 在 `doc/demo-data/knowledge-spaces/shadow-ai-review/` 创建 8–10 篇 Markdown 与 Needs Review manifest。
- [ ] Demo 文档内容可公开、简短且足以人工核对 summary、guide 和 relation。
- [ ] 实现显式 `workspace-id + case` 的 development seed command，复用同一 manifest validator/producer/apply service。
- [ ] Seed command 负责官方案例 KS/文件初始化；不得选择第一条 Workspace，不得覆盖普通用户资产。
- [ ] 支持 `--validate-only`；`--replace-demo` 只能替换同一 Demo provenance 的资产。
- [ ] 可选 `odyssey-product-map` 较大图案例延后到 Graph interaction 压力验收。

#### KS-C1 验收门

- [ ] 浏览器从空 KS 上传案例文档后，Graph 区域仍为明确 `Not indexed`。
- [ ] 浏览器导入 Healthy manifest，Preview 数量正确，Apply 后 graph status 变为 `healthy`。
- [ ] 刷新页面后 summary、guide、tags、relations、families 和 graph status 保持一致。
- [ ] 导入 Needs Review manifest 后返回真实 issues，graph status 变为 `needs_review`。
- [ ] Manifest 文件从未出现在文件树或 document count 中。
- [ ] 缺失/歧义路径、非法 relation 和 stale revision 均不留下 partial graph 或前端 ghost state。
- [ ] 重复导入同一 Manifest 不产生重复关系或 issue，且 revision 不变化。
- [ ] 其他 Workspace 无法 validate、apply 或读取该 graph。
- [ ] 完成 KS-C1 验收后才开始 Graph Canvas adapter 与 Inspector 主交互。

### KS-C-BE 其余后端

- [x] 定义并实现 graph overview read API。
- [x] 返回 documents、directed references、tags、derived family containers 和 issues。
- [x] 实现 document detail read（metadata、checksum、index state 与短期原始内容访问；KS-C 继续扩展 tags/references）。
- [ ] 实现 document metadata update：tags、summary、guide、user-reviewable references。
- [ ] 系统字段拒绝客户端修改。
- [ ] 提供显式 development seed command，目标 Workspace ID 必须明确且可重复执行。
- [ ] 不在 production 自动 seed。

### KS-C-FE 前端

- [ ] 为 Knowledge graph 建立独立 read-only domain adapter，不复用 Workflow editor nodes/edges。
- [ ] 实现 pan、zoom、fit、hover、keyboard focus 和 selection。
- [ ] 单击 graph node 打开 Document Inspector；folder file 不触发 Inspector。
- [ ] 双击/Open document 导航到 nested Document Detail route。
- [ ] 点击空白关闭 Inspector。
- [ ] Back to graph 恢复 pan、zoom 和 selection；该状态不写入 KS aggregate。
- [ ] 实现 tags、summary、guide、references 编辑和保存反馈。
- [ ] 实现 needs-review 与 issue marker；Graph Overview 已接 loading、not-indexed、empty 和 graph-error boundary states。

### KS-C 验收门

- [ ] Graph Overview、Inspector、Document Detail 与 Figma 四张主画面完成视觉校准。
- [ ] folder 与 graph selection 双向同步。
- [ ] Document Detail 修改 metadata 后返回 graph，Inspector 显示新数据。
- [ ] 系统只读字段无法通过 UI 或 API 修改。
- [ ] persisted seed 可重建且不会覆盖已有用户数据。

## 7. KS-D — 回接 Canvas 与 Knowledge Retrieval

目标：完成此前 System Tools 第二批 B 留下的真实 Knowledge Space happy path。

- [ ] Canvas 顶部 `Knowledge Spaces` 资源面板读取同一正式 inventory repository。
- [ ] 可用性规则保持：ready/syncing 且 healthy/needs-review 可选；其他可见但 disabled。
- [ ] Knowledge Space 拖入 Agent Action 只建立 UUID 引用。
- [ ] Knowledge Retrieval 配置从真实 inventory 选择 Knowledge Space。
- [ ] 已 archive/failed/deleted/referenced 的状态在保存时由后端权威校验。
- [ ] Canvas resource panel 与 Tool config panel 保持互斥替换关系。
- [ ] root、Loop child、Task ToolStep 和 Agent Reusable Tool round trip 均覆盖。
- [ ] 保存、刷新、revision conflict、cross-Workspace rejection 和 deletion protection 浏览器验收。

### KS-D 完成后回写

- [ ] 在 `system-tools-second-batch-frontend-backend-todo.md` 勾选“Knowledge Retrieval 使用真实 Knowledge Space 数据完成浏览器 happy path”。
- [ ] 更新 M6/Knowledge Space completion report。
- [ ] 重新评估 Canvas 剩余视觉校准、model inventory 和 system variable inventory 的顺序。

## 8. 明确非目标

- [ ] 不实现 Document Curator 执行。
- [ ] 不实现 Knowledge Steward 调度与执行。
- [ ] 不实现 embedding、vector search 或自动语义索引。
- [ ] 不实现实时协作、多人权限或外部云盘同步。
- [ ] 不实现富文本正文编辑器。
- [ ] 不实现 Workspace ToolTemplate。
- [ ] 不把 folder 层级解释为 Knowledge Family 或 graph edge。
- [ ] 不通过生产 mock 假装 graph/indexing 已完成。

## 9. 质量门禁

### Shared contracts

- [ ] Zod/Pydantic parity、positive/negative fixtures 全绿。
- [ ] OpenAPI 与 repository adapter 输入输出一致。

### Frontend

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] 真实浏览器 happy/empty/error/conflict/refresh 路径。
- [ ] console 无新增 warning/error。

### Backend

- [ ] `cd apps/api && uv run ruff check .`
- [ ] `cd apps/api && uv run pytest`
- [ ] PostgreSQL transaction/CAS/Workspace isolation tests。
- [ ] object-storage port/adaptor tests 和失败补偿测试。
- [ ] migration 从空库与当前基线 upgrade 验证（仅在确需 migration 时）。

### Definition of Done

- [ ] 用户可从正常 UI 创建 Knowledge Space、建立目录、上传文件、浏览 metadata 和只读 graph。
- [ ] 用户可从 Canvas 选择同一真实 Knowledge Space，并配置 Knowledge Retrieval。
- [ ] 刷新、重进页面和服务重启后数据一致。
- [ ] Workspace 隔离、revision、引用保护和错误 envelope 均成立。
- [ ] UI-only state、Vue Flow object、storage secret 和 ORM object 不进入 API contract。

## 10. 建议立即执行顺序

1. KS-A create → detail → refresh 与 mutation 管理闭环已经完成；filters/cancel/route-race 的增量自动化可随回归继续补充。
2. KS-B 真实文件工作区、staged upload、preview/edit、move/delete 已落地；继续补 failure compensation、cleanup 与浏览器回归。
3. KS-C Graph Overview 严格合同与持久化 read projection 已落地；下一步按 `KS-C1 Manifest Import` 完成合同、Validate/Apply、前端预览和两套 Demo 数据。
4. KS-C1 浏览器验收通过后，再实现独立 read-only graph adapter、节点选择与 Inspector，不复用 Workflow graph view model。
5. 最后执行 KS-D，用真实 Knowledge Space 收口 Canvas 与 Knowledge Retrieval。

任何阶段若发现合同缺口，先修改共享合同、Pydantic/Zod 和 fixtures，再继续 UI/API；不得通过宽松字典、组件本地 mock 或额外保存通道绕过。
