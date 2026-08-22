# Optional Guardrail Single-Agent 交互与真实 API 实施计划

> Status: Implemented and verified against the Web API on 2026-08-22  
> Scope: Input/Output Guardrail inactive/active 状态、固定 Single 结构、Agent/Workflow 复用、删除与 HTTP persistence  
> Authoritative interaction brief: [`Tip.md`](./Tip.md)  
> Authoritative design: Figma `OdyJourney — Behavior Coming Soon`  
> Authoritative engineering guideline: [`frontend-engineering-guidelines.md`](../../../frontend-engineering-guidelines.md)  
> Related layout plan: [`system-configuration-grid-behavior-boundary-implementation-plan.md`](./system-configuration-grid-behavior-boundary-implementation-plan.md)

## 1. 已冻结的产品语义

- Journey 创建时只选择 Main Execution Pattern；
- Input Guardrail 与 Output Guardrail 相互独立，默认 inactive；
- Guardrail 不是用户可选 Pattern，其内部结构永远是固定 `single`；
- 点击 `Add` 原子创建一个 Guardrail Agent 及最小 `Start → End` Workflow；
- 每侧最多一个 Guardrail Agent；
- active Guardrail Agent 与普通 Slot Agent 使用一致交互：
  - 左键选中并展示 Workflow Preview；
  - 右键打开统一上下文菜单；
  - `Open workflow` 进入相同 Workflow Editor；
- Guardrail 菜单额外提供 `Remove guardrail`；
- Remove 直接删除 Guardrail Agent 与 Workflow，不保存 Template，完成后恢复 inactive；
- 前端只使用真实 Web API，不使用 mock、local-only aggregate 或刷新即丢失的临时事实源。

## 2. UI 状态

Guardrail persisted state 与 request/session state 必须分开。

### 2.1 Persisted projection

```ts
type GuardrailProjection =
  | { type: 'inactive' }
  | {
      type: 'active'
      structure: 'single'
      agentId: string
      agentSummary: AgentSummary
    }
```

实际 DTO/domain 类型以仓库 contract 为准；禁止通过 optional 字段组合出 `enabled=true` 但无 Agent 等非法状态。

### 2.2 UI-only operation state

```ts
type GuardrailOperationState =
  | { type: 'idle' }
  | { type: 'adding'; side: 'input' | 'output'; requestSeq: number }
  | { type: 'removing'; side: 'input' | 'output'; requestSeq: number }
  | { type: 'failed'; side: 'input' | 'output'; operation: 'add' | 'remove'; error: RepositoryError }
  | { type: 'conflict'; side: 'input' | 'output'; serverRevision: number }
```

selection、preview、context menu、loading 和 error 不进入保存 payload。

## 3. 视觉与交互契约

### 3.1 Inactive

- muted card；
- 标题 `Input Guardrail` / `Output Guardrail`；
- secondary label `Optional`；
- 居中圆形 `+` 按钮及 `Add` 文案；
- `+` 和 `Add` 属于同一个可访问操作目标；
- 不显示 Pattern 名、Pattern selector、拖拽入口或 linear chain。

### 3.2 Active

- 使用 active 模块的边框/强调语言；
- 只呈现一个 Agent Slot 视觉单元；
- 展示名称和配置状态；
- 左键 emit typed select intent；
- 右键与键盘 context-menu shortcut 打开统一菜单；
- 不为 Guardrail 创建独立 Workflow Preview 或 Editor 实现。

### 3.3 Remove

- 不显示常驻删除按钮；
- `Remove guardrail` 是上下文菜单中的 destructive secondary action；
- 确认界面明确会永久删除该 Agent 和 Workflow；
- 成功后关闭相关 preview/menu、清除 selection，并使用服务端最新 aggregate 恢复 inactive；
- 取消或失败时 canonical document 不变。

## 4. Application command 与 repository 边界

组件只发送 typed intents：

```ts
type GuardrailIntent =
  | { type: 'add-guardrail'; side: 'input' | 'output' }
  | { type: 'select-guardrail-agent'; side: 'input' | 'output'; agentId: string }
  | { type: 'open-guardrail-workflow'; side: 'input' | 'output'; agentId: string }
  | { type: 'remove-guardrail'; side: 'input' | 'output'; agentId: string }
```

Store/application orchestration：

```text
intent
→ validate current projection and operation state
→ call typed repository command with Journey id + revision
→ runtime-validate response
→ replace canonical aggregate with server response
→ update UI session / navigate only after success
```

禁止：

- 组件直接写 `enabled`、`agentId` 或 Journey JSON；
- 先在前端伪造 Agent/Workflow，再依赖普通 autosave 补偿；
- Add 使用多个独立 HTTP 请求拼装非原子结果；
- Remove 先本地清空，再在失败时尝试不完整回滚；
- 让旧请求响应覆盖更高 revision 的 aggregate。

