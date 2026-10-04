# System / Built-in Tools 第一批交付报告

日期：2026-10-04。

## 实现范围

System Tool 只作为 Task 内有序 ToolStep 配置。没有增加 Workflow Node kind，也没有修改 Agent Action 的 canvas-inline model/goal 配置交互。没有执行任何脚本、外部 API 或模型调用。

实现包含：只读生产 inventory、四态资源浏览器、专用 DnD union、Task-only preflight、右侧浮动配置草稿、原子保存、重新编辑、删除和上下移动排序。Flow 模式在 preflight 和 Tool command 两层拒绝修改。取消和错误不递增 mutation sequence。根 Task 与 Loop 内 Task 显式携带 context。

## API 合同

`GET /api/v1/tool-definitions` → `ToolDefinitionResponse[]`。

每项字段：`id`（UUID）、`kind`（五类 canonical enum）、`source`（`built_in`）、`name`、`category`、`description`（可 null）、`configurationSchema`、`inputSchema`、`outputSchema`（JSON object）。

通过服务端 CurrentWorkspace dependency 获取 Workspace；SQL 要求 Workspace 存在，definitions 为全局 built-in。拒绝未声明 query，包括客户端 `workspaceId`。按 `category, name, kind` 稳定排序。API 只读，没有新增写入路由或数据库迁移。严格 DTO 在 ORM boundary 显式组装，不返回 ORM。前端 HTTP repository 使用 Zod runtime validation。

Bootstrap 保持原有五条定义和幂等行为，不覆盖已有数据。三个 `{type: "object"}` schema 原样作为描述性 metadata 返回，**不用于判断配置有效性**。配置仍以 `packages/schemas/src/workflow/tools.ts` 和已有 Python ToolStep DTO 为合同；新增共享 `packages/schemas/fixtures/system-tools.json`，两端执行相同的五类合法/非法例子，避免复制一套未经验证的 schema。完整机器可执行 inventory JSON Schema 的生成与迁移未包含在本批。

## 配置支持矩阵

| Kind | 配置 | Output mapping |
| --- | --- | --- |
| knowledge_retrieval | 真实 Workspace Knowledge Space、query（静态/变量/模板）、topK（默认 5） | retrieved_documents |
| script_execution | python/javascript、带唯一 alias 的 inputs、script | result |
| api_request | GET/POST/PUT/DELETE、url、headers、none/json/form_data body | response.data |
| set_variable | writable target、assign/append/increment/toggle、value（toggle 不携带） | null |
| llm_call | model identifier、optional systemPrompt、prompt | response.text |

全部支持 optional label、retry once / fail task。变量选择来自已加载 Agent variables 与目标 Task 自有 localVariables；禁止跨 Task 引用和写入 readOnly variable。Knowledge Space 另行加载完整分页 inventory，避免只允许资源浏览器当前页的 ID。现有合法步骤可恢复原始配置。

Model 当前为 identifier 文本输入：项目没有正式模型 inventory，不伪造模型列表。系统变量同样不伪造 inventory。New Task Variable 本批禁用并显示原因，组件不直接 push 持久化变量。

## 本批修改文件

后端新增：
- apps/api/src/odyssey_api/tools/__init__.py
- apps/api/src/odyssey_api/tools/dto.py
- apps/api/src/odyssey_api/tools/repository.py
- apps/api/src/odyssey_api/tools/service.py
- apps/api/src/odyssey_api/tools/router.py
- apps/api/tests/test_system_tools.py

后端修改：
- apps/api/src/odyssey_api/main.py
- apps/api/tests/test_openapi_contract.py

共享合同和 parity：
- packages/schemas/src/toolDefinitions.ts
- packages/schemas/src/index.ts
- packages/schemas/src/systemTools.test.ts
- packages/schemas/fixtures/system-tools.json

前端 repository / domain / store：
- apps/web/src/repositories/editorRepository.ts
- apps/web/src/repositories/httpEditorRepository.ts
- apps/web/src/repositories/inMemoryEditorRepository.ts
- apps/web/src/repositories/systemTools.test.ts
- apps/web/src/domain/workflow/systemToolCommands.ts
- apps/web/src/domain/workflow/systemToolCommands.test.ts
- apps/web/src/stores/workflowEditor.ts
- apps/web/src/stores/workflowEditor.test.ts
- apps/web/src/stores/systemTools.test.ts
- apps/web/src/canvas/workflow/workflowCanvasIntents.ts

