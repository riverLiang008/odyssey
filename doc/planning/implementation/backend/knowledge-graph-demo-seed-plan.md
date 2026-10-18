# Knowledge Space Demo Graph：确定性 Seed 方案

> 状态：Draft / 待评审
> 日期：2026-10-16
> 适用范围：Knowledge Space V1 / KS-C
> 相关文档：
> - [`knowledge-space-frontend-backend-todo.md`](../knowledge-space-frontend-backend-todo.md)
> - [`knowledge-space-specification.md`](../../../product/feature-specifications/knowledge-space/knowledge-space-specification.md)

## 1. 背景

Knowledge Space 的文档关系最终应由自然语言分析产生。理想情况下，Document Curator 或 Knowledge Steward 会读取文档内容，通过 LLM 或其他语义模型生成：

- 文档摘要与阅读指南；
- Knowledge Tags；
- 文档间的有向关系；
- Knowledge Families；
- 需要人工检查的 Graph Issues；
- Graph status 与索引时间。

当前阶段没有可持续使用的模型 API，且产品目标不是验证语义算法质量，而是验证完整的 Knowledge Space 产品交互。因此本阶段不实现真正的自动语义分析，也不在前端硬编码图数据。

本方案使用一套明确标记为 development/demo 的确定性 Manifest Import pipeline：用户先通过正常 UI 上传文档，再从 Graph Overview 导入 reviewed `manifest.json`。后端校验 manifest 与当前文件树的对应关系，并通过正式持久化模型写入 summary、guide、tags、relations 和 issues，最后由正式 Graph API 和前端读取。

命令行 seed 仍然保留，但降级为官方 Demo 案例初始化与自动化测试工具，不再是 Demo 的主要用户入口。

## 2. 决策摘要

本阶段采用以下方案：

```text
User uploads documents through the normal UI
        ↓
Graph Overview: Import reviewed manifest.json
        ↓
Validate / preview changes
        ↓
Apply with expectedRevision
        ↓
PostgreSQL graph projection
        ↓
Production Graph Overview API
        ↓
Read-only Graph UI / Inspector / Document Detail

Official demo catalog ── development seed command ──┘
```

关键决策：

1. Demo graph 必须真实持久化，前端不得包含案例专用 mock。
2. Manifest Import 是 Demo 版本的显式用户能力；必须诚实说明自动分析尚未启用。
3. Manifest 是 graph annotations 的导入合同，不是 Knowledge Document，也不是 Knowledge Space 的第二份 source of truth。
4. Manifest 文件不进入文件树、不创建 Knowledge Resource，也不参与后续图谱节点展示。
5. 导入使用 validate/preview 与 apply 两阶段流程；校验不得产生持久化副作用。
6. Apply 必须携带 `expectedRevision`；校验后文件树发生变化时必须拒绝旧预览。
7. 导入必须幂等；重复应用同一 manifest 不得产生重复 tag、relation 或 issue。
8. Seed command 必须显式接收 `workspace-id`，不得自动选择数据库第一条 Workspace。
9. Seed 默认不得覆盖普通用户创建的 Knowledge Space，production 启动流程不得自动执行 seed。
10. Graph API、数据库模型和前端不感知数据由人工 manifest、未来 LLM 或其他算法生成。
11. 后续接入 LLM 时只替换 Graph Producer，不修改稳定的 persistence/read contract。

## 3. 目标与非目标

### 3.1 目标

- 为 Graph Overview、Document Inspector、Document Detail 提供足够真实的演示数据。
- 让用户通过正常 UI 完成“上传文档 → 导入分析结果 → 查看图谱”的完整体验。
- 覆盖 Healthy、Needs Review 和较大图三类关键状态。
- 验证正式的数据链路、Workspace 隔离、刷新持久性和错误状态。
- 让 Demo 可在不同开发环境中重复重建。
- 为未来的 LLM Graph Producer 冻结清晰的输出边界。

### 3.2 非目标

