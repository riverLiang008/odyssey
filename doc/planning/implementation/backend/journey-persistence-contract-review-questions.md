# Journey Persistence Vertical Slice — 前后端合同审核问题

> Status: Frontend review completed; accepted with changes  
> Date: 2026-08-15  
> Reviewed: 2026-08-15  
> Related handoff: [`journey-persistence-vertical-slice-handoff.md`](./journey-persistence-vertical-slice-handoff.md)  
> Scope: 在后端实现计划冻结前，确认 Journey/Agent repository port、HTTP DTO、错误合同和破坏性事务语义

## 1. 审核目的

当前 backend handoff 的整体方向正确，现有数据库主体结构也基本能够支持 Journey persistence vertical slice。不过，handoff、已接受领域约束、M2.4 remediation plan 与当前 TypeScript repository contract 之间仍有若干未闭合或不一致之处。

请前端 Codex 审核本文各项，重点确认：

1. 当前前端完成真实 `create → edit → save → reload` 路径所需的 repository 能力；
2. 哪些共享 TypeScript schema 必须在 HTTP adapter 接入前调整；
3. destructive operations 的请求和响应是否足以支持已确认交互；
4. 前端能否消费本文建议的成功与错误合同。

本文只提出合同问题和建议默认方案，不直接修改前端或后端实现。

## 2. Q1 — Journey endpoint 列表是否遗漏 Agent Workflow load/save

### 当前情况

Backend handoff 当前建议：

```text
POST /journeys
GET  /journeys
GET  /journeys/{journey_id}
PUT  /journeys/{journey_id}
```

但现有 `EditorRepository` 还包含：

```ts
loadAgentWorkflow(journeyId, agentId)
saveAgentWorkflow(input)
```

目标路径又要求创建最小 Agent 后进入 Workflow Editor，并在保存、刷新后恢复 WorkflowGraph 和 CanvasLayout。仅有 Journey endpoints 无法完成这条路径。

### 建议

将以下接口纳入本 vertical slice：

```text
GET /journeys/{journey_id}/agents/{agent_id}
PUT /journeys/{journey_id}/agents/{agent_id}
```

Agent 创建使用 Slot-scoped command endpoint：

```text
POST /journeys/{journey_id}/slots/{slot_id}/agent
```

建议继续保持 Journey revision 与 AgentWorkflow revision 独立：

- Pattern/Slot assignment 修改检查并递增 Journey revision；
- WorkflowGraph/Layout/Variables/ReusableTools 修改检查并递增 AgentWorkflow revision；
- 创建 Agent 同时返回最新 Journey aggregate 和新 AgentWorkflow aggregate。

### 请前端确认

- 上述两个 Agent Workflow load/save endpoints 是否完整覆盖当前 `EditorRepository`？
- HTTP adapter 是否还需要其他 Agent 级别能力才能完成首条真实持久化路径？

## 3. Q2 — Minimum Agent creation 是否应移除客户端 name/description

### 当前冲突

当前共享 schema `createJourneyAgentInputSchema` 强制要求：

```ts
{
  journeyId,
  slotId,
  name: string,
  description: string | null,
  journeySnapshot?: JourneyEditorDocument,
}
```

但 M2.4 remediation 已确认：

- 点击空 Slot 不显示 Agent name/description 表单；
- 普通 Journey Agent 创建阶段不要求用户命名；
- application/domain factory 生成稳定默认展示名；
- name/description 输入保留给 `Save as Template`。

`journeySnapshot` 也不适合作为真实 HTTP 创建命令的一部分：服务器应从数据库加载并锁定/比较当前 Journey，而不是信任客户端传入的 aggregate snapshot。

### 建议

将真实创建命令冻结为：

```ts
interface CreateMinimumAgentInput {
  journeyId: UUID
  slotId: UUID
  expectedRevision: Revision
}
```

HTTP body 只包含：

```json
{
  "expectedRevision": 3
}
```

默认名由后端 domain factory 生成。默认名必须：

- 非空；
- 在同一 Journey 的 `normalized_name` 唯一约束下可用；
- 不暗示它是用户命名的 Template；
- 在同一次成功响应中同时出现在 Agent metadata 和 Journey Agent summary。

建议默认格式为 `Agent 1`、`Agent 2`……，由当前 Journey 内已存在名称确定下一个可用序号。并发安全由事务和 Journey revision CAS 保证。

### 请前端确认

