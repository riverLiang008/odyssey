# Odyssey V1 Object Storage / OSS Design

> 状态：V1 Implementation Baseline 的配套存储设计  
> 适用实现：开发环境 MinIO；生产环境可使用 S3、阿里云 OSS 或兼容对象存储  
> 关联文档：`doc/architecture/data/database/reviews/v1-database-design-review-draft.md`

## 1. 目标与原则

Odyssey 使用 PostgreSQL 保存需要查询、约束、事务和并发控制的 metadata；使用 Object Storage 保存体积较大、按对象整体读取的内容。

1. PostgreSQL 是业务身份、文件树、状态、引用关系和对象索引的事实来源。
2. OSS 是二进制和大型派生内容的事实来源，不承担业务查询、权限或关系约束。
3. 数据库不保存永久公开 URL，只保存 provider、bucket、object key 等稳定 locator。
4. 下载必须先经过后端授权，再返回短期 presigned URL 或由后端代理流式传输。
5. Object key 不可预测、不可复用，不使用原始文件名或用户输入直接拼接。
6. PostgreSQL 与 OSS 不能共享事务；上传使用 staged lifecycle，删除使用 transactional outbox，定期 reconciliation 修复孤儿。
7. Journey、Workflow、Canvas、Template 等小型结构化 JSON 留在 PostgreSQL。

## 2. 存储边界

| 内容 | PostgreSQL | OSS |
| --- | --- | --- |
| Journey、PatternConfig | metadata + JSONB | 不存 |
| WorkflowGraph、CanvasLayout | revision + JSONB | 不存 |
| Variables、Reusable Tools | 完整关系数据/JSONB config | 不存 |
| Template Snapshot | metadata + JSONB snapshot | 不存；超大模板未来另评估 |
| KS、Folder、Resource | 业务 metadata、状态、树关系 | 不存 |
| Tag、Relation、Graph Issue | 完整关系数据 | 不存 |
| 用户上传原文件 | Artifact 索引 | 实际对象 |
| 提取全文、OCR、预览、缩略图 | Artifact 索引 | 实际对象 |
| 摘要、Guide | PostgreSQL TEXT | V1 不存 OSS |
| Embedding/向量 | V1 不实现 | 未来 Vector DB/专用存储 |
| Journey/Template export ZIP | V1 默认即时生成/流式返回 | 未来异步导出时作为有 TTL 的临时对象 |

## 3. 领域模型

```text
KnowledgeResource                 业务文件/图节点
└─ KnowledgeResourceArtifact      OSS 对象索引
   ├─ original                    原始上传文件
   ├─ extracted_text              提取后的全文
   ├─ preview                     文档预览
   ├─ thumbnail                   缩略图
   └─ ocr_result                  OCR 结果
```

一个 Resource 可以拥有多种 Artifact。V1 每种 `artifact_kind` 最多一个 active Artifact；替换时新 Artifact 先完成校验，再原子切换 active，旧对象进入删除 outbox。

### 3.1 `knowledge_resource`

Resource 表达用户看到的文件和图节点，不直接保存 OSS locator：

```text
id
knowledge_space_id
folder_id
name
resource_type
status
summary
guide
mime_type                 # current original 的查询缓存
size_bytes                # current original 的查询缓存
checksum                  # current original 的查询缓存
last_indexed_at
metadata
created_at
updated_at
```

`mime_type`、`size_bytes`、`checksum` 只能由 Artifact 激活事务同步更新，普通 Resource metadata API 不得直接修改。

### 3.2 `knowledge_resource_artifact`

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `id` | UUID | PK |
| `knowledge_resource_id` | UUID | FK → `knowledge_resource.id`, NOT NULL, ON DELETE CASCADE |
| `artifact_kind` | VARCHAR(32) | `original`, `extracted_text`, `preview`, `thumbnail`, `ocr_result`，CHECK |
| `status` | VARCHAR(16) | `staging`, `active`, `failed`, `superseded`，CHECK |
| `storage_provider` | VARCHAR(32) | `minio`, `s3`, `aliyun_oss`，CHECK |
| `storage_bucket` | VARCHAR(255) | NOT NULL |
| `object_key` | TEXT | NOT NULL |
| `storage_version_id` | TEXT | NULL；启用 bucket versioning 时记录 |
| `declared_content_type` | VARCHAR(255) | NOT NULL；客户端声明值，不作为可信最终类型 |
| `declared_size_bytes` | BIGINT | NOT NULL，CHECK >= 0 |
| `upload_expires_at` | TIMESTAMPTZ | staging 时 NOT NULL |
| `content_type` | VARCHAR(255) | staging 时可空；active 时为服务端验证后的可信类型 |
| `size_bytes` | BIGINT | staging 时可空；active 时 NOT NULL 且 >= 0 |
| `checksum_algorithm` | VARCHAR(16) | V1 固定 `sha256` |
| `checksum` | BYTEA | staging 时可空；active 时固定 32 bytes |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `activated_at` | TIMESTAMPTZ | NULL；active/superseded 时曾被激活 |
| `failed_at` | TIMESTAMPTZ | NULL；failed 时非 NULL |
| `failure_reason` | TEXT | NULL |

