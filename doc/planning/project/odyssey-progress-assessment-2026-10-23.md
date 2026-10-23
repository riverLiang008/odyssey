# Odyssey 开发进度评估：Done & ToDo

日期：2026-10-23。评估对象：当前工作区，包含未提交与未跟踪文件，不仅是 HEAD。

## 总体判断

Odyssey 已具备可持久化的配置型产品主干：Journey → Pattern/Slot → Agent Workflow → 节点与资源配置 → autosave → reload。它已超出 M2 交互验证，横向覆盖 M3–M6，但尚未满足完整 V1 及 M7 Demo Ready 的交付标准。

当前最主要的缺口是 immutable Workflow Version、Knowledge Graph 的真实交互界面，以及近期编辑器增量的浏览器与 HTTP 集成验收。代码量和历史测试通过次数不能替代这些验收。

V1 总计划明确不包含执行引擎；不能把没有运行能力算成 V1 逾期待办，也不能把可保存的 Tool/Workflow 配置算成已经能够执行。首个 Knowledge Q&A 案例目前仍是案例设计。

## Done：已有实现与证据

| 模块 | 已落地能力 | 判定与边界 |
| --- | --- | --- |
| 工程基础 | pnpm monorepo、Vue/TypeScript、FastAPI、PostgreSQL、Alembic、MinIO adapter、开发启动/停止脚本、CI 定义 | 基础齐备；CI 定义存在不等于最近一次 CI 已通过 |
| 共享合同 | Zod/Pydantic、fixtures、graph/layout 分离、repository runtime validation | 有合同和测试基础；新增合同仍需双端同步 |
| Journey / Pattern | 列表、创建、加载/保存/删除；内建 Pattern strategy；Slot 与 Agent 操作；模板实例化和保存 | 真实 HTTP 持久化已实现；Journey 搜索、状态筛选和排序控件仍禁用 |
| Workflow | Start/End、Task、Agent Action、Branch、Loop、节点与边、配置、验证、Flow/Configure、Focus Mode | 核心可用；Loop compound、Branch 新视觉与 Preview 更新尚有验收缺口 |
| 保存可靠性 | debounce、single-flight、mutation/request/snapshot 序号、失败重试、冲突恢复、离开保护 | M2.9 有真实 API/browser 记录；近期增量还需组合回归 |
| Variables / Tools | Agent Variable 管理、五类 System Tool 配置、Reusable Tools、引用保护、Task step 排序、root/Loop binding | 配置能力已有；不执行 Tool，model/system-variable inventory 尚缺 |
| Pattern → End | Pattern 单向拥有 root End、Hub 方向、稳定 Slot 引用、影响确认、事务/CAS、模板及 JSON 映射 | 2026-10-22 完成报告有 PostgreSQL 和浏览器证据；广泛并发组合矩阵尚未完成 |
| Workflow JSON | 导入/导出、边界验证、owned ID remap、出口映射、store 原子应用 | 计划标记 A–E 完成；不能代替版本历史 |
| DSL Edit | parser/compiler/printer、诊断定位、Format/Apply/Revert、Canvas 双向同步、stale/dirty guard | 首版集成；浏览器证明使用 InMemory repository，真实 HTTP save/reload/conflict 待验收 |
| Knowledge Space | 创建/列表/详情/更新/归档/恢复/删除、分类 list/create、文件树、上传、文档预览和 Markdown 编辑、文件 move/delete | 资产和文件主链路已有；目录管理、rename、上传补偿及完整验收尚缺 |
| Graph 数据 | Graph read projection、Manifest Validate/Preview/Apply、checksum/token/revision、持久化 metadata/relation/issue | 前端 Graph 仍显示文档/关系统计占位，不能宣称交互式知识图谱完成 |

主要依据：

- [V1 总计划](../implementation/v1-implementation-plan.md)
- [M2.9 完成报告](../implementation/frontend/m2.9-completion-report.md)
- [Pattern → End 完成报告](../implementation/pattern-agent-end-routing-completion-report.md)
- [DSL 首版集成报告](../implementation/DSL/dsl-edit-first-integration-report.md)
- [Knowledge Space 工作清单](../implementation/knowledge-space-frontend-backend-todo.md)
- [System Tools 工作清单](../implementation/system-tools-second-batch-frontend-backend-todo.md)

## ToDo：建议优先级

### P0：收口当前增量与交付基线