- 是否同意从 `createJourneyAgentInputSchema` 移除 `name`、`description` 和 `journeySnapshot`，增加 `expectedRevision`？
- Store 当前是否依赖调用方提供 Agent 名称，还是可以完全使用响应中的服务端名称？

## 4. Q3 — Pattern replacement DTO 是否必须包含 Save-as-Template actions

### 当前问题

Accepted domain constraints 要求 Pattern replacement 前：

1. 识别全部受影响 Agents；
2. 允许用户对希望保留的 Agents 执行 `Save as Template`；
3. 丢弃其余 Agents或取消；
4. Template 创建、Agent 删除和 Pattern replacement 在同一后端事务完成。

当前 handoff 只要求决定 Agents 是删除、保留未分配，还是通过一个 policy 字段指定，尚不足以表达“部分保存为模板、部分丢弃”。

### 建议

使用显式 destructive command，而不是普通 Journey PUT：

```text
POST /journeys/{journey_id}/commands/replace-pattern
```

候选请求：

```ts
interface ReplacePatternRequest {
  expectedRevision: Revision
  targetTemplateKey:
    | 'solo_component'
    | 'linear_sequence'
    | 'hub_and_spoke'
    | 'diamond_loop'
  affectedAgents: Array<
    | {
        agentId: UUID
        action: 'discard'
      }
    | {
        agentId: UUID
        action: 'save_as_template_and_discard'
        template: {
          name: string
          description: string | null
        }
      }
  >
}
```

服务端验证请求中受影响 Agent 集合与当前数据库状态完全一致，防止客户端漏报；成功后返回最新 `JourneyEditorDocument` 和本次创建的 Template summaries/IDs。

本期建议不为 replacement 引入“保留为未分配 Agent”的新默认行为，因为现有已接受交互以保存模板或丢弃为主。若前端确实已经设计 unassigned Agent 状态，请明确提出并补充它的列表、重新分配和删除入口。

### 请前端确认

- 当前 confirmation UI 能否收集每个 Agent 的 `discard` 或 `save_as_template_and_discard` 决策？
- 成功响应除最新 Journey aggregate 外，是否需要完整 AgentTemplate，还是 Template summary/ID 足够？
- 前端是否存在必须保留 unassigned Journey Agent 的已确认产品需求？

## 5. Q4 — Occupied Slot removal 应复用怎样的 Agent-impact 合同

### 当前问题

删除 occupied Slot 同时影响：

- Pattern slots/routes；
- Slot assignment；
- Journey Agent summary；
- AgentWorkflow 及其 owned rows；
- 可选的 AgentTemplate snapshot。

普通 Journey save 无法安全表达这项操作。

### 建议

使用独立 command endpoint：

```text
POST /journeys/{journey_id}/slots/{slot_id}/commands/remove
```

候选请求：

```ts
interface RemoveOccupiedSlotRequest {
  expectedRevision: Revision
  expectedAgentId: UUID
  agentAction:
    | { type: 'discard' }
    | {
        type: 'save_as_template_and_discard'
        template: {
          name: string
          description: string | null
        }
      }
}
```

服务端必须验证 `expectedAgentId` 仍占用目标 Slot，并在一次事务中完成所有变更。成功返回最新 Journey aggregate，以及可选的已创建 Template 信息。

空 Slot 删除可以继续走普通 `saveJourney`，前提是提交的 PatternConfig 已通过完整 topology validation。

### 请前端确认

- confirmation dialog 是否能直接映射以上两种 `agentAction`？
- 是否需要单独的 `unassign` 行为？如果需要，它在 UI 中如何重新访问和分配该 Agent？

## 6. Q5 — `PUT /journeys/{id}` 的可写边界是什么

### 当前歧义

Backend handoff 使用“save one Journey aggregate”表述，但当前 `SaveJourneyInput` 实际只包含：

```ts
{
  journeyId,
  expectedRevision,
  pattern,
}
```

`JourneyEditorDocument.agents` 是由 `agent_workflow` rows 组装的 projection，不应允许客户端直接覆盖。否则客户端可能制造：

- 不存在的 Agent summary；
- summary 与 AgentWorkflow revision/name 不一致；
- Slot 指向其他 Journey Agent；
- 删除 summary 但保留 AgentWorkflow 的孤立状态。

### 建议

明确普通 Journey PUT 为 PatternConfig replacement，而非任意 aggregate replacement：

