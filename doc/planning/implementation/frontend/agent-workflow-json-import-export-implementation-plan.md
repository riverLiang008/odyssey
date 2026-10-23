# Agent Workflow JSON Import / Export 实施计划

> Status: Complete — Batches A–E complete  
> Scope: Agent Workflow 可移植快照、导入校验与编辑器工具菜单  
> Depends on: 当前 Agent Workflow canonical schema、Workflow Store、autosave/revision CAS  
> Primary outcome: 用户可以安全导出当前 Workflow，并在不绕过校验和并发保护的前提下恢复或导入 JSON

## 1. 背景与目标

当前 Agent Workflow 的配置已包含 graph、nested Loop、Canvas layout、variables、Reusable Tools、System Tool 配置以及 Knowledge Space 引用。配置过程较长，仅依赖服务器当前版本不利于演示数据准备、人工备份和跨案例复用。

本阶段增加一个位于 Canvas 右上角的 Workflow 工具菜单：

```text
Flow / Configure    …    Focus Mode
                     ├─ Import workflow JSON
                     └─ Export workflow JSON
```

完成后应满足：

- Export 下载当前编辑器中的完整 canonical Workflow 快照；
- Import 在浏览器边界完成严格解析、schema 校验和领域校验；
- Import 不直接修改 Vue Flow view model；
- 用户确认后，通过一个 store command 原子替换当前 Agent 的 Workflow 文档内容；
- 替换结果继续使用现有 autosave、revision CAS、failure retry 和 conflict recovery；
- 无效、过期或引用不完整的文件不能造成部分修改；
- 该菜单可以在未来容纳 Validate、Reset layout、Duplicate 等工具。

## 2. 当前能力审计与技术决策

当前 `saveAgentWorkflowInputSchema` 已保存：

- `workflow`；
- `layout`；
- `variables`；
- `reusableTools`；
- `expectedRevision`。

当前后端 `PUT Agent Workflow` 已提供 revision CAS，成功后返回新 revision。因此 V1 不新增 import/export API，也不新增数据库表或 migration。

冻结决策：

1. Export 是浏览器生成并下载 JSON，不请求后端创建文件。
2. Import 是当前 Agent 上的 destructive replacement，不创建新 Agent。
3. 导入文件中的 source Journey/Agent identity 仅用于展示和诊断，不覆盖当前路由 identity。
4. 导入文件不包含 revision、updatedAt 或 UI session state。
5. 导入成功后使用当前目标 Agent 的 server revision 进行一次正常 CAS save。
6. Tool/Knowledge Space 资产不随文件复制：Reusable Tool definition 属于 Agent 文档，随快照导出；Knowledge Space 只保留引用 ID。
7. V1 定位为同一 Workspace 内的备份/恢复和 Demo seed，不宣称跨 Workspace 完全可移植。

## 3. JSON 文件合同

新增共享、严格、可版本化的 export envelope schema。建议 V1 形态：

```json
{
  "kind": "odyssey.agent-workflow",
  "formatVersion": 1,
  "exportedAt": "2026-10-18T06:00:00.000Z",
  "source": {
    "journeyId": "00000000-0000-0000-0000-000000000000",
    "agentId": "00000000-0000-0000-0000-000000000000",
    "agentName": "Research Agent"
  },
  "document": {
    "workflow": {},
    "layout": {},
    "variables": [],
    "reusableTools": []
  }
}
```

要求：

- 使用 `z.strictObject`；未知字段默认拒绝，不静默吞掉拼写错误；
- `kind` 和 `formatVersion` 是格式路由键；
- `workflow` 继续使用 `workflowGraphSchema`；
- `layout` 继续使用 `canvasLayoutSchema`；
- `variables` 和 `reusableTools` 继续复用 canonical schemas；
- `source` 不参与导入目标选择；
- 不导出 selection、panel、mode、focus、context menu、drag state、save state；
- 不导出 Journey Pattern 或其他 Agent；
- JSON 输出使用稳定缩进和确定性字段顺序，便于 Git diff 和人工 review。

