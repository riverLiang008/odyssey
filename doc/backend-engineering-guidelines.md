# Odyssey 后端工程规范

> Status: Engineering guideline  
> Scope: Odyssey API 的架构、合同、事务、数据访问、安全、测试与代码评审  
> Stack: Python 3.12、FastAPI、Pydantic Settings、SQLAlchemy asyncio、asyncpg、PostgreSQL、Alembic、pytest、pytest-asyncio、Ruff

## 1. 目的与适用范围

Odyssey 后端负责持久化具有强 ownership、cross-reference、revision 和原子事务要求的
Journey、Pattern、AgentWorkflow、Template、Tool 与 Knowledge Space 数据。它不是简单的
表单 CRUD API。

本规范的目标是：

- 保持 HTTP、application、domain、repository 和 ORM 边界清晰；
- 让 Workspace 隔离、revision CAS 和事务原子性成为默认实现，而非调用方约定；
- 防止未验证 JSONB、ORM 对象或前端 view state 泄漏到稳定合同；
- 让并发、回滚、跨 Workspace 和损坏数据在自动测试中得到证明；
- 为实现、重构、调试和代码评审提供一致的 Definition of Done。

关键词：

- **必须**：除非存在已评审并记录的架构例外，否则必须遵守；
- **应当**：默认遵守，偏离时应记录理由；
- **可以**：根据用例和风险选择。

本规范适用于：

- `apps/api` 中的所有生产代码、迁移和测试；
- 影响 API DTO、持久化 JSON、revision 或 Workspace ownership 的共享合同修改；
- 后端相关的代码评审和故障修复。

## 2. 核心边界

所有后端实现必须遵守：

```text
HTTP DTO ≠ ORM Model
Transaction Boundary ≠ Repository Method
Stored JSON ≠ Trusted Domain State
Current Workspace ≠ Client Input
Domain Failure ≠ Presentation Message
```

具体含义：

1. Pydantic request/response model 与 SQLAlchemy model 分离，不直接序列化 ORM model。
2. application service 拥有事务；repository 不自行提交。
3. JSONB 在写入前和读取后都必须经过 canonical boundary validation。
4. Workspace 来自服务端身份/dependency，不信任 path/query/body 中的任意 Workspace ID。
5. domain/application 返回稳定错误码，HTTP 层映射状态码，最终本地化文案属于前端。

违反上述边界的实现，即使 happy path 可用，也视为架构缺陷。

## 3. 分层架构

Odyssey API 使用以下调用方向：

```text
FastAPI Router / Dependency
            ↓
Strict Pydantic Boundary DTO
            ↓
Application Service / Transaction Boundary
            ↓
Domain Policy / Aggregate Validation
            ↓
Repository / SQLAlchemy Statements
            ↓
PostgreSQL
```

依赖方向只能向下。下层不得导入 router、FastAPI request/response 或 HTTP status。

### 3.1 Router

Router 只负责：

- 声明 path、method、header 和 status；
- 接收严格 DTO 与 dependency；
- 调用一个 application use case；
- 返回 response DTO；
- 让统一 exception handler 处理已知错误。

Router 不得：

- 编写 topology、ownership 或 revision 规则；
- 直接构造 SQLAlchemy query；
- `commit()`、`rollback()` 或管理多步事务；
- 返回 ORM model；
- 捕获所有 `Exception` 后转换为 400/500；
- 通过字符串匹配数据库异常决定业务语义。

### 3.2 Boundary DTO

Pydantic model 负责外部结构验证：

- UUID、枚举、revision、时间戳和字段长度；
- discriminated union；
- strict/forbid-extra 行为；
- request 与 response 的稳定 JSON alias；
- field-level validation issue path。

DTO 不负责：

- 查询数据库确认 ownership；
- 判断 revision 是否过期；
- 执行跨 aggregate 不变量；
- 打开事务或产生持久化副作用。

内部 Python 命名使用 `snake_case`，外部冻结合同使用明确 alias 映射到既定
`camelCase`。不得在不同 endpoints 中临时混用命名风格。

### 3.3 Application Service

每个 public service method 对应一个业务 use case，例如：

```text
create_journey
save_journey_pattern
create_minimum_agent_and_assign
remove_occupied_slot
save_agent_workflow
delete_journey
```

Application service 必须：