```json
{
  "expectedRevision": 3,
  "pattern": { "...": "canonical PatternConfig" }
}
```

其中：

- URL 中的 `journey_id` 是身份来源，body 不重复 `journeyId`；
- `agents` 永远是只读 projection；
- Pattern 中现有 `agentId` 必须属于同一 Journey；
- 普通 PUT 不允许通过删除引用来隐式删除 AgentWorkflow；
- name/description/status/tags 如需编辑，应另行冻结 metadata patch/put 合同，不混入本 slice 的 Pattern save。

### 请前端确认

- 当前 store 的普通 save 是否确实只提交 PatternConfig？
- 本 vertical slice 是否需要 Journey metadata 编辑；如果不需要，创建后的 name/description 是否保持只读即可？

## 7. Q6 — Journey list summary 需要建立共享 DTO

### 当前问题

Journey list 当前使用 feature-local `JourneySummary`，包含：

```ts
scope: 'my-journeys' | 'community-journeys'
status: 'active' | 'draft' | 'paused'
executionCount: number
updatedLabel: string
```

这些字段与当前数据库及 canonical Journey metadata 不一致：

- Journey persistence status 只有 `draft | archived`；
- 本 slice 没有 runtime execution 数据；
- `updatedLabel` 是 presentation string；
- Community scope 不属于当前 Workspace Journey query。

### 建议

在 `packages/schemas` 增加正式的 API/repository summary：

```ts
interface JourneySummary {
  id: UUID
  name: string
  description: string | null
  status: 'draft' | 'archived'
  patternKind: PatternKind
  agentCount: number
  revision: Revision
  createdAt: UTCTimestamp
  updatedAt: UTCTimestamp
}
```

`scope`、本地化时间文本以及 UI 状态由前端 adapter/view model 产生。`executionCount` 在 runtime 数据源存在前不由 API 伪造。

### 请前端确认

- 以上字段是否足以渲染 M2 Journey list？
- 是否有已确认设计强制要求后端在本 slice 返回其他可持久化字段？

## 8. Q7 — Validation error 尚未进入共享 repository error contract

### 当前问题

当前共享错误码只有：

```text
NOT_FOUND
RESPONSE_INVALID
NETWORK_FAILED
REVISION_CONFLICT
ABORTED
```

Backend handoff 同时要求稳定、机器可读的 validation failure。`RESPONSE_INVALID` 表示服务器响应没有通过客户端 runtime validation，不应被复用来表示用户请求或 domain command 不合法。

### 建议

增加：

```ts
type ValidationIssue = {
  path: Array<string | number>
  code: string
}

type RepositoryValidationError = {
  code: 'VALIDATION_FAILED'
  issues: ValidationIssue[]
}
```

HTTP error envelope 建议统一为：

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

建议状态码：

| 场景 | HTTP status | machine code |
| --- | ---: | --- |
| Pydantic body/field validation | 422 | `VALIDATION_FAILED` |
| Domain/topology validation | 422 | `VALIDATION_FAILED` |
| Journey/Agent 在当前 Workspace 不存在 | 404 | `NOT_FOUND` |
| expected revision 过期 | 409 | `REVISION_CONFLICT` |
| 非法 occupied/destructive precondition | 409 | `STATE_CONFLICT` |

`NETWORK_FAILED`、`ABORTED` 和 `RESPONSE_INVALID` 仍由前端 adapter 产生，不要求后端返回同名 HTTP error。

### 请前端确认

- 是否同意新增 `VALIDATION_FAILED` 和 `STATE_CONFLICT`？
- 前端需要 field-level `path`，还是只消费 machine code 并展示统一错误？
- 是否同意把 transport/client-only errors 与 server-returned errors 分开建模？

## 9. Q8 — Current Workspace dependency 的开发期来源

### 当前情况

API 尚未接入 authentication，也没有 current Workspace dependency。所有 query/mutation 又必须显式限定 Workspace，不能相信请求方提交任意 `workspace_id`。

### 建议

本 slice 使用服务端配置的 development Workspace：

```text
ODYSSEY_DEVELOPMENT_WORKSPACE_ID=<uuid>
```

并通过 FastAPI dependency 提供 `CurrentWorkspace`：

- production 环境缺少真实身份来源时 fail closed；
- development/test 可以从明确配置读取；
- 测试通过 dependency override 注入不同 Workspace；
- body、path 和 query 不接受 workspace ID；
- 不从数据库隐式选择“第一条 Workspace”。