### 3.1 文件名

```text
odyssey-workflow-<safe-agent-name>-<YYYY-MM-DD>.json
```

文件名必须移除路径字符和控制字符，不直接信任 Agent display name。

### 3.2 敏感信息提示

Workflow 中的 Tool 配置可能包含 URL、header、prompt 或 literal values。Export 菜单和导入预览必须提示：

> Workflow JSON may contain configured values. Review it before sharing.

实现不得在 console、telemetry、toast 或错误 details 中记录完整 JSON、prompt、header value 或文档内容。

V1 不实现自动 secret redaction，因为自动删除字段会破坏备份的可恢复性；后续若引入正式 Secret 类型，再通过 schema-aware redaction 提供单独的 sanitized export。

## 4. 导出语义

Export 读取当前 store 中的 canonical document，而不是上一次服务器快照。因此尚未完成 autosave 的本地合法编辑也能被备份。

流程：

```text
current AgentWorkflowEditorDocument
  → pick canonical export fields
  → export-envelope schema parse
  → JSON.stringify(..., null, 2)
  → Blob/Object URL
  → browser download
  → revoke Object URL
  → success toast
```

导出失败不修改 document 或 persistence state。文件生成和 DOM download 由 browser adapter 承担，纯 serializer 不访问 DOM。

## 5. 导入状态与交互

Import 使用显式状态联合，禁止散落多个 boolean：

```ts
type WorkflowImportState =
  | { type: 'closed' }
  | { type: 'reading'; fileName: string }
  | { type: 'invalid'; fileName: string; issues: readonly WorkflowImportIssue[] }
  | { type: 'ready'; fileName: string; candidate: WorkflowImportCandidate; summary: WorkflowImportSummary }
  | { type: 'applying'; fileName: string; summary: WorkflowImportSummary }
  | { type: 'failed'; fileName: string; error: WorkflowImportError }
```

### 5.1 文件选择

- 仅接受 `.json`；
- V1 文件大小上限冻结为 5 MiB；
- 使用 `<input type="file">`，不得从任意路径读取；
- FileReader/Text API 异常映射为稳定错误；
- 重复选择同名文件仍应触发读取；
- dialog 关闭或组件 dispose 后，迟到的读取结果不得更新新 session。

### 5.2 校验顺序

```text
file extension / size
  → JSON.parse
  → envelope kind + formatVersion
  → strict Zod runtime validation
  → graph/layout/domain invariants
  → internal reference validation
  → current Workspace external reference validation
  → preview
```

至少校验：

- node/edge/placement ID 唯一；
- edge 端点和 Branch handle 存在；
- layout 只引用存在 node；
- Start/End 和 DAG invariant 合法；
- Loop body graph/layout 合法；
- Variable 和 Reusable Tool 引用存在；
- Task local variable/output binding 合法；
- Agent Action 引用的 Reusable Tool 存在于导入文档；
- Knowledge Space ID 在当前 Workspace inventory 中存在。

V1 对缺失 Knowledge Space 引用采用阻止导入策略，不静默删除或保留 broken reference。错误预览列出缺失数量和 ID 的截断形式；不得泄漏其他 Workspace 资源是否存在。

### 5.3 导入预览

确认前展示：

- source Agent name；
- exportedAt；
- root nodes / edges；
- nested Loop 数量；
- variables；
- reusable tools；
- Knowledge Space references；
- 将替换当前 Agent Workflow 的明确警告；
- 敏感配置提示。

按钮：

- `Cancel`；
- `Import and replace`。

确认按钮必须是明确 destructive action，不使用普通主按钮文案模糊表达。

## 6. 原子替换与 autosave/revision

新增 store action，例如：

```ts
replaceWorkflowFromImport(candidate: WorkflowImportDocument): WorkflowImportResult
```

该 action 必须：