- 不声称已经实现自动语义索引。
- 不评估或模拟 LLM 的准确率。
- 不实现 embedding、vector search、RAG 或模型调用。
- 不通过关键词匹配伪装生产级语义关系发现。
- 不在 production 自动创建 Demo 数据。
- 不把 manifest 当作普通 Knowledge Document 上传；它只通过 Graph Overview 的专用导入入口提交。
- 不将文件夹层级解释为 Knowledge Family 或 graph edge。

## 4. Demo 案例设计

建议先交付两套核心案例，第三套作为图交互与性能验收案例。

### 4.1 `coffee-guide`：Healthy Graph

用途：验证正常图谱、Knowledge Families、方向关系和 Inspector。

建议内容：

- 6–8 篇短 Markdown 文档；
- 3 个低饱和度 Family/Tag；
- 8–12 条关系；
- 无 open warning/error issue；
- `graphStatus = healthy`。

示例文档：

- `foundations/coffee-bean-basics.md`
- `foundations/roast-levels.md`
- `brewing/pour-over.md`
- `brewing/espresso-extraction.md`
- `troubleshooting/sour-espresso.md`
- `troubleshooting/bitter-espresso.md`

应覆盖的关系类型：`explains`、`builds_on`、`supports`、`references`、`related_to`。

### 4.2 `shadow-ai-review`：Needs Review Graph

用途：验证 issue marker、待确认关系、孤立文档和冲突提示。

建议内容：

- 8–10 篇 Markdown 文档；
- 3–4 个 Family/Tag；
- 至少一条 `needs_review` relation；
- 两个 `unlinked_document` issue；
- 一个 `possible_conflict` issue；
- `graphStatus = needs_review`。

该案例应与产品规范中的 Shadow AI Thesis 示例保持一致，但内容可以是短小、可公开的演示文本。

### 4.3 `odyssey-product-map`：Larger Graph

用途：验证 fit、pan、zoom、标签截断、节点密度和 Inspector 避让。

建议内容：

- 15–20 篇短 Markdown 文档；
- 4–6 个 Family/Tag；
- 20–35 条关系；
- 少量 warning issue；
- 不追求复杂自然语言内容，重点是图结构与交互压力。

该案例不阻塞首轮 Graph UI 开发，可在 Healthy 与 Needs Review 通过验收后补充。

## 5. 文件组织

建议将 Demo source 放在后端包外、文档库中的显式开发目录：

```text
doc/demo-data/knowledge-spaces/
├─ coffee-guide/
│  ├─ graph-manifest.json
│  └─ documents/
│     ├─ foundations/
│     ├─ brewing/
│     └─ troubleshooting/
├─ shadow-ai-review/
│  ├─ graph-manifest.json
│  └─ documents/
└─ odyssey-product-map/
   ├─ graph-manifest.json
   └─ documents/
```

原因：

- Demo 内容属于可审阅的产品资产，不应隐藏在 Python fixture 中；
- 文档和 manifest 可以一起进行代码评审；
- seed implementation 只负责解析和持久化，不内嵌具体案例内容；
- 将来可以替换或新增案例，而不修改生产代码。

## 6. Manifest V1 合同

Manifest 使用稳定的 case-local key 表达引用，运行时再映射为 UUID。它不得依赖显示名称、数组下标或数据库现有 ID。

建议结构：

```json
{
  "schemaVersion": 1,
  "key": "coffee-guide",
  "knowledgeSpace": {
    "name": "Coffee Knowledge Guide",
    "description": "A practical guide to coffee brewing and troubleshooting.",
    "categoryName": "Demo"
  },
  "documents": [
    {
      "key": "coffee-bean-basics",
      "path": "foundations/coffee-bean-basics.md",
      "summary": "Introduces origin, processing and bean characteristics.",
      "guide": "Read before choosing roast and brewing parameters.",
      "tags": ["Coffee Foundations"],
      "status": "indexed"
    }
  ],
  "tags": [
    {
      "key": "coffee-foundations",
      "name": "Coffee Foundations",
      "colorToken": "knowledge-family-blue"
    }
  ],
  "relations": [
    {
      "key": "espresso-builds-on-beans",
      "source": "espresso-extraction",
      "target": "coffee-bean-basics",
      "kind": "builds_on",
      "status": "active",
      "confidence": 0.94,
      "description": "Extraction choices depend on bean and roast characteristics."
    }
  ],
  "issues": [
    {
      "key": "conflicting-security-guidance",
      "kind": "possible_conflict",
      "severity": "warning",
      "title": "Two documents recommend different controls",
      "message": "Review which recommendation applies to the current policy.",
      "resourceKeys": ["policy-a", "policy-b"],
      "relationKeys": [],
      "resolutionStatus": "open"
    }
  ],
  "graph": {
    "status": "healthy",
    "generatedAt": "2026-10-16T00:00:00Z"
  }
}
```