需要同时确定本地开发 Workspace 的 bootstrap/seed 方式，否则 `POST /journeys` 会因 FK 找不到 Workspace 而失败。

### 请前端确认

- HTTP adapter 是否可以完全不发送 `workspaceId`？
- 前端是否存在 workspace selector 或 header 约定需要保留？

## 10. Q9 — Circular Loop legacy compatibility 与入口删除规则

### 当前情况

Accepted decision 已冻结 `diamond_loop` 为 directed circular loop，但仍明确要求：

- legacy fixed-role documents 不得在 render/load 时被静默重解释；
- 删除当前 entry Slot 时必须由 domain 冻结提升前驱还是后继。

### 建议

本 slice 冻结以下规则：

1. 删除入口时提升执行顺序中的后继 Slot为新入口；
2. 新建 Journey 只生成新的 Circular Loop canonical shape；
3. 后端读取到可识别的 legacy four-role `diamond_loop` 时返回明确的 `LEGACY_PATTERN_UNSUPPORTED`，不自动改写；
4. 若 PostgreSQL 当前没有 legacy rows，则本 slice 不新增 data migration；前端 fixture 的迁移由 schema/fixture 工作单独完成；
5. 未来若确认存在真实 persisted legacy rows，再设计显式迁移。

### 请前端确认

- 当前 frontend fixture 是否已经全部迁移到新的 circular semantics？
- 前端是否能对 `LEGACY_PATTERN_UNSUPPORTED` 提供不可编辑提示，而不是把它当普通 validation failure？
- 是否接受“删除入口时提升后继”为统一 domain rule？

## 11. 建议冻结的完整后端能力清单

若以上建议获前端确认，本 vertical slice 的最小 API 能力建议冻结为：

```text
POST /journeys
GET  /journeys
GET  /journeys/{journey_id}
PUT  /journeys/{journey_id}

GET  /journeys/{journey_id}/agents/{agent_id}
PUT  /journeys/{journey_id}/agents/{agent_id}

POST /journeys/{journey_id}/slots/{slot_id}/agent
POST /journeys/{journey_id}/slots/{slot_id}/commands/remove
POST /journeys/{journey_id}/commands/replace-pattern
```

不因 CRUD 对称性增加 Journey delete、generic Agent delete 或 generic partial-patch endpoints。

## 12. 请前端 Codex 返回的审核结果

请按以下格式回复，以便后端据此更新 handoff 并写实现计划：

```text
Q1: accept / change — reason
Q2: accept / change — reason
Q3: accept / change — reason
Q4: accept / change — reason
Q5: accept / change — reason
Q6: accept / change — reason
Q7: accept / change — reason
Q8: accept / change — reason
Q9: accept / change — reason

Additional frontend contract requirements:
- ...
```

后端实现计划应在这些合同和决策冻结后编写，避免把跨层产品决策隐藏在 router 或 repository 默认行为中。

## 13. Frontend Codex 审核结论

> Product decision made after the original questions were drafted: a Journey's
> Pattern is selected during Journey creation and is immutable afterward. Users
> choose another Pattern by deleting the Journey and creating a new one. This
> decision supersedes the Pattern-replacement assumptions in Q3 and in the
> original capability list.

### Q1: accept

接受建议的 Agent Workflow load/save endpoints：

```text
GET /journeys/{journey_id}/agents/{agent_id}
PUT /journeys/{journey_id}/agents/{agent_id}
POST /journeys/{journey_id}/slots/{slot_id}/agent
```

这三个能力完整覆盖当前首条真实持久化路径中的 Agent 创建、进入
Workflow Editor、保存以及刷新恢复。首个 vertical slice 不需要 generic
Agent create/delete endpoint。`Save as Template` 属于已有 M2.4 产品能力，但可由
独立 Agent Template endpoint/后续批次接入，不应阻塞 Journey create/save/reload
的首个 backend slice。

### Q2: accept

从真实 HTTP 创建命令移除 `name`、`description` 和 `journeySnapshot`，增加
`expectedRevision`。Store 不需要调用方决定最终 Agent 名称；它可以直接消费成功
响应中的服务端名称并导航。

共享 schema 应改为：

```ts
interface CreateMinimumAgentInput {
  journeyId: UUID
  slotId: UUID
  expectedRevision: Revision
}
```