前端 UI：
- apps/web/src/features/workflow-editor/SystemToolPanel.vue
- apps/web/src/features/workflow-editor/ToolValueInput.vue
- apps/web/src/features/workflow-editor/systemTools.test.ts
- apps/web/src/features/workflow-editor/WorkflowResourceBrowser.vue
- apps/web/src/features/workflow-editor/WorkflowNodeRenderer.vue
- apps/web/src/features/workflow-editor/WorkflowCanvas.vue
- apps/web/src/features/workflow-editor/InlineLoopCanvas.vue
- apps/web/src/views/AgentWorkflowView.vue
- apps/web/src/assets/tool-output-arrow.svg（指定 Figma 节点原始 20×20 SVG）

仓库已有大量未提交实现；以上只列本批实际修改的文件，没有重置既有改动。

## 验证

- 完整读取前后端工程规范、两份 Tool 产品规格、Figma information architecture。
- 已读取 Figma 177:33、182:33、183:33、185:33、189:33、98:2 上下文及截图。
- pnpm typecheck：通过。
- pnpm test：共享 schemas 69 tests、Web 362 tests 通过。
- pnpm lint：最终复验通过。
- pnpm build：最终复验通过。
- uv run ruff check .：通过。
- uv run pytest：102 passed；1 条已有 Starlette/httpx deprecation warning。

后端使用实际运行的 PostgreSQL：`127.0.0.1:55432`（仓库 compose.local.yaml 的端口）。最初使用 .env 的 5432 连接被拒绝；按既有本地覆盖配置重跑后全通过。

新增测试包括五类 parsing/关键 invalid schema、inventory loading/empty/error/loaded、五类表单、有效/非法 Task drop、Canvas/Agent Action 拒绝、Flow 拒绝、取消零变更、save 原子提交、edit/delete/reorder、五类步骤保存/重新加载、nested context 隔离、invalid operation sequence 不变、保存 payload 不含 Vue Flow 临时字段。

## 浏览器手工验收数据

验收页面：
http://127.0.0.1:4174/journeys/7fdacb0e-0061-4a24-a58c-aa0d692ec730/agents/8788d1a9-1f1b-4afc-88eb-bf7bfd6afac7

独立验证 API 为 8201，未中断已有 8200 服务。

- Journey：7fdacb0e-0061-4a24-a58c-aa0d692ec730
- Agent：8788d1a9-1f1b-4afc-88eb-bf7bfd6afac7
- Task：b6cf0755-8c42-4ec8-b146-7d9b3d6076b6
- Agent variable：2a6ac6e2-b214-494c-96c5-9c09c0d79b60（agent.tool_result）
- API step：5c63120c-113a-403d-9e3a-35c6d75cc721
- Script step：a9f4e9cc-9b4b-467f-a225-f1d0fd19b0e5
- Set Variable step：557c235d-4b7e-40de-8019-bf25398d37dc
- LLM step：6aef5948-b82d-4f21-9ce7-5c09b1dca991

通过真实浏览器验证 inventory、Canvas invalid drop、System Tool → Task 有效拖放、取消后 Task 为空、四类工具保存、重新编辑、排序、Flow 入口禁用、刷新恢复顺序与配置。刷新后顺序为 API edited → Script → Set Variable → LLM。

Knowledge Retrieval 浏览器验证了真实空态与不能选择不存在的 Knowledge Space。当前 Workspace inventory 为空，因此未声称完成真实 Knowledge Retrieval happy-path 浏览器验收；其合法配置、不可用引用和 PostgreSQL 知识引用行为由自动测试覆盖。没有伪造可用知识库。

验收 Journey/Agent 是本次新建，变量只通过正式 workflow 保存 API 写入这份新数据。未清理或删除用户现有验收数据。

## 推迟范围

- Tool execution runtime、community marketplace、Tool Template / reusable Tool CRUD。
- Agent Action Toolbox 从 definition 实例化 reusable Tool。
- Secret/auth manager、高级模型参数、并行/条件执行、Tool 级 branch/loop。
- 新建 Task Variable command/UI、模型与系统变量 inventory。
- 可执行的 inventory JSON Schema 生成/升级。

以上未实现能力不伪装为可用功能。
