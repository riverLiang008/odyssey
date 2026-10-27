# M6 Knowledge Space completion report

日期：2026-10-24
状态：Knowledge Space 主链与 Workflow 回接完成；非目标执行能力继续留在后续里程碑。

## 本轮收口

- Canvas `Knowledge Spaces` 资源面板与 Knowledge Retrieval Tool 共用正式 Knowledge Space inventory。
- 可引用状态集中为 `ready/syncing` 且 `healthy/needs_review`；Canvas drop、Agent Action、Task Tool 与 Reusable Tool 使用同一规则。
- Workflow 保存由后端在当前 Workspace 内重新校验引用：不存在或跨 Workspace 返回 `NOT_FOUND`，不可用状态返回 `STATE_CONFLICT / KNOWLEDGE_SPACE_UNAVAILABLE`。
- root、Loop child、Task ToolStep 与 Agent Reusable Tool 的 Knowledge Space 引用均进入 canonical aggregate，并同步持久化 reference rows。
- PostgreSQL 集成测试覆盖引用同步、清理、不可用状态、跨 Workspace、回滚和并发 CAS。

## 浏览器证据

在真实 Web API 与 PostgreSQL 环境中，使用 Journey `Knowledge QA`：

1. 新建 Task，并从系统工具列表添加 Knowledge Retrieval；
2. 从正式 inventory 选择 `Moonberry Island Guide`，设置 query 为 `moonberry`；
3. 显式保存 Agent workflow；
4. 整页刷新后重新打开 Tool 配置，确认 Knowledge Space 与 query 均回显，顶部状态为 `Saved`。

验收过程中确认“保存 Tool 草稿”与“保存 Agent workflow”是两个明确步骤；只完成前者不会被记为持久化成功。

## 门禁

- Frontend：新增 Knowledge Space availability 纯函数与 9 个状态组合测试；Canvas、资源面板、Tool 配置和 Store 统一复用。
- Backend：Ruff 通过；完整 pytest 通过；Knowledge Space PostgreSQL 专项测试通过。
- Browser：真实 inventory → Knowledge Retrieval → save → refresh happy path 通过。

## 保留范围

- Document Curator、Knowledge Steward、embedding/vector search 与自动语义索引不属于本里程碑。
- 模型 inventory、System Variable inventory 与剩余 Canvas 视觉校准按各自计划继续推进。