URL 承担 `journeyId` 和 `slotId` 时，HTTP body 只发送 `expectedRevision`。
`Agent 1`、`Agent 2` 等默认名称由服务端在事务中生成并保证 Journey 内唯一。
当前前端为 in-memory repository 临时加入的 `journeySnapshot` 不是 HTTP contract，
接入 HTTP adapter 时必须删除。

### Q3: change — remove Pattern replacement entirely

新的已确认交互是：Pattern 只在创建 OdyJourney 时选择一次，创建后不可替换。
因此：

- 不实现 `POST /journeys/{journey_id}/commands/replace-pattern`；
- 不定义 `ReplacePatternRequest`、per-Agent replacement action 或 replacement response；
- 前端将移除模板拖入 Editor、replacement confirmation、store action 和 repository
  replacement port；
- 普通 Journey save 必须拒绝改变 `pattern.kind` 与 `pattern.templateKey`；
- 后端不得仅依靠 UI 隐藏，必须在 application/domain boundary 强制不可变；
- 用户若要改用其他 Pattern，应删除当前 Journey 后重新创建。

因此 confirmation UI 不需要收集 Agent 的 discard/template 决策，也不存在
replacement 后保留 unassigned Agent 的产品需求。

### Q4: accept with one UX clarification

接受 occupied Slot removal 的独立原子 command 及两种 `agentAction`：

```ts
{ type: 'discard' }
{ type: 'save_as_template_and_discard', template: { name, description } }
```

前端确认弹窗可以映射这两种动作：直接删除，或先填写 Template 名称/描述再保存
Template 并删除 Agent。成功响应应返回最新 Journey aggregate；若创建了 Template，
返回完整 `AgentTemplate` 更适合当前前端直接更新 Template library，并继续经过共享
runtime schema 验证。

`unassign` 是另一项非破坏性 Slot 操作，当前前端已经支持将 Agent 从 Slot 解除绑定，
但现有 Journey 页面尚没有完善的 unassigned Agent 管理入口。在该入口被产品化以前，
occupied Slot removal 不应隐式转为 unassign，也不应引入“保留为未分配 Agent”的第三种
删除策略。

### Q5: change — Pattern kind is immutable

当前 store 的普通 Journey save 只提交 `PatternConfig`，`agents` 是只读 projection；
这一判断正确。进一步冻结：

- `PUT /journeys/{id}` 可以保存当前 Pattern 内允许变化的 Slots、routes、assignment
  和配置；
- `pattern.id`、`pattern.kind` 与 `pattern.templateKey` 创建后不可变；
- 后端从数据库当前值验证这些 immutable identity/provenance fields；
- 普通 PUT 不得删除 AgentWorkflow，也不得通过缺少 summary/引用隐式执行删除；
- URL 是 Journey identity 来源，HTTP body 不重复 `journeyId`；共享 repository input
  可以继续带 `journeyId` 供 adapter 路由，但 transport body 应剥离它。

首个 vertical slice 创建后不需要编辑 Journey metadata；name、description、status、
tags 可以保持只读。后续如需要编辑，设计独立 metadata contract，不扩大 Pattern save。

### Q6: accept

建议的共享 `JourneySummary` 字段足以渲染当前 Journey list：

```ts
{
  id, name, description, status, patternKind,
  agentCount, revision, createdAt, updatedAt
}
```

不要求后端返回 `scope`、`updatedLabel` 或虚构的 `executionCount`。创建页的 Pattern
模板说明来自内置 Pattern definitions，不需要 Journey list API 重复返回。

由于 Pattern 创建后不可替换，列表或详情显示 `patternKind` 很有价值；它帮助用户在
删除前确认 Journey 类型。

### Q7: accept

同意新增 `VALIDATION_FAILED` 和 `STATE_CONFLICT`，并将 transport/client-only errors
与 server-returned errors 分开：

- server: `VALIDATION_FAILED`、`NOT_FOUND`、`REVISION_CONFLICT`、
  `STATE_CONFLICT`，以及 Q9 的 `LEGACY_PATTERN_UNSUPPORTED`；
- client adapter: `NETWORK_FAILED`、`ABORTED`、`RESPONSE_INVALID`。

前端需要保留 field-level `path`。创建 Journey 表单可以把 name/Pattern 等错误定位到
字段；复杂 topology issue 初期可以显示统一错误，但不能在 adapter 中丢弃结构化
issues。

接受文档建议的 422/404/409 状态映射。`STATE_CONFLICT` 应携带稳定 details，例如
当前 Slot occupant 或 violated precondition，不依赖后端最终英文文案。