约束和索引：

- `UNIQUE(storage_provider, storage_bucket, object_key)`；object key 永不复用。
- Partial unique：`UNIQUE(knowledge_resource_id, artifact_kind) WHERE status = 'active'`。
- Index `(knowledge_resource_id, artifact_kind, status)`。
- `status = staging => activated_at IS NULL AND failed_at IS NULL AND upload_expires_at IS NOT NULL`。
- `status = active => activated_at IS NOT NULL AND failed_at IS NULL AND content_type/size_bytes/checksum 完整`。
- `status = superseded => activated_at IS NOT NULL AND failed_at IS NULL`。
- `status = failed => failed_at IS NOT NULL AND activated_at IS NULL`；曾 active 的 Artifact 不能改为 failed，而应 supersede，并通过 Resource/Issue 表达对象异常。
- Artifact locator 和校验字段创建后不可变；失败重试创建新 Artifact/object key。

## 4. Object Key 与 Bucket

推荐 object key：

```text
workspaces/<workspace-uuid>/knowledge-spaces/<ks-uuid>/resources/<resource-uuid>/artifacts/<artifact-uuid>
```

- 原始文件名只保存在 Resource metadata。
- Key 不包含邮箱、用户名、文件名或其他敏感信息。
- 路径段仅来自服务端 UUID 和固定字面量。
- Bucket 默认 private，禁止 anonymous/public-read。
- 开发环境可以使用单一 MinIO bucket；生产 bucket 由部署配置决定。
- V1 不提供用户选择 provider 的 UI。
- 启用 bucket versioning 时删除必须携带 `storage_version_id`。

## 5. 上传流程

### 5.1 创建上传

1. 客户端提交文件名、声明 MIME type 和大小。
2. 服务端校验权限、允许类型和单文件大小。V1 不实施 Workspace 总容量 quota。
3. 数据库事务创建 `knowledge_resource(status = pending)` 和 `knowledge_resource_artifact(status = staging)`，保存 declared content type、declared size 和 upload expiration。
4. 服务端生成不可复用 object key 和短期 presigned upload URL。
5. 客户端直接上传，长期 OSS credential 不暴露给客户端。

### 5.2 完成上传

1. 客户端只提交 Artifact ID，不提交可信 locator、size 或 checksum。
2. 后端通过 OSS HEAD/metadata 验证对象存在、大小和 content type。
3. 后端流式计算或校验 SHA-256；ETag 不作为跨 provider 内容哈希。
4. 将可信 HEAD/检测结果与声明值、单文件上限、MIME/magic-byte 规则重新比较；最终 `content_type` 不直接复制客户端声明。
5. 数据库事务把 Artifact 切换为 active，同步 Resource MIME/size/checksum 缓存和 status，并递增所属 Knowledge Space revision。
6. 上传完成后才允许 Resource 进入后续解析或 graph CRUD。

Complete 必须幂等：已 active 的同一 Artifact 再次调用返回当前结果；对象不存在或 locator 不匹配时拒绝。

### 5.3 失败与遗留 staging

- 客户端取消、验证失败或超过 `upload_expires_at` 时，把 staging Artifact 标记为 failed，并写 deletion outbox。
- 首次 original 上传失败，且 Resource 没有其他 active original：保留 Resource 供 UI 展示失败原因并重试，将 Resource status 改为 failed，清空不可信的 original 查询缓存，递增 KS revision。
- 替换已有 Resource 的新 staging 失败：保留旧 active original、Resource 查询缓存和原有 document status，只把新 Artifact 标记为 failed。
- Retry 始终创建新的 staging Artifact 和 object key；不得把 failed Artifact 重新改回 staging。
- 定时 reconciliation 按 `upload_expires_at` 查找超时 staging，并执行相同的首次/替换失败分支。
- OSS 中存在但数据库没有 Artifact 的对象属于 orphan object，经过宽限期后删除。

### 5.4 Complete/Replace 并发协议

Complete/Replace 必须在一个数据库事务中串行化同一 Resource 的激活：

1. `SELECT knowledge_resource ... FOR UPDATE`。
2. 重新加载该 Resource、目标 `artifact_kind` 的 active Artifact 和目标 staging Artifact。
3. 验证目标 Artifact 仍属于该 Resource、仍为 staging、未过期，并已通过 OSS/内容校验。
4. 若目标已经 active，作为幂等 complete 返回当前结果；若已 failed/superseded，返回稳定业务错误，不暴露 unique violation。
5. 先将旧 active 改为 superseded，再将目标 staging 改为 active。
6. `original` 激活时同步 Resource 的可信 MIME/size/checksum 和 document status。
7. 为旧对象以及依赖旧 original checksum 的派生 Artifacts 创建 deletion outbox，并将派生 Artifacts supersede。
8. 递增 KS revision并提交。

并发 complete 在获得 Resource 行锁后必须重新判断全部状态。Partial unique index 是最后一道完整性保护，不是正常并发控制或 API 错误处理机制。