### 6.1 必填约束

- `schemaVersion` 必须为当前支持的版本。
- `key` 在 Demo catalog 内唯一，使用稳定 `kebab-case`。
- 每个 document `key` 唯一。
- document `path` 必须位于当前案例的 `documents/` 内，禁止绝对路径和 `..` 路径逃逸。
- manifest 中引用的 document/tag/relation key 必须存在。
- relation source 与 target 不得相同。
- V1 relation 必须位于同一 Knowledge Space。
- `confidence` 若存在，必须位于 `[0, 1]`。
- `healthy` 不得包含 open warning/error issue。
- `needs_review` 至少包含一个 open warning issue或待确认 relation。
- `not_indexed` 不得携带 nodes、relations、families 或 issues；Demo catalog 默认不使用该状态。
- 所有外部字段必须 strict，拒绝未知字段。

### 6.2 Knowledge Family 语义

V1 不在 manifest 中创建独立 Family aggregate。Family 由 tag membership 派生：

- tag 是持久化 source；
- Graph Overview API 将 tag 投影为 Family container；
- 同一文档可以拥有多个 tag；
- UI 布局阶段可以选择 primary family，但不得将该布局选择写回业务 source of truth。

如果后续产品决定 Family 与 Tag 不是同一语义，再通过明确 migration 和 contract version 演进，不在本批提前建立双重事实源。

## 7. 前端 Manifest Import 交互

### 7.1 入口与空状态

Graph Overview 右上角提供专用入口：

```text
KNOWLEDGE GRAPH                              [Import manifest]
```

当 `graphStatus = not_indexed` 时，空状态显示：

```text
This Knowledge Space is not indexed yet.
Automatic analysis is not enabled. Import a reviewed manifest to build this graph.

[Import graph manifest]
```

当图已经存在时，入口收纳至 Graph actions：

```text
Graph actions
├─ Validate new manifest
├─ Replace imported graph
└─ Download current manifest（可延后）
```

`Import manifest` 不得复用文件树的 Upload。前者修改 graph annotations，后者创建 Knowledge Resource，两者是不同 typed intent 和后端 use case。

### 7.2 Validate / Preview

用户选择 `.json` 后，前端提交 manifest 原文与当前 `expectedRevision` 进行只读校验。成功后展示预览摘要：

- 匹配到的文档数量；
- 将更新的 summary/guide 数量；
- 将创建或更新的 tags、relations 和 issues 数量；
- manifest 未覆盖的现有文档数量；
- 不存在、重复或匹配歧义的路径；
- graph status 的预期结果；
- 是否会替换已有的 manifest-managed projection。

只要存在 missing/ambiguous document、非法引用、路径逃逸或合同错误，Apply 必须禁用。校验失败不得产生任何数据库或对象存储写入。

### 7.3 Apply

用户确认后执行 Apply：

1. 前端提交经后端签发的短期 `validationToken`、manifest checksum 和 `expectedRevision`。
2. 后端重新确认 token、Workspace、Knowledge Space、revision 和 checksum。
3. 后端在一个数据库事务内更新 document annotations、tags、relations、issues 和 graph status。
4. Knowledge Space revision 恰好递增一次。
5. 前端丢弃旧 graph projection，重新请求正式 Graph Overview API。
6. 成功提示使用统一 toast，例如 `Graph manifest imported`。

不得让前端把校验后的解析对象原样回传作为权威输入；Apply 需要使用后端验证过的 payload identity，或由后端依据 checksum 重新验证原始 manifest。

### 7.4 文档路径匹配

Manifest 通过 Knowledge Space root-relative canonical path 匹配文档：

```text
research/problem.md
policies/security/controls.md
```