1. **建立可复现基线**：整理当前大量未提交/未跟踪变更，按可独立验证的功能分批提交；保留既有用户修改。当前 tracked diff 已涉及 81 个文件，尚不包含新增文件。
2. **修复质量门禁**：后端 `ruff format --check .` 发现 `tools/router.py`、`tests/test_workflow_domain.py` 两处格式不合规；只读评估未修改它们。
3. **完成最新编辑器验收**：Loop compound 的 resize/drop/selection、非法嵌套与 JSON round-trip；Branch 真实浏览器视觉；Preview 动态高度、缩放、留白、端口和特殊连线裁切。
4. **补 DSL 真实 HTTP 验收**：Apply → autosave → reload、revision conflict、切换路由和未应用草稿保护；覆盖 1024/1440 桌面宽度。InMemory 验收不能证明 PostgreSQL 持久化。
5. **落实持续集成环境**：CI 的 API job 直接执行完整 pytest，但未声明 PostgreSQL service 或迁移步骤；仓库有真实 PostgreSQL integration tests。需提供明确数据库环境、bootstrap/migration 和可复现结果。

### P1：补齐 V1 明确承诺的闭环

1. **Workflow Version**：冻结 immutable snapshot 合同，落地表/迁移、create/list/restore API、前端历史与恢复确认，覆盖 CAS 和事务回滚。当前 `Save now` 保存 working draft；源码未找到 Workflow Version 的实现链路。
2. **Knowledge Graph 界面**：独立只读 adapter、pan/zoom/fit、selection、节点 Inspector、Document Detail 导航与返回状态恢复，以及 metadata 编辑。
3. **文件管理完整性**：folder rename/move/delete、document rename；验证 nested folder 创建的产品路径（service 已接收并校验 parent ID，旧清单仍将其列为待办）；上传进度/重试/取消；staged/orphan artifact 清理与失败补偿测试。
4. **Knowledge 回接验收**：真实 Knowledge Space → Agent Action/Knowledge Retrieval → save/reload，含 root/Loop、引用保护、archive/failed 与 cross-Workspace 负例。
5. **Demo Ready**：通过正常产品流程创建案例、导出可重建 seed；补健康/needs-review 图谱案例；完成完整浏览器矩阵、键盘/focus、响应式和部署验收。当前 `seed/README.md` 仍主要是保留目录说明。

### P2：产品完善与后续扩展

- Journey 搜索/筛选/排序；Category rename/reorder/delete。
- Model inventory、System Variable inventory；Workspace ToolTemplate 根据正式产品范围另行设计。
- DSL golden cases、多错误恢复、类型边界、大文档基准、独立 `.ody` adapter、自定义出口标签合同。
- 大图性能基准和浏览器自动化回归。当前测试脚本以 Vitest 为主，仓库未见完整 Playwright 回归工程。
- 更新总计划中的“当前状态”及散落清单；它们有过时描述，不能按 checkbox 数量计算进度。

## 里程碑判断

| 里程碑 | 当前判断 |
| --- | --- |
| M1 Contract Freeze | 基础已建立，近期 routing/DSL 增量仍在演进 |
| M2 Interaction Proof | 核心已实现且有历史验收记录，新交互待收口 |
| M3 Core Journey | 主链路基本具备 |
| M4 Workflow Editor | 核心已实现，Version 与近期组合验收未完成 |
| M5 Resources | 核心配置已实现，inventory 与真实 Knowledge 联调待补 |
| M6 Knowledge Space | 资产/文件/Graph 数据已实现，图谱交互及文件管理未完成 |
| M7 Demo Ready | 尚未满足完整交付条件 |

不提供单一完成百分比：里程碑范围有交叉、总计划状态过时、近期实现仍未提交，按功能数量计数会掩盖 Version 和图谱交互等关键缺口。

## 本次验证

本次仅进行只读代码/文档评估和检查，未操作真实业务 UI、未启动/停止服务、未修改业务实现。检查最终结果见下方更新。

- `pnpm check`：完整通过。lint、typecheck、schemas 9 files / 93 tests、Web 92 files / 544 tests、production build 全部成功。Web 测试输出 Vue Flow 容器尺寸及样式警告，jsdom 结果不作为浏览器视觉证明。
- API `ruff check .`：通过。
- API `ruff format --check .`：失败，2 个文件需格式化。
- `uv run --no-sync pytest`：uv interpreter cache 权限失败，未启动测试。
- 直接使用仓库 `.venv` 启动完整 pytest：长时间无输出，已中断；未取得测试结果，不能当作通过或 PostgreSQL 验证证据。
- 历史完成报告记录 API 145 tests 通过，属于历史证据，不替代本次结果。

## V1 范围外：未来可执行产品

Execution kernel、模型/Tool 实际调用、检索索引与向量搜索、运行输入/输出、trace/retry、跨 Agent 调度与交接协议仍未交付。多用户认证/权限、Community、Publish、Secret vault 也不在当前 V1 承诺内。生产 Current Workspace provider 仍需要真实身份接入，当前生产配置会明确拒绝开发身份回退。

若下一目标转向“跑通 Knowledge Q&A”，应单独定义最小运行闭环：文档切块/索引与检索 → llm_call → 显式变量输出 → 新运行上下文 → 答案/来源展示 → 案例负例验收，不宜把编辑器可配置视为执行已完成。