## 6. 下载与预览

1. 加载 Artifact → Resource → Knowledge Space → Workspace ownership。
2. 只允许读取 active Artifact。
3. 返回短期、限定 method/object 的 presigned URL，或由 API 流式代理。
4. 前端不得把 presigned URL 持久化到 Journey、Template 或 Resource JSON。

Presigned URL TTL 是部署配置，建议默认 5 分钟。

## 7. 替换与派生 Artifact

- 替换原文件不覆盖旧 object key。
- 新对象走 staging → validate → active。
- 激活新 Artifact 与将旧 active 改为 superseded 在同一事务完成。
- 同一事务为旧对象创建 storage deletion outbox。
- 替换 original 后，依赖旧 checksum 的派生 Artifact 同时 supersede 并进入删除流程。
- V1 没有 engine 时，派生 Artifact 可来自 seed/import 或受控后台 CRUD。

## 8. 删除与 Outbox

删除 Resource 或整个 KS 时：

1. 服务事务锁定目标 Resource/Artifacts。
2. 为所有尚未安排删除的 Artifact 创建 storage deletion outbox。
3. 删除业务 metadata；Artifact 通过 Resource cascade 删除。
4. metadata 删除与 outbox 插入原子提交。
5. Worker 使用数据库设计中的 lease-token fencing、过期回收和幂等删除规则处理 OSS。

Outbox 必须复制 provider、bucket、key 和 version ID（如有），不能依赖提交后已删除的 Artifact。对象已不存在视为成功；过期 Worker 的 CAS 更新失败后不得覆盖新 Worker 状态。

## 9. Reconciliation

### 9.1 DB → OSS

- active original 对象不存在：将已激活 Artifact 标记为 superseded，并把 Resource 标记 failed；active 派生 Artifact 不存在时只把该 Artifact 标记 superseded。两者都记录 Graph Issue 或运维告警。`failed` 仅用于从未成功激活的 staging Artifact。
- metadata 与 OSS size/checksum 不一致：禁止继续作为 active 内容使用，进入人工处理。

### 9.2 OSS → DB

- 仅扫描 Odyssey 管理的 bucket/prefix。
- 对象没有对应 Artifact 或 outbox 时，先经过安全宽限期，再删除。
- 删除前必须再次查询 Artifact 和 outbox；只有第二次确认仍无关联时才能删除，避免扫描和删除之间刚登记的新对象被误删。
- staging 对象超过 TTL 时按上传失败处理。
- 操作必须幂等并限制每批数量，避免大范围误删。

V1 可先实现管理命令/定时任务，不需要完整运维 UI。

## 10. 安全与限制

- Bucket 全部 private；API 不返回长期 credential。
- 上传和下载都先校验 Workspace ownership。
- 校验 MIME type、扩展名、magic bytes 和文件大小，不能只信客户端 Content-Type。
- ZIP/package 必须防止 path traversal、zip bomb 和超额解压。
- Presigned upload 限定 object key、method、TTL；provider 支持时同时限定 content length/type。
- 日志不得记录 presigned URL、credential、完整 extracted content 或敏感文件内容。
- 服务端加密/bucket encryption 由部署配置开启；V1 不实现用户自管密钥。
- 若 V1 不实现恶意文件扫描，上传 UI 和部署文档必须明确可信使用范围。

## 11. 容量与保留策略

以下数值属于部署配置，不写死在 schema：单文件上限、URL TTL、upload expiration、outbox retry/lease、Artifact 保留时间和 orphan grace period。

V1 默认 thin Journey export 不复制 Knowledge Space 文件。未来 thick export 必须显式选择、计算大小、生成有 `expires_at` 的临时 ZIP，不能隐式导出整个 KS。

## 12. V1 实施清单

1. 新增 `knowledge_resource_artifact` 表及 partial unique/CHECK。
2. 从 Resource 移除 provider/bucket/object key，保留 original 查询缓存。
3. Outbox 复制 storage version ID，并沿用 lease-token fencing。
4. 实现 create-upload、complete-upload、download/preview 和 replace API。
5. 实现 SHA-256、不可复用 key 和 private bucket policy。
6. 实现 Resource/KS 删除与 outbox 的原子事务。
7. 实现 staging cleanup 与双向 reconciliation 管理任务。
8. 测试未授权访问、伪造/重复 complete、替换并发、Worker crash/reclaim、孤儿清理和对象缺失。
9. 本地以 MinIO 验证；provider adapter tests 不依赖特定 ETag 语义。

## 13. 明确延期

- Embedding/Vector DB。
- Workspace 总容量 quota 与并发容量预留；V1 只实施单文件上限。未来实现 quota 时必须增加原子 reservation/settlement，不允许扫描 active Artifacts 后做 TOCTOU 检查。
- 自动 Document Curator/Knowledge Steward artifact generation。
- 跨区域复制、冷热分层和用户自管加密密钥。
- Artifact 历史浏览/恢复 UI。
- Thick export 与异步 export artifact lifecycle。
- 完整恶意文件扫描平台；若部署要求，必须在上线前补齐。