规则：

- 不使用数据库 UUID，以便 manifest 可复制和版本管理；
- 不允许只用 basename 匹配，因为不同文件夹可以存在同名文件；
- separator 统一规范化为 `/`；
- 拒绝绝对路径、空路径、`.`、`..` 和路径逃逸；
- V1 建议使用大小写敏感的 canonical match，并在 Windows 开发环境中同样保持该语义；
- 同一个 canonical path 必须唯一对应一个当前 Knowledge Resource；
- Manifest 不得创建、重命名、移动或删除文档。

### 7.5 可写与只读字段

Manifest 可以更新：

- document summary；
- document guide；
- tags；
- relations；
- graph issues；
- 由上述数据派生的 graph status。

Manifest 不得更新：

- Knowledge Space 或文件夹 identity；
- 文件名、文件夹位置或正文；
- MIME、size、checksum 和 object key；
- created/updated/indexed timestamp；
- Workspace ownership；
- 用户手动维护且 provenance 不属于当前 manifest 的 annotations。

## 8. Import API 草案

建议使用两个明确 use case，而不是通用 JSON upload endpoint。

### 8.1 Validate

```text
POST /api/v1/knowledge-spaces/{knowledgeSpaceId}/graph-manifest/validate
```

Request：

```json
{
  "expectedRevision": 7,
  "manifest": {}
}
```

Response：

```json
{
  "validationToken": "opaque-short-lived-token",
  "manifestChecksum": "sha256-hex",
  "knowledgeSpaceRevision": 7,
  "status": "valid",
  "matchedDocumentCount": 8,
  "unmatchedDocumentCount": 1,
  "summaryUpdateCount": 8,
  "guideUpdateCount": 6,
  "tagCount": 4,
  "relationCount": 12,
  "issueCount": 3,
  "resultingGraphStatus": "needs_review",
  "issues": []
}
```

### 8.2 Apply

```text
POST /api/v1/knowledge-spaces/{knowledgeSpaceId}/graph-manifest/apply
```

Request：

```json
{
  "expectedRevision": 7,
  "validationToken": "opaque-short-lived-token",
  "manifestChecksum": "sha256-hex",
  "manifest": {}
}
```

Response 返回新的 Knowledge Space revision 与 Graph Overview projection，或只返回 revision 后由前端重新读取 Graph API。建议返回 mutation result + revision，前端始终重新读取 graph，避免出现第二套前端事实源。

Token 必须绑定：

- Current Workspace ID；
- Knowledge Space ID；
- expected revision；
- manifest checksum；
- 短期过期时间。

Apply 必须重新提交同一份 Manifest。后端重新执行 canonical parsing 与完整候选校验，并要求 canonical checksum 与 request checksum、validation token 三者完全一致。这样 Validate 保持零持久化副作用，token 不需要携带 Manifest，服务也不依赖单进程内存缓存或额外 Redis 状态。

首版也可以不保存 token state，而使用服务端签名 opaque token；但 token 中不得包含完整 manifest 或敏感正文。

## 9. Seed 命令（辅助入口）

建议命令形式：

```text
uv run python -m odyssey_api.knowledge.demo_seed \
  --workspace-id <uuid> \
  --case coffee-guide
```

可选参数：

```text
--knowledge-space-id <uuid>   仅允许更新由同一 Demo case 创建的资产
--validate-only               只验证 manifest 和本地文件，不写数据库/对象存储
--replace-demo                以事务化策略替换同一 case 的既有 Demo projection
```

命令行 seed 与 UI Import 必须共享同一 manifest parser、domain validator 和 apply service。它只额外负责创建官方 Demo KS、上传案例 documents，再调用相同 graph import 用例。

不提供以下行为：

- 自动选择 Workspace；
- 按名称覆盖任意普通 Knowledge Space；
- production startup 自动执行；
- `--force` 绕过 ownership 或 validation；
- 接受远程 URL 作为 manifest/document source。

## 10. 幂等、替换与身份策略

### 10.1 Provenance