- 接收已经结构验证的 command 和服务端 Current Workspace；
- 建立唯一事务边界；
- 调用 domain policy 与 repository；
- 将低层失败归一化为稳定 application error；
- 在返回前组装并验证 response aggregate。

Service 不得依赖 FastAPI `Request`、`Response`、HTTPException 或状态码。

### 3.4 Domain

Domain 层包含不依赖数据库和 Web framework 的规则：

- Pattern 实例化、route derivation 与 topology validation；
- aggregate transition validation；
- immutable field 与 ownership invariant；
- Template snapshot/remap 规则；
- 最小 WorkflowGraph/Layout factory。

Domain function 应当是确定性纯函数：显式接收 ID/time factory 或已生成值，不直接读取
全局时间、环境变量、数据库 session 或 Web request。

### 3.5 Repository

Repository 封装 use-case-oriented SQLAlchemy statements 和 projection assembly。它负责：

- scoped select/insert/update/delete；
- CAS statement；
- ORM row 与 validated persistence structure 的转换；
- 必要的 row lock；
- aggregate projection query。

Repository 不得：

- 自行 `commit()`；
- 隐藏新事务或新 session；
- 返回未验证 JSONB 给 router；
- 实现最终 HTTP error mapping；
- 为了“复用”建立覆盖所有表的 generic CRUD base repository。

## 4. 包与文件组织

按 feature/aggregate 组织代码，同时保持共享基础设施独立：

```text
odyssey_api/
├─ dependencies/       # session、identity、Current Workspace
├─ errors/             # stable codes、application errors、HTTP handlers
├─ db/                 # Base、ORM models、engine/session infrastructure
├─ journeys/           # Journey/Pattern/AgentWorkflow vertical slice
├─ agent_templates/    # Agent Template use cases
├─ knowledge/          # Knowledge Space use cases
├─ storage/            # object storage ports/adapters
└─ main.py              # app composition only
```

每个 feature 可以包含 `dto.py`、`domain.py`、`repository.py`、`service.py`、`router.py`。
只有职责足够大时才拆文件；不得把所有内容堆入 `services.py`、`schemas.py` 或 `utils.py`。

跨 feature helper 必须证明其语义稳定且确实共享。不得仅因两段代码外形相似就抽象。

## 5. Python 与类型规则

- 目标版本为 Python 3.12；使用现代内置泛型和 `X | None`。
- 所有 public function、service、repository 和 dependency 必须完整标注参数与返回类型。
- 使用 `StrEnum` 或 Pydantic literal/enum 表达闭合集合，不用裸字符串散落判断。
- 使用 `dataclass(frozen=True)` 或明确 Pydantic model 表达 immutable command/result。
- 业务代码不得使用无约束 `Any`；ORM JSONB column 的 `Any` 不得传播越过 persistence boundary。
- 不用 `dict[str, object]` 长期替代已经稳定的 DTO/domain model。
- 不用 `# type: ignore` 掩盖可修复问题；不可避免时必须限制到最小表达式并说明原因。
- 不通过反射、动态 attribute 或 magic string 绕过静态结构。
- ID 参数必须携带实体语义，例如 `journey_id`、`agent_id`、`slot_id`。
- UTC 时间必须 timezone-aware；API 输出统一为 canonical UTC timestamp。
- 所有持久化 identity 使用 UUID；稳定 definition/template key 使用 `snake_case`。

Ruff 是最低静态质量门槛。不得用扩大 ignore 列表代替修复新增违规。

## 6. Pydantic 合同规范

### 6.1 Strict boundary

所有 API request/response models 必须拒绝未声明字段。字符串应根据合同设置 trim、最小
长度和最大长度，revision 必须为正整数。

### 6.2 Request 与 response 分离

即使字段相似，也不得默认用同一个 model 同时承担：

- create request；
- update request；
- stored aggregate；
- response projection。

这样可以防止 response-only identity、timestamps、ownership 和 revision 被客户端写入。

### 6.3 Canonical parity

Python Pydantic models 必须兼容 `packages/schemas` 的冻结 JSON 合同。合同调整必须同步：

- TypeScript runtime schema；
- Python boundary model；
- canonical positive/negative fixtures；
- API examples；
- persistence mapping；
- frontend repository adapter。

不能只修改一端后用宽松字段或类型断言保持“兼容”。

### 6.4 Response validation