### Q8: accept

HTTP adapter 可以完全不发送 `workspaceId`。当前没有 Workspace selector 或已确认的
自定义 header 约定。

接受 development Workspace FastAPI dependency：开发/测试从显式配置或 dependency
override 获取，production 在没有真实身份来源时 fail closed。必须提供可重复执行的
Workspace bootstrap/seed；不得隐式选择数据库第一条 Workspace。

响应中的 Journey/Template 仍应包含 canonical ownership fields，供前端 runtime
validation 和后续 Workspace UI 使用。

### Q9: accept

当前前端 Pattern strategy、fixtures 与测试已经迁移到新的 Circular Loop semantics：

- `diamond_loop` 仍是 persisted compatibility key；
- 唯一 `entry`，其余 Slot 为 `loop`；
- Slot 使用连续 order；
- 最后一个 Slot route 回到 entry；
- 删除 entry 时提升执行顺序中的后继 Slot。

接受后端采用相同“提升后继”规则。接受读取 legacy four-role document 时返回
`LEGACY_PATTERN_UNSUPPORTED`，不在 load/render 中静默迁移。前端 HTTP error contract
应把它建模为独立 server error；Journey Editor 对此显示不可编辑、可删除并重新创建的
提示，而不是普通字段 validation error。

如果数据库确认不存在真实 legacy rows，本 slice 不需要数据库迁移；旧 fixture 已在
前端代码中迁移。

## 14. Additional frontend contract requirements

### 14.1 Journey creation

`POST /journeys` 是本 slice 的核心入口。请求至少包含：

```ts
interface CreateJourneyInput {
  name: string
  description: string | null
  patternTemplateKey:
    | 'solo_component'
    | 'linear_sequence'
    | 'hub_and_spoke'
    | 'diamond_loop'
}
```

服务端必须原子生成 Journey identity、revision、timestamps、Pattern identity、Slots 和
Routes，并返回完整 `JourneyEditorDocument`，使前端可以直接导航到新 Journey Editor。
Pattern 模板选择发生在创建页面：左侧模板库用于比较，右侧显示真实拓扑预览；创建
按钮提交前不会生成 Journey。

### 14.2 Journey deletion is now required

由于 Pattern 创建后不可更换，“删除并重新创建”成为正式用户路径。因此原先“Journey
delete 可以仅因 CRUD 不对称而推迟”的结论不再成立。本 vertical slice 应增加：

```text
DELETE /journeys/{journey_id}
```

删除必须：

- 要求 `If-Match: "<revision>"`；成功返回 `204 No Content`；
- 明确为 destructive confirmation 后的操作；
- 通过数据库 cascade/事务删除 Journey-owned AgentWorkflows 和 owned rows；
- 不删除独立保存的 Templates；
- 保持 Workspace isolation；
- 成功固定返回 `204 No Content`，不返回 response body；
- stale revision 返回 `REVISION_CONFLICT`。

### 14.3 Pattern immutability error

普通 Journey save 若尝试改变 `pattern.id`、`kind` 或 `templateKey`，建议返回：

```text
409 STATE_CONFLICT
details.reason = PATTERN_IMMUTABLE
```

不要把它归为 Pydantic 字段错误，因为 payload 结构可能合法但违反 aggregate lifecycle
规则。

### 14.4 Updated minimum backend capability list

经本次审核冻结为：

```text
POST   /journeys
GET    /journeys
GET    /journeys/{journey_id}
PUT    /journeys/{journey_id}
DELETE /journeys/{journey_id}

GET  /journeys/{journey_id}/agents/{agent_id}
PUT  /journeys/{journey_id}/agents/{agent_id}

POST /journeys/{journey_id}/slots/{slot_id}/agent
POST /journeys/{journey_id}/slots/{slot_id}/commands/remove

GET /agent-templates
```

`GET /agent-templates` 是本 slice 的最小 Template 恢复能力，保证 occupied Slot removal
通过 `save_as_template_and_discard` 创建的 Template 在刷新后仍可加载。普通 Journey PUT
允许保留 Slot 并将 `agentId` 设为 `null`，但直接移除 occupied Slot 必须返回
`409 STATE_CONFLICT` 并要求调用 occupied-remove command。

明确移除：

```text
POST /journeys/{journey_id}/commands/replace-pattern
```

首个 slice 不增加 generic Agent delete、generic PATCH 或 replacement endpoint。