Manifest 管理的 annotations 必须保存 provenance，以便区分 `manifest`、未来的 `llm` 与用户手动维护的数据。Seed 创建的 Knowledge Space 还需要额外保存 Demo provenance。若现有 schema 暂无合适字段，应先评审专用列/表或受验证 metadata 方案；不得仅凭显示名称判断来源。

已冻结的持久化决策：不把 provenance 塞入无约束的通用 metadata。新增专用 Manifest Import 记录保存 Knowledge Space、manifest key、checksum、应用时 revision 与时间；可被 Manifest 替换的 annotation 使用受约束的 `source`（`user | manifest | llm | seed`）与 nullable `source_key`。document summary/guide、tag membership、relation、issue 都必须能独立判断归属。下一批以最小 migration 落地这些字段与约束；替换操作只按 `source = manifest` 且属于上一份已应用 Manifest 的记录删除或更新。

最低需要记录：

- `demoCaseKey`；
- `manifestSchemaVersion`；
- `manifestChecksum`；
- `seededAt`；
- seed implementation version。

Graph annotation 最低需要记录：

- `source = manifest`；
- manifest checksum；
- manifest document/relation/issue key；
- imported timestamp；
- 可选的 importer version。

若现有 Knowledge Space 表不能安全承载 provenance，应先评审是否需要小型 migration。不得将该信息混入前端展示字段。

### 10.2 稳定 ID

推荐使用 namespace UUID + stable key 生成确定性 UUID：

```text
UUIDv5(namespace = Odyssey Demo Graph, name = workspaceId/caseKey/entityKind/entityKey)
```

这样可以保证：

- 重复执行得到相同 identity；
- manifest 内引用可以稳定映射；
- 不依赖数据库数组顺序或显示名称；
- 不会在不同 Workspace 间意外复用 identity。

### 10.3 重复导入与替换

UI Import 默认行为：

1. 首次 Apply 创建 manifest-managed annotations。
2. 重复应用同一 checksum 返回 `already_up_to_date`，不消耗 revision。
3. 新 manifest 默认完整替换上一份 manifest-managed projection。
4. 替换不得删除或覆盖 provenance 属于 `user` 的 annotations。
5. 当前 revision 与 Validate 时不一致则返回 `REVISION_CONFLICT`，要求重新 Validate。
6. 同一 document、relation 或 issue 的稳定 manifest key 应尽量保持 identity。

Seed command 额外遵守：

1. 若目标 case 尚不存在，创建完整 Demo Knowledge Space。
2. 若同一 Workspace、同一 case、同一 manifest checksum 已存在，返回 `already_up_to_date`，不写入。
3. 若同一 case 已存在但 checksum 不同，默认返回冲突并提示使用 `--replace-demo`。
4. `--replace-demo` 只能更新同一 provenance 的 Demo asset，不得覆盖普通用户资产。
5. 更新成功后 revision 恰好递增一次；失败不得留下部分关系或半更新状态。

## 11. 持久化流程与事务边界

对象存储属于外部 I/O，不能与数据库事务假装成同一原子操作。建议采用 staged 流程：

```text
UI Import：

1. Parse strict manifest
2. Resolve Current Workspace、KS revision 与 canonical document paths
3. Validate the complete candidate graph without mutation
4. Return preview and validation token
5. Apply revalidates token/checksum/revision
6. Open one database transaction
7. Update summaries/guides and replace manifest-managed tags/relations/issues
8. Derive graph status/counts/timestamps
9. Commit once and return the new revision

Seed command 在此之前额外执行文档文件校验、checksum 和 staged object upload；失败时执行对象清理。
```

必须保持：

- Service/command 拥有事务；repository 不 commit。
- 所有数据库查询带 Workspace scope。
- 外部对象上传不占用数据库事务。
- 数据库失败时清理 staged object。
- 重试不能产生重复 active artifact。
- response/runtime validation 失败必须可诊断，不能静默留下不可识别状态。

## 12. Graph Producer 边界

为了将来平滑接入 LLM，定义内部 producer port：

```text
GraphProducerInput
  knowledgeSpaceId
  documents[]: id, name, mimeType, extractedText/checksum

GraphProducerOutput
  documentAnnotations[]: resourceId, summary, guide, tags
  relations[]: sourceResourceId, targetResourceId, kind, confidence, description
  issues[]: kind, severity, affectedResourceIds, affectedRelationIds
  generatedAt
  producerMetadata
```