1. 在 mutation 前重新运行权威 domain validation；
2. 一次性构造新的 `AgentWorkflowEditorDocument`；
3. 保留当前目标 Agent identity、revision、createdAt、updatedAt；
4. 原子替换 workflow、layout、variables、reusableTools；
5. 重置 selection、panel、expanded Loop、creation draft 和 context menu 等相关 session；
6. 标记一次 dirty mutation；
7. 立即进入现有 save pipeline，不建立第二套 import persistence；
8. 失败时不留下部分 graph/layout 替换。

### 6.1 与 pending save 的协调

- `saving` 时禁用最终确认，等待当前 request 完成；
- `conflict` 时阻止导入，要求先解决 conflict；
- `dirty/failed` 时允许打开和验证文件，但最终确认必须说明当前未保存配置将被替换；
- 确认替换时取消尚未触发的 debounce timer；
- 导入保存仍使用当前目标 revision；
- 若发生 `REVISION_CONFLICT`，保留已导入的本地 document，并进入现有 conflict recovery；
- network failure 保留已导入的本地 document，可使用现有 Retry；
- stale response 不得覆盖导入后的 document。

Import 是一个 application transaction，不允许组件分别写 graph、layout、variables 和 tools。

## 7. UI 设计

### 7.1 工具菜单

在 `.workflow-canvas-controls` 中将顺序冻结为：

```text
[Flow | Configure] […] [Focus]
```

`…` 按钮：

- 与 Focus 按钮使用相同尺寸、边框、圆角和 focus ring；
- `aria-label="Workflow tools"`；
- `aria-haspopup="menu"`；
- `aria-expanded` 反映菜单状态；
- 支持 Enter/Space 打开、Escape 关闭；
- 点击外部关闭；
- 关闭后焦点返回 `…` 按钮。

菜单项：

1. `Import workflow JSON`；
2. `Export workflow JSON`。

菜单作为通用 `WorkflowToolsMenu` 展示组件，不在模板中直接实现文件解析或 store mutation。

### 7.2 Dialog 与 toast

- 文件读取和预览使用 modal dialog；
- modal 具备 focus trap、Escape、返回焦点；
- success 使用统一自动消失 toast；
- validation failure 在 dialog 内持久展示，toast 不作为唯一错误信息；
- import save failure/conflict 复用现有持久化错误 UI；
- Focus Mode 中菜单、dialog、toast 均可用。

## 8. 代码边界建议

```text
packages/schemas/src/workflow/
  workflowExport.ts                 # versioned strict envelope schema
  workflowExport.test.ts

apps/web/src/domain/workflow-import/
  workflowImport.ts                 # pure parse/validate/summary/replace candidate
  workflowImport.test.ts

apps/web/src/features/workflow-editor/
  WorkflowToolsMenu.vue             # presentational menu
  WorkflowImportDialog.vue          # file/preview state shell
  workflowImportFileAdapter.ts      # File/Blob/download boundary
  WorkflowToolsMenu.test.ts
  WorkflowImportDialog.test.ts

apps/web/src/stores/workflowEditor.ts
  replaceWorkflowFromImport(...)    # single application command
```

边界规则：

- schemas 不依赖 Vue、Pinia、DOM 或 repository；
- domain parser 接受 `string/unknown`，不接受 `File`；
- browser adapter 不包含领域判断；
- component 只发 intent；
- store 负责原子替换、session cleanup 和 persistence orchestration；
- Vue Flow node/edge view model 不进入 export 文件；
- 后端继续只接收现有 canonical save DTO。

## 9. 稳定错误模型

建议错误码：

```text
FILE_TYPE_UNSUPPORTED
FILE_TOO_LARGE
FILE_READ_FAILED
JSON_INVALID
EXPORT_KIND_UNSUPPORTED
EXPORT_VERSION_UNSUPPORTED
EXPORT_SCHEMA_INVALID
WORKFLOW_INVALID
REFERENCE_MISSING
IMPORT_BLOCKED_BY_SAVE
IMPORT_BLOCKED_BY_CONFLICT
DOWNLOAD_FAILED
```

错误包含结构化 issues，例如 `{ path, code }`；最终英文文案由 UI 映射。不得使用 Zod message 或异常字符串作为业务控制流。