## 5. API contract 预检与 blocker

编码前必须从 OpenAPI/typed repository 确认以下能力：

### Add guardrail command

单个原子请求必须完成：

- 校验 Journey revision；
- 校验目标 side 当前 inactive；
- 创建 Journey-owned Guardrail Agent identity；
- 创建最小 Start/End graph、edge 与初始 CanvasLayout；
- 绑定到 input/output Guardrail；
- 返回最新 Journey aggregate 和 revision。

### Remove guardrail command

单个原子请求必须完成：

- 校验 Journey revision、side 和 agentId；
- 删除绑定及 Journey-owned Agent/Workflow；
- 不创建 Agent Template；
- 返回最新 aggregate 和 revision（或以可立即重新 GET 的明确 contract 返回）。

### Error contract

至少区分：

- `NOT_FOUND`；
- `STATE_CONFLICT`（already active/inactive、agent mismatch）；
- `REVISION_CONFLICT`；
- `RESPONSE_INVALID`；
- `NETWORK_FAILED`。

若 API 不具备以上原子能力，本计划进入 blocked 状态：先输出后端契约补充清单，不以 mock 或普通 PUT 绕过。

## 6. 实施步骤

1. 核对 OpenAPI、shared schema、Journey DTO、repository port 与现有 Agent/Workflow command。
2. 冻结 Guardrail discriminated union、intent、repository input/result 与 runtime validator。
3. 在 store/application 层实现 add/remove orchestration、request sequence 和 revision conflict handling。
4. 实现 inactive/active presentational card，复用现有 Agent Slot 视觉。
5. 将 Agent 左键 selection/preview 与右键 menu 接到现有统一路径。
6. 增加 `Remove guardrail` 菜单能力与 destructive confirmation。
7. 成功响应替换 canonical aggregate；失败保持原 document 并提供可重试反馈。
8. 与统一 System Configuration grid 集成，不在 Guardrail 组件内控制页面宽度。

## 7. 测试矩阵

### 7.1 Domain/application/repository

- input/output 分别从 inactive Add 成功；
- 两侧可同时 active；
- active side 重复 Add 在 mutation 前拒绝；
- Add 返回的 Agent 包含合法最小 Start → End Workflow；
- response runtime validation 失败不污染 document；
- Remove 成功删除 Agent/Workflow 并恢复 inactive；
- inactive side Remove、agent mismatch 返回稳定错误；
- revision conflict 不被当作成功；
- 旧响应不能覆盖较新 aggregate；
- double click 只产生一个有效 command；
- request failure 后可以重试。

### 7.2 Component interaction

- inactive 卡片可通过鼠标和键盘 Add；
- loading 时 Add disabled 且有非颜色反馈；
- active Agent 左键 emit selection，不直接修改 persisted state；
- 右键和键盘均能打开菜单；
- Open workflow 只在 Agent 存在时导航；
- Remove 需要确认，取消不产生 repository call；
- Remove pending 时重复操作被阻止。

### 7.3 Browser E2E（真实 API）

- Add Input → 刷新 → 仍 active；
- Add Output → 刷新 → 仍 active；
- 双侧 active 可独立 preview/open；
- 新 Guardrail Workflow 确实包含 Start → End；
- Remove → 刷新 → 仍 inactive，旧 Agent/Workflow 不可访问；
- conflict、network failure 和重试路径具有稳定反馈；
- 全流程无 mock request 或 local-only fallback。

## 8. 验收标准

- 用户无法为 Guardrail 选择或替换 Pattern；
- Add/Remove 均通过真实、原子、revision-aware API；
- 每侧严格为 inactive 或 single-agent active 两种合法持久化形态；
- Agent Preview、Open Workflow 和上下文菜单复用普通 Agent 路径；
- Remove 永久删除 Agent/Workflow，不保存 Template；
- loading、error、conflict、retry 和 stale response 均被处理；
- lint、typecheck、unit/component/integration/browser tests 与 build 通过。

## 9. 实施验证记录

- HTTP repository 已接入 Guardrail add/remove command，并在边界执行 runtime validation；
- Journey store 使用独立 Guardrail operation/interaction state，成功时以服务端 aggregate 替换 canonical document；
- inactive/active、右键菜单、删除确认与 Workflow Editor 导航已实现；
- 真实 API 验证覆盖 Add、刷新持久化、Open workflow（最小 `2 nodes · 1 edge`）与 Remove 后恢复 inactive；
- 后端 nullable `sourceHandleId` 在 shared schema boundary 规范化为 canonical optional value；
- shared schema tests、frontend lint、typecheck、212 项 frontend tests 和 production build 全部通过。