本阶段的 `ManifestGraphProducer` 同时服务 UI Import 与 seed command，从 reviewed manifest 产生上述输出。未来可以新增：

- `LlmGraphProducer`；
- `LocalModelGraphProducer`；
- `HeuristicCandidateProducer`。

所有 producer 必须经过同一 domain validation 和 persistence service。Producer 不能直接写数据库，也不能决定 Workspace ownership、revision 或 HTTP error。

### 12.1 可选离线实验

可以单独提供不进入生产主链路的候选关系实验脚本：

- Markdown 显式链接；
- 标题和关键词重合；
- TF-IDF/cosine similarity；
- 文件中明确的 `See also`/`References` 段落。

该脚本只能输出候选 manifest，必须经过人工 review 后才能用于 Demo seed。它不得自动把低质量启发式结果标记为已验证 graph。

## 13. 安全与环境限制

- 命令行 seed 必须只在 development/test 环境可运行；production fail closed。
- UI Manifest Import 在 Demo build/feature flag 下开放；若未来成为正式高级功能，应单独完成权限、审计和产品评审。
- 必须显式传入 Workspace UUID。
- 不打印完整文档正文、对象存储签名 URL 或 credentials。
- 日志只记录 case key、Workspace/KS/resource IDs、checksum、操作阶段和稳定错误码。
- 路径读取必须限制在所选 Demo case 目录内。
- cross-Workspace existing IDs 统一视为不可见，不泄漏存在性。
- Manifest 视为不可信输入，解析后才能进入 domain。

## 14. 错误模型

建议 seed command 使用稳定错误码并转换为非零退出状态：

| 错误码 | 含义 |
| --- | --- |
| `DEMO_CASE_NOT_FOUND` | case key 不存在 |
| `MANIFEST_INVALID` | strict schema 或跨引用验证失败 |
| `DOCUMENT_FILE_NOT_FOUND` | manifest 引用文件不存在 |
| `DOCUMENT_PATH_INVALID` | 文件路径逃逸或不允许 |
| `DOCUMENT_PATH_AMBIGUOUS` | canonical path 对应多个资源 |
| `MANIFEST_TOKEN_INVALID` | validation token 无效、过期或绑定不匹配 |
| `WORKSPACE_NOT_FOUND` | 目标 Workspace 不可见 |
| `DEMO_PROVENANCE_CONFLICT` | 目标资产不是同一 Demo provenance |
| `DEMO_OUT_OF_DATE` | manifest 已变化但未显式允许替换 |
| `OBJECT_UPLOAD_FAILED` | staged upload 失败 |
| `PERSISTENCE_FAILED` | 数据库写入失败并已回滚 |
| `CLEANUP_INCOMPLETE` | 主操作失败后的对象清理未完全成功 |

错误展示可以包含资源 key 和 validation path，但不得输出敏感正文或 secret。

## 15. 测试计划

### 15.1 Contract tests

- valid Healthy / Needs Review manifest；
- unknown field rejection；
- duplicate keys；
- missing cross-reference；
- invalid relation kind/confidence；
- graph status 与 issue 不一致；
- path traversal rejection。
- unknown/missing/ambiguous canonical document path；
- Validate 无持久化副作用；
- token 与 Workspace/KS/revision/checksum 绑定。

### 15.2 Domain tests

- stable key → deterministic UUID；
- 同一 manifest 重复执行 identity 不变；
- Family 由 tag membership 派生；
- graph status derivation；
- candidate state 在写入前完整验证。
- replacement 仅删除 manifest-managed annotations；
- user-managed annotations 保持不变。

### 15.3 PostgreSQL / storage integration tests

- 首次 seed 创建完整持久化数据；
- 重复 seed 返回 `already_up_to_date`；
- manifest 变化且未 replace 时不修改数据；
- replace 成功一次 commit、revision 恰好增加一次；
- cross-Workspace 不可见；
- object upload 成功但 DB 失败时执行补偿；
- storage failure 时 DB 无 partial rows；
- Graph Overview API 返回 seed 的 nodes/edges/families/issues；
- Validate 后 revision 改变，Apply 返回 conflict 且不部分写入；
- 重复 Apply 同一 checksum 不消耗 revision；
- 服务重启后数据仍存在。