## 10. 测试策略

### 10.1 Schema / domain tests

- valid V1 round-trip；
- unknown field rejected；
- wrong kind/version rejected；
- invalid JSON；
- graph/layout/Loop invariant failure；
- missing variable/tool/Knowledge Space reference；
- source identity 不覆盖目标 identity；
- serializer 不包含 revision 和 session state；
- input object 未被 mutation；
- deterministic serialization。

### 10.2 Store tests

- import 原子替换四个 canonical fields；
- 保留当前 Agent identity/revision；
- 相关 UI session 被清理；
- 只增加一次 mutation sequence；
- 自动触发一次 save；
- saving/conflict precondition；
- import 后 save failure 保留本地导入结果；
- import 后 conflict 进入现有 recovery；
- stale save response 不覆盖 imported document；
- invalid candidate 零 mutation。

### 10.3 Component tests

- 菜单键盘打开/关闭和焦点返回；
- Import/Export intent；
- 文件类型和大小反馈；
- preview counts；
- destructive confirmation；
- loading/invalid/ready/applying/failed states；
- success toast 自动消失；
- Focus Mode 可访问。

### 10.4 Browser acceptance

```text
配置 root + Loop + variables + Reusable Tool + KB
→ Export
→ 修改当前 Workflow
→ Import 刚导出的文件
→ 确认替换
→ 等待 Saved
→ reload 页面
→ graph/layout/config/resources 等价
```

额外验证：

- invalid JSON 不改变画布；
-缺失 KB 引用被阻止；
- import 时网络失败后 Retry；
-两个浏览器 session 制造 revision conflict；
- 1024×900 和 1440×900；
-菜单不遮挡 mode/focus controls；
- console 无 warning/error。

## 11. 实施批次与 ToDo

### Batch A — Contract 与纯函数

- [x] 新增 V1 export envelope schema 和类型导出；
- [x] 实现 canonical serializer；
- [x] 实现 parse/validate/summary pipeline；
- [x] 实现内部引用检查和 Knowledge Space inventory 检查；
- [x] 完成 schema/domain tests；
- [x] 提交一份最小可用 Demo JSON fixture。

Gate：任何外部 JSON 都不能未经 runtime/domain validation 进入 store。

### Batch B — Store 原子替换与 persistence

- [x] 新增 `replaceWorkflowFromImport` application command；
- [x] 清理受影响的 UI-only session；
- [x] 接入 mutation sequence 和 autosave；
- [x] 协调 saving/dirty/failed/conflict 状态；
- [x] 完成 store race 与 failure tests。

Gate：导入要么完整替换并进入现有保存管线，要么零 mutation。

### Batch C — 工具菜单与 Export

- [x] 在 mode toggle 与 Focus 按钮间新增 `…`；
- [x] 实现可复用、可键盘操作的 `WorkflowToolsMenu`；
- [x] 实现 browser download adapter；
- [x] 加入敏感配置提示和 success toast；
- [x] 完成菜单与 export component tests。

Gate：当前本地 canonical state 可以下载，菜单在普通模式和 Focus Mode 均可用。

### Batch D — Import Dialog 与确认

- [x] 实现文件选择和读取状态机；
- [x] 实现错误详情和 preview summary；
- [x] 实现 destructive confirmation；
- [x] 接入 store import command；
- [x] 接入 retry/conflict UI；
- [x] 完成 accessibility/component tests。

Gate：无效文件、取消和校验失败均不改变 document。

### Batch E — 集成验收与文档

- [x] 完成真实浏览器 export → mutate → import → save → reload；
- [x] 验证 network failure 和 revision conflict；
- [x] 验证 responsive/focus/keyboard；
- [x] 运行 lint、typecheck、tests、production build；
- [x] 编写 completion report 和用户验收清单；
- [x] 将 Demo fixture 纳入案例设计流程。

Gate：可重复恢复复杂 Workflow，刷新后与导出快照等价。

## 12. 明确不在 V1 范围