所有 aggregate response 在离开 application service 前必须经过完整 Pydantic validation。
不得假设数据库行天然等价于合法 canonical aggregate。

## 7. Session 与事务

### 7.1 所有权

请求 dependency 负责创建并关闭一个 `AsyncSession`。Application service 负责：

```python
async with session.begin():
    ...
```

Repository 只能 `execute()`、`flush()` 或 `refresh()`，不得 `commit()`、开启隐式新 session
或吞掉 rollback。

### 7.2 一次 use case，一次 commit

一次业务操作涉及多表或多 aggregate 时必须在一个数据库事务内完成。例如：

```text
create AgentWorkflow
→ create Start/End graph
→ assign Slot
→ increment Journey revision
→ commit once
```

任何失败都必须让所有变更和 revision 一起回滚。

### 7.3 不在事务中执行外部慢操作

网络请求、对象上传、模型调用或不可控 I/O 不得占用数据库事务。需要跨系统一致性时使用：

- staged state；
- outbox；
- idempotency key；
- 补偿/清理流程。

不得把数据库事务描述为可以回滚已经完成的外部副作用。

### 7.4 Cancellation

Cancelled request 不得被当作普通业务失败吞掉。异步取消应传播到 transaction context，
确保 session rollback/close。禁止无边界使用 `asyncio.shield()`。

## 8. Optimistic Concurrency 与 revision

所有可编辑 aggregate 使用数据库级 CAS：

```sql
UPDATE ...
SET revision = revision + 1,
    updated_at = now(),
    ...
WHERE id = :id
  AND revision = :expected_revision
  AND workspace ownership matches
RETURNING revision, updated_at;
```

禁止：

```text
SELECT revision
→ Python compare
→ unconditional UPDATE
```

零行更新后，使用 scoped diagnostic read 区分：

- 当前 Workspace 不可见：`NOT_FOUND`；
- 可见但 revision 不同：`REVISION_CONFLICT`。

不得泄露资源存在于其他 Workspace。成功的 aggregate mutation 必须恰好递增一次 revision。
失败、validation rejection 和 rollback 不得消耗 revision。

`If-Match` 等 transport precondition 必须严格解析；缺失、弱 ETag、非 quoted 正整数或多值
格式都返回稳定 validation failure，不默认为当前 revision。

## 9. Workspace 隔离与安全

### 9.1 Current Workspace 来源

Current Workspace 必须来自认证 identity 或显式 development/test dependency。不得：

- 接受客户端 body 中的 unrestricted `workspace_id`；
- 从数据库选择第一条 Workspace；
- 在 production 缺少 identity 时回退到开发 Workspace；
- 仅在 router 检查 Workspace、下层查询却不 scoped。

### 9.2 Scoped query

每个 root aggregate read/write 必须在 SQL query 中包含 ownership scope，必要时通过 join
Journey 验证 AgentWorkflow ownership。先按裸 ID 查询再在 Python 中比较 Workspace 不是
首选做法，因为容易产生越权泄漏和遗漏。

### 9.3 Not-found hiding

跨 Workspace read/write/delete 统一表现为 `NOT_FOUND`。错误 details、日志和 timing 不应向
客户端确认其他 Workspace 中存在该 ID。

### 9.4 Secrets 与日志

不得记录：

- credentials、authorization headers；
-完整 Workflow/Template/Knowledge 文档；
-用户文件正文；
- signed URL 或对象存储 secret。

日志可以记录 scoped entity ID、revision、operation、stable error code、duration 和 row count。

## 10. JSONB 与 aggregate validation

JSONB 适合保存演进中的 PatternConfig、WorkflowGraph 和 CanvasLayout，但不是 schema-free
逃生口。

写入前必须：

1. 解析 strict request DTO；
2. 执行 domain/cross-reference validation；
3. 转换为 canonical JSON；
4. 再交给 ORM。

读取后必须：

1. 将 JSONB 当作 untrusted data；
2. 解析 persistence/canonical model；
3. 组装 relation-backed collections；
4. 验证完整 response aggregate。

检测到 legacy 或损坏数据时返回独立、可诊断的稳定错误，不得静默补字段、重解释 topology
或把空对象伪装成合法 aggregate。

UI-only、ORM-only 和 framework-specific 字段不得进入 JSONB，例如 selection、menu、drag
state、pixel geometry、SQLAlchemy metadata 或 Vue Flow objects。