### 15.4 前端/browser acceptance

- Healthy case 正确显示 families、edges 和无 issue 状态；
- Needs Review case 显示 issue marker 和 review summary；
- 单击 graph node 打开 Inspector；
- 双击/Open document 进入 Document Detail；
- 刷新保持相同 graph；
- folder selection 和 graph selection 使用同一 document UUID；
- Demo 数据不出现在其他 Workspace。
- Manifest 文件不出现在文件树中；
- invalid preview 禁用 Apply，且刷新后数据库状态不变。

## 16. 实施批次

### Batch 1：合同与 UI Validate/Apply 最小闭环

- [ ] 冻结 manifest V1 的 Zod/Pydantic/internal model。
- [ ] 建立 Demo catalog 和路径安全校验。
- [ ] 创建 `coffee-guide` 文档与 manifest。
- [ ] 实现 Graph Overview 的 Import manifest 入口与预览面板。
- [ ] 实现 validate/apply API、expectedRevision 和 canonical path resolution。
- [ ] 实现 manifest provenance、确定性 UUID 和幂等 Apply。
- [ ] 通过正式 Graph API 验证持久化结果。

### Batch 2：替换语义、Needs Review 与辅助 seed

- [ ] 冻结 provenance 持久化方式。
- [ ] 实现 checksum、`already_up_to_date` 和 manifest-managed replacement。
- [ ] 创建 `shadow-ai-review` 案例。
- [ ] 持久化 issues 和 issue-resource/relation mapping。
- [ ] 实现显式 Workspace 的官方 Demo seed command，并复用 Import service。
- [ ] 实现 `--validate-only` 和 `--replace-demo`。
- [ ] 覆盖失败补偿、Workspace 隔离和 revision 测试。

### Batch 3：Graph UI 验收数据

- [ ] 创建 `odyssey-product-map` 较大图案例。
- [ ] 完成 Graph adapter、Inspector 和 Detail 导航验收。
- [ ] 调整案例内容与布局压力，但不在前端加入 case-specific 分支。

## 17. Review 决策点

实施前需要确认以下决策：

1. 是否确认 UI Manifest Import 为 Demo 的主要入口，命令行 seed 为辅助工具。
2. UI Import 是否仅在 Demo/development feature flag 下开放。
3. 首批是否只做 `coffee-guide` 与 `shadow-ai-review`。
4. Family V1 是否确认继续由 tag membership 派生。
5. Manifest/annotation provenance 使用现有 metadata 能否满足需求，还是增加专用列/表。
6. 是否接受 UUIDv5 作为 manifest-managed entity 的稳定 identity。
7. 新 manifest 是否默认完整替换上一份 manifest-managed projection，同时保留 user-managed annotations。
8. `generatedAt` 由后端 Apply 时间产生，还是接受 manifest 声明时间；建议正式 UI Import 使用后端时间，固定 seed fixture 可使用显式 clock 以保证测试稳定。
9. `Download current manifest` 是否进入本批；建议延后，不阻塞导入闭环。

## 18. 推荐结论

建议批准以下最小实现：

- 用户先通过正常 UI 上传文档，再通过 Graph Overview 专用入口导入 strict manifest；
- Validate/Preview 与 Apply 分离，并使用 revision/checksum/token 防止过期应用；
- 首批制作 Healthy 与 Needs Review 两套案例；
- Manifest 以 root-relative canonical path 匹配真实文档，不依赖数据库 UUID；
- 使用 UUIDv5、manifest checksum 和 provenance 实现幂等替换；
- 真实写入 PostgreSQL 与对象存储；
- 前端只使用正式 Graph API；
- Manifest producer 与未来 LLM producer 共享同一 validated output/persistence boundary；
- 命令行 seed 仅作为官方案例初始化和自动化测试入口，并复用同一 service；
- 不实现或暗示已经实现生产级自然语言分析。

这样既可以完成可信的 Demo 和完整交互验收，也不会制造未来必须推翻的 mock 数据通道。