- 跨 Workspace 自动复制 Knowledge Space；
- 自动创建缺失 Tool/KB；
-多 Agent/Journey 整包导入导出；
- merge 当前 Workflow 与导入 Workflow；
- JSON 在线编辑器；
-加密备份、云端备份历史或版本管理；
- secret redaction export；
-旧格式自动猜测或静默迁移；
-后端 import/export endpoint；
-导入时创建新的 Agent。

## 13. Definition of Done

只有以下条件全部满足才可视为完成：

1. V1 export contract 版本化、strict 且有 runtime validation；
2. Export 包含完整 canonical Workflow，排除 identity/revision/session；
3. Import 在 mutation 前完成 schema、domain 和 external reference 校验；
4. Import 使用一个 store command 原子替换；
5. Import 继续使用现有 CAS/autosave/conflict pipeline；
6. failure/conflict 不造成静默数据丢失或部分状态；
7.菜单、dialog、toast 在普通模式和 Focus Mode 可访问；
8. invalid/unsupported/missing-reference paths 有测试；
9.真实浏览器 round-trip 刷新后等价；
10. lint、typecheck、tests、production build 全绿；
11. Demo JSON fixture 可用于首个案例协同迭代。

## 14. 已知风险与缓解

| 风险 | 缓解 |
| --- | --- |
| JSON 含敏感 Tool 配置 | 导出前明确提示；禁止日志记录内容；后续提供 sanitized export |
| 导入文件来自旧版本 | `kind + formatVersion` fail closed；未来显式 migration registry |
| Knowledge Space ID 在目标 Workspace 不存在 | V1 阻止导入并列出缺失引用 |
| import 与 autosave 竞态 | store command + existing single-flight/CAS；saving 时禁止确认 |
| 大文件冻结 UI | 5 MiB 上限；解析/校验阶段显示 reading 状态；后续可迁移 Worker |
| source identity 覆盖当前 Agent | source metadata 永不进入 save DTO；目标 identity 只来自当前 route/store |
| 部分替换造成 graph/layout 不一致 | candidate 全量验证后一次赋值；不按字段逐步 mutation |

## 15. Completion report（2026-10-18）

实现结果：

- V1 strict export envelope、serializer、parser、摘要和 Demo fixture 已落地；
- Workflow Store 通过单一 command 原子替换 canonical document，并复用 autosave/CAS/conflict recovery；
- Canvas 工具菜单支持 Export 下载和 Import 文件选择、校验、预览与 destructive confirmation；
- `.json` 扩展名、5 MiB 上限、异步迟到结果、缺失 KB 引用、saving/conflict blocking 均有明确处理；
- 菜单、dialog、toast 支持键盘、焦点恢复和 Focus Mode。

自动验证：

- schemas：86 tests passed；
- web：454 tests passed；
- ESLint、TypeScript typecheck、production build passed；
- network failure、revision conflict、stale save response 和 atomic replacement 由 store/component tests 覆盖。

真实浏览器验收：

1. 在 1024×900 导出当前 `Agent 1`，成功下载 `odyssey-workflow-agent-1-2026-10-18.json`；
2. 将 Goal 临时改为 `temporary acceptance mutation` 并等待保存；
3. 重新导入刚导出的 JSON，预览显示 source Agent、3 nodes、1 edge 和资源统计；
4. 确认替换后等待 `Saved`，Goal 恢复为空；
5. 刷新页面后 Goal 仍为空，证明替换已持久化；
6. 1440×900 Focus Mode 中工具菜单正常显示；
7. 浏览器 console 无 warning/error。

用户验收清单：

- 从 `…` 菜单分别打开 Import 和 Export；
- 检查下载文件名与敏感配置提示；
- 导入有效 JSON，确认摘要和替换警告；
- 尝试无效 JSON、超过 5 MiB 的 JSON 和缺失 KB 引用的 JSON；
- 确认导入、等待 Saved、刷新后检查 graph/layout/config/resources；
- 在 Focus Mode 中再次打开菜单和导入弹窗。