## 11. Domain transition validation

只验证提交后的最终 JSON 结构通常不够。修改现有 aggregate 时必须同时验证 transition：

- immutable identity/provenance 未改变；
- 删除/新增/重排是当前 Pattern capability 允许的 operation；
- occupied Slot 没有通过普通 save 被隐式删除；
- Agent assignment 不跨 Journey且不重复；
- route 来自当前 topology rule；
- destructive precondition 与数据库当前状态一致。

候选状态应先完整验证，再执行一次持久化 mutation。不得先部分写入、验证失败后手工拼接
回滚逻辑。

## 12. 错误模型

错误分三层：

```text
Domain/Application Error
  stable code + structured details
              ↓
HTTP Error Handler
  status + stable envelope
              ↓
Frontend
  localized presentation
```

服务端稳定错误示例：

```text
VALIDATION_FAILED
NOT_FOUND
REVISION_CONFLICT
STATE_CONFLICT
LEGACY_PATTERN_UNSUPPORTED
```

统一 envelope：

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "details": {
      "expectedRevision": 2,
      "currentRevision": 3
    }
  }
}
```

要求：

- `details` 使用稳定字段，不依赖英文 message；
- validation issue 保留 `{path, code}`；
- Pydantic validation handler 必须输出项目 envelope，而不是泄漏框架默认形状；
- unexpected exception 返回通用 500，不向客户端暴露 SQL、stack trace 或内部配置；
- database constraint error 只有在明确映射到已知 domain invariant 时才能转为业务错误；
- `NETWORK_FAILED`、`ABORTED`、`RESPONSE_INVALID` 属于客户端 adapter，不由服务端伪造。

## 13. SQLAlchemy asyncio 规范

- 所有 ORM I/O 使用 async API；不得在 async route 中调用同步 engine/session。
- 避免 lazy-loading 触发隐式 I/O；projection query 明确 select/join/load 所需数据。
- `expire_on_commit=False` 不等于可以把 ORM object 当 response；提交后仍需显式组装 DTO。
- 批量 ownership/CAS 操作优先使用 Core `update/delete ... returning`。
- repository method 名称描述业务查询，例如 `get_journey_editor_document`，不用模糊的
  `get_by_id` 横跨不同 scope。
- 不把 `IntegrityError` 当正常控制流；能在 domain/CAS 中明确验证的条件先验证，同时保留
  DB constraint 作为最后防线。
- 查询集合必须有稳定 ordering；分页未实现时也不得依赖数据库自然顺序。
- N+1 query 必须在 code review 中识别；列表 projection 使用聚合或批量查询。

## 14. Alembic 与数据库设计

### 14.1 Migration 原则

只有 accepted contract 无法由现有 schema 安全承载时才新增 migration。不得为了匹配 DTO
外形机械添加重复列。

Migration 必须：

- 有唯一、可排序 revision；
- upgrade/downgrade 与 ORM metadata 一致；
- 显式命名 constraint/index；
- 说明数据迁移、锁表和兼容影响；
- 不依赖应用运行时 module 中可能变化的 domain helper；
- 在空数据库和当前基线数据库上验证 upgrade。

破坏性或不可逆 downgrade 必须明确记录，不伪造有数据损失风险的“成功回滚”。

### 14.2 Constraint

能由数据库表达的稳定 invariant 应保留数据库防线，例如 FK、unique、check 和 delete
behavior。但数据库 constraint 不替代 Pydantic/domain validation，因为 API 仍需稳定错误。

### 14.3 Seed

Development seed 必须：

- 显式目标 Workspace ID；
- 可重复执行；
- 不覆盖用户已有数据；
- 不在 production 自动运行；
- 不通过“选第一行”推断目标。

## 15. API 设计

- 资源 endpoints 用名词；跨 aggregate 原子操作可以使用明确 command subresource。
- 不因 CRUD 对称性添加无产品用途的 endpoints。
- path identity 不在 body 重复；若内部 port 携带 ID，HTTP adapter 必须校验/剥离。
- create 成功通常返回完整可导航 aggregate；delete transport 和 status 必须提前冻结。
- destructive operation 必须要求显式 confirmation 所需的数据和 expected revision。
- list response 不返回 presentation string 或虚构 runtime counts。
- OpenAPI example 必须覆盖成功、validation、not found、conflict。
- CORS、docs exposure 和 development dependency 必须由环境配置控制，production fail closed。

## 16. Observability

每个 use case 应当能够诊断：

- operation name；
- scoped Journey/Agent/Template ID；
- expected/current/new revision；
- stable error code；
- transaction duration；
- affected row count。

日志必须在 service/HTTP boundary 统一产生，避免每层重复记录同一异常。Unexpected exception
保留 server-side traceback；known domain error 通常不需要 error-level stack trace。

日志和 metric 不得改变业务事务结果，不得因 telemetry failure 回滚成功的 persistence。

## 17. 测试规范

### 17.1 Test pyramid

后端测试至少包含：

1. Pydantic contract unit tests；
2. pure domain/invariant tests；
3. PostgreSQL repository/service transaction tests；
4. FastAPI HTTP integration tests；
5. migration/schema boundary tests。

### 17.2 PostgreSQL 是集成测试基线

依赖 JSONB、asyncpg、PostgreSQL constraint、`RETURNING`、locking 或 transaction semantics 的
测试不得用 SQLite 替代。SQLite 可以用于与数据库无关的纯单元测试，但不能作为
repository/service correctness 证明。

### 17.3 Transaction tests

每个 multi-row use case 必须覆盖：

- success commits complete state；
- 每个关键阶段注入失败；
- failure 后用独立 session 读取，证明没有 partial rows；
- revision 未提前递增；
- retry 行为符合合同；
- owned cascade 与 independent reference preservation。

仅断言 service 返回 error 不足以证明 rollback。

### 17.4 Concurrency tests

必须覆盖：

- stale revision 不能覆盖新状态；
- 两个独立 session 并发写同一 aggregate 只有一个成功；
- default name/Slot assignment 不重复；
- conflict 返回 current server revision；
- 跨 Workspace ID 不泄漏存在性。

不允许只通过 mock 模拟 revision conflict；至少要有真实 PostgreSQL 并发/CAS 测试。

### 17.5 API tests

HTTP tests 验证：

- method/path/status/header；
- strict request rejection；
- canonical response JSON；
-统一 error envelope；
- dependency override；
- Workspace isolation；
- response 不含 ORM/UI-only 字段。

### 17.6 Determinism

测试使用显式 ID/time factory 或验证结构而非依赖 wall clock。不得使用长时间 sleep 组织
并发；使用 barrier/event 或数据库同步条件。

## 18. Mock 与依赖替换

- domain tests 不需要数据库 mock；直接测试纯函数。
- service unit tests 可以使用窄 port fake，但最终事务语义必须由 PostgreSQL integration test
  覆盖。
- dependency override 应替换显式 FastAPI dependency，不 monkeypatch 隐藏全局 singleton。
- 不 mock 被测对象内部私有函数以拼出 happy path。
- 对象存储、邮件或第三方 API 使用定义明确的 port/fake，不在测试中访问真实外部服务。

## 19. 性能与查询纪律

- Journey list 不为每行执行独立 Agent count query；使用 aggregation 或批量查询。
- aggregate load 的 query 数量应稳定并有测试/审查依据。
- 不在持有 row lock 时执行不相关计算或外部 I/O。
- JSONB aggregate 大小和全量替换成本应被监测；V1 aggregate replacement 不等于忽视尺寸。
- 优化不得牺牲 Workspace scope、validation 或 CAS correctness。
- 添加 index 必须基于查询形状和测量/约束需求，不以“可能更快”为理由盲目增加。

## 20. 禁止模式

以下模式不得进入正式实现：

- Router 直接查询/修改 ORM；
- Repository 内部 `commit()`；
- ORM model 直接作为 response model；
- 客户端提供 unrestricted Workspace ID；
- 读取裸 ID 后在 Python 中补做所有权检查；
- read-compare-unconditional-update 模拟 CAS；
- 未验证 JSONB 直接返回；
- 使用 `Any`/raw dict 长期替代稳定合同；
- 捕获所有异常并返回 400；
- 通过错误字符串匹配业务状态；
- 多个 API 调用伪装一个原子操作；
- transaction failure test 只看返回值、不查数据库；
- 用 SQLite 证明 PostgreSQL transaction/JSONB correctness；
- 静默修复或重解释 legacy persisted document；
- 为追求 CRUD 对称性实现无产品需求的 endpoints；
- 在 production 自动回退到开发 Workspace 或开发 seed。

## 21. Definition of Done

一个后端功能完成必须满足：

1. Router、DTO、service、domain、repository 和 ORM 边界清晰。
2. Current Workspace 由服务端 dependency 提供，所有查询和 mutation 都 scoped。
3. 外部输入、stored JSON 和 aggregate response 均经过 runtime validation。
4. 多表操作只有一个 transaction/commit boundary，失败完整回滚。
5. 可编辑 aggregate 使用数据库级 CAS，revision 恰好递增一次。
6. Domain/application error 使用稳定 code/details，HTTP envelope 一致。
7. ORM model、内部列、UI-only state 和 secrets 不进入 API response。
8. 成功、validation、not found、conflict、cross-Workspace 和 rollback 均有测试。
9. PostgreSQL integration tests 证明关键事务与并发语义。
10. Migration 仅在必要时添加，并通过 upgrade/schema verification。
11. OpenAPI/前端 handoff 示例与最终合同一致。
12. Ruff 和完整 `apps/api` pytest suite 通过。

项目当前后端质量命令：

```bash
cd apps/api
uv run ruff check .
uv run pytest
```

如果实现同时修改 `packages/schemas` 或 Web adapter，还必须运行对应 workspace 的 lint、
typecheck 和 tests。

## 22. Code Review Checklist

### Architecture

- [ ] Router 是否只做 boundary/orchestration？
- [ ] Service 是否拥有唯一事务边界？
- [ ] Repository 是否避免 commit 和 HTTP 语义？
- [ ] Domain 是否独立于 FastAPI、SQLAlchemy session 和环境变量？
- [ ] 是否出现无必要 generic CRUD/抽象？

### Contract

- [ ] Request/response 是否 strict 且分离？
- [ ] camelCase/snake_case alias 是否一致？
- [ ] stored/returned JSON 是否经过 canonical validation？
- [ ] 是否与 `packages/schemas` parity-tested？
- [ ] 是否泄漏 ORM/UI-only/internal 字段？

### Transactions and concurrency

- [ ] 是否只有 application service commit？
- [ ] 是否使用数据库级 CAS？
- [ ] revision 是否恰好递增一次？
- [ ] failure injection 后是否查询数据库证明 rollback？
- [ ] lock 范围是否最小且不含外部 I/O？

### Security

- [ ] Workspace 是否来自服务端 dependency？
- [ ] 每条 root query/mutation 是否在 SQL 中 scoped？
- [ ] cross-Workspace 是否统一 NOT_FOUND？
- [ ] 日志/error details 是否泄漏 secrets 或资源存在性？
- [ ] production 是否 fail closed？

### Database

- [ ] Query 是否存在 N+1 或不稳定 ordering？
- [ ] Constraint error 是否映射为稳定 domain error？
- [ ] Migration 是否确有必要并可从基线执行？
- [ ] ORM metadata 与 migration 是否一致？
- [ ] delete cascade/restrict 是否符合 ownership？

### Tests

- [ ] Domain invariant 是否有纯函数测试？
- [ ] PostgreSQL 是否覆盖真实 transaction/CAS？
- [ ] Workspace isolation 是否覆盖 read/write/delete？
- [ ] API error envelope 和 strict body 是否测试？
- [ ] 是否测试 rollback 后的真实数据库状态？

## 23. 架构例外

如确需违反“必须”规则，必须在 PR、ADR 或对应 implementation plan 中记录：

```text
违反的规则
当前约束
为何无法采用合规方案
风险与影响范围
隔离、测试和可观测措施
移除例外的负责人和条件
```

“先做出来”“当前只有一个 Workspace”“数据可信”或“框架默认如此”不能单独作为例外
理由。

## 24. 最终原则

Odyssey 后端的可靠性来自明确的 ownership、validated aggregates 和数据库原子性：

```text
先冻结合同和领域不变量
→ 再定义 use case 与 transaction boundary
→ 再实现 scoped repository/CAS
→ 最后连接 HTTP 与前端 adapter
```

框架、数据库访问方式和部署环境可以演进；Workspace 隔离、稳定 identity、canonical
validation、revision concurrency 和 all-or-nothing transaction 不能依赖调用方自觉。
