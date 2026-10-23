# Pattern → Agent Workflow End 单向同步实施 TODO

> Status: 编辑器 / HTTP 持久化实施完成；详见完成报告  
> Created: 2026-10-21  
> Scope: schemas / API / persistence / Web domain / Pattern Canvas / Workflow Canvas / templates / import-export  
> 产品依据：[已接受的单向同步设计](../../architecture/execution/pattern-agent-end-routing-decision.md)

## 实施记录（2026-10-22）

A–E 的核心机制及 F 的旧数据、模板、独立 Workflow JSON 已实现。G 的 schemas、Web、API 回归及浏览器关键路径已验证。详见[完成报告](./pattern-agent-end-routing-completion-report.md)与[合同增量](../../architecture/data/contracts/pattern-agent-end-routing-contract.md)。

以下清单保留原验收粒度：已勾选表示已有对应实现和证据；未勾选的广泛场景矩阵、Journey ZIP / DSL 集成不宣称完成。本轮没有 kernel，不提供运行就绪承诺。

## 1. 目标与不变量

实现 Pattern 对 root Workflow End 的单向管理：每条出向路由生成一个 End；没有出向路由生成一个完成 End；已有 `journey_end` 路由不重复生成。用户只编排内部入线，不能在 Workflow 新增、删除 End 或修改目标。空目标 Slot 保留稳定名称和出口，不自动跳过。

Linear/Circular Loop 不编辑箭头；Hub 只编辑既有 Hub–Spoke 关系方向。底层全部有向，双向展示代表两条路由。内部 graph 保持 DAG；多个 root End 不影响 Loop body 的固定边界。交接到 Hub 从 Start 重启，不是调用恢复。

本轮不实现 kernel、并行广播、调用返回、LLM 自动路由、循环退出策略和交接 payload。涉及这些语义的界面不能宣称运行已就绪。

## 2. 顺序与阶段门

按 A → B → C → D → E → F → G 推进；每阶段完成验收后再扩大范围。不能先放宽 End 数量校验、再补服务端同步。

| 阶段 | 交付物 | 进入下一阶段的条件 |
| --- | --- | --- |
| A 决策与现状审计 | 合同方案、影响矩阵、兼容策略 | 下述阻塞决策形成明确结论 |
| B Schema 与纯领域逻辑 | 两端一致的边界与 reconciliation 合同 | shared fixtures、确定性与 invariant 测试通过 |
| C API 与持久化 | Pattern/End 原子更新、revision 安全 | PostgreSQL 回滚、并发和隔离验证通过 |
| D Web application 集成 | 仓库、store、autosave 协调 | 旧响应和旧 Workflow save 无法恢复已删除出口 |
| E Canvas 与变更交互 | Hub 方向编辑、多 End、影响提示 | 真实交互及空态、错误态可验证 |
| F 兼容与可移植性 | 旧数据升级、模板和导入导出 | 无静默迁移、无源 Journey 绑定泄漏 |
| G 综合验收 | 跨层回归和完成报告 | 质量门及场景矩阵全部通过 |

## 3. Phase A — 实施前决策与现状审计

- [x] 阅读当前完整前后端工程规范及适用目录指令；检查工作区已有改动，避免覆盖并行中的 Loop、导入导出等工作。
- [x] 审计所有 single-End 假设：schema、DTO、validator、factory、commands、fixtures、template、export、DSL；列出实际文件与调用链。
- [x] 冻结 End 身份规则：区分“Linear 下一站”与“Hub 指定目标”；明确重排、方向反转、删除后重建时保留／替换哪些 node ID、入线与布局。
- [x] 冻结持久化形态：End 的派生目标如何序列化、如何验证与 Pattern 一致；不得在 Workflow 保存时授权修改 Pattern 或 End 集合。
- [x] 冻结跨 aggregate revision 协议：Pattern 变更影响哪些 Agent revision；Workflow save 携带何种路由上下文前置条件；预览后发生并发变化如何使确认失效。
- [x] 冻结删除体验。建议：先展示受影响 End/入线；确认后自动删除对应 End、入线与布局，保留上游节点并标记路径待修复；不重新指定其他目标。该建议在本阶段评审后才成为实施依据。
- [x] 冻结 Hub 新关系默认方向。建议保持现有 `Hub → Spoke`，用户显式切换；不得把建议视为已实现规则。
- [x] 冻结初始 wiring：新增出口不自动接线；新 Agent 的多个 End 如何初始化，旧最小 `Start → End` factory 如何升级。
- [x] 明确固定 Guardrail 等不在 Main Execution Pattern Slot 内的 Agent 边界来源；不得误生成“完成 Journey”而绕过后续模块。
- [x] 冻结模板可移植出口模型：保留内部路径与出口意图，解除源 Slot 引用；目标数量／角色不匹配必须显式待配置，不能按名称／下标猜测绑定。
- [x] 冻结旧单 End 数据升级方案：唯一目标可确定性映射；多目标禁止任意选第一项或复制入线造成 fan-out；保留原编排并提供明确修复方案。
- [x] 判断 JSON/schemaVersion、数据库迁移及 API command 变化，更新合同及正反例；明确新旧客户端行为。

Gate A：产出可评审合同与迁移说明。循环退出、入口调度、payload 可以继续待决，但必须与本轮编辑器能力隔离。

## 4. Phase B — Schema 与 Functional Core

重点位置：`packages/schemas/src/pattern/`、`packages/schemas/src/workflow/workflow.ts`、Web `domain/pattern/`、`domain/workflow/`、API `journeys/dto.py`、`pattern_domain.py`、`workflow_domain.py`。

- [x] 为 Hub 关系方向建立明确合同；两端策略按同一规则派生 Routes，拒绝 Spoke–Spoke 和其他非法关系。
- [x] 建立纯函数：给定 Pattern、Slot assignment 和当前 Workflow，生成目标 End 集合及新增／删除／保留／更新的影响结果；显式注入 ID factory。
- [x] 同输入得到确定结果；无变化 reconciliation 不重复生成 ID、不改写 graph/layout。
- [x] Root validator 改为检查 End 与当前 Pattern 的对应关系；保留单 Start、无 End 内部出线、DAG、边引用完整性。
- [x] 区分可保存的未完成草稿与结构损坏：空目标、未接线出口、尚不能到达有效 End 的上游路径应有 diagnostics；dangling edge 仍拒绝。
- [x] 禁止 Workflow command 删除／新增／改绑 root End，layout 操作与用户内部接线仍通过 command。
- [x] Loop body 校验保持原规则，不能因为 root 支持多 End 而放宽子图边界。
- [x] 双端共享 fixtures 覆盖四种 Pattern、三种 Hub 方向、空 Slot、完成出口去重和非法修改。
- [x] 测试输入不变性、稳定 identity、幂等性及随机增删／重排后的引用不变量。

Gate B：不依赖 Vue Flow/数据库的核心规则通过，两端合同一致。

## 5. Phase C — 后端事务与并发

重点位置：API `journeys/service.py`、`repository.py`、`router.py`、DTO 及 PostgreSQL 集成测试。

- [x] Pattern mutation 在同一 application transaction 中更新 Pattern、受影响 Workflow End、入线、layout 和各自 revision；repository 不 commit。
- [x] 新增／删除／重排 Slot、修改方向、Agent 创建／移动／交换／删除／解除绑定均复用同一 reconciliation 规则。
- [x] 影响预览与确认执行使用 revision 前置条件；确认时重新验证，不能执行基于旧快照的删除清单。
- [x] Workflow save 验证当前 assignment 与路由上下文；拒绝客户端伪造 End、旧出口和跨 Journey 目标。
- [x] 明确采用的锁定／CAS 次序，覆盖“检查 Pattern 后被并发修改”的竞态，不能只在 Python 中 compare revision。
- [x] response 返回足够的权威 revision／更新信息，供 Web 刷新受影响会话；所有读写按 Workspace scoped。
- [x] PostgreSQL 验证事务中途失败完整回滚、revision 不提前消耗、多 Workflow 更新 all-or-nothing。
- [ ] 竞争测试覆盖 Pattern 对 Workflow save、两个方向编辑、Agent 交换与 Slot 删除；稳定错误合同不得泄漏其他 Workspace 数据。

Gate C：真实数据库证明持久化与竞争安全，不能仅靠 mock。

## 6. Phase D — Repository、Store 与 Autosave

- [x] 更新 typed repository port、HTTP response validation 和共享 fixtures，不在组件散落 fetch。
- [x] Pattern 操作接入 typed intent → application command；服务端结果替换对应权威快照。
- [ ] 对 topology 变更明确协调 dirty Workflow 与 dirty Journey：flush／冲突／失败路径不丢草稿，也不让旧 autosave 重建被删除的 End。
- [x] Workflow load 获取一致的 Pattern 路由上下文，加载失败不得当作空 Slot 或无出向路由。
- [ ] 处理异步旧响应、导航切换、请求取消、多标签页 revision conflict；过期结果不覆盖新状态。
- [x] 失效的 selection、面板、context menu 和连接手势随删除正确清理；不将 session state 保存到 JSON。
- [ ] 集成测试覆盖 saving 中变更拓扑、预览期间再编辑、失败重试和刷新恢复。

Gate D：真实 API 保存／重载正确，竞态测试通过。

## 7. Phase E — Pattern 与 Workflow Canvas

- [x] Hub 连线提供可聚焦的方向选择，显示三种方向；双向图形对应两条有向路由，避免重叠误导。
- [x] Linear/Circle 不暴露方向编辑；Solo 不显示路由操作。
- [x] Root Canvas 按领域边界展示多个 End，名称清楚区分目标 Slot／占位 Agent／Journey 完成。
- [x] 新增出口采用确定性初始位置，保留未变化出口布局，不全图重排、不自动连接内部路径。
- [x] 空 Slot 显示如 `Agent-1（待配置）`；填入／替换 Agent 后更新名称，不改目标 identity。
- [x] Palette、键盘、context menu、连接 preflight 均不允许越权增删 End 或修改目标；入线仍可编辑。
- [x] 实现已接线出口删除的影响提示、确认和待修复诊断，取消后零变更。
- [x] Preview 与正式 Canvas 使用一致边界语义；只读 Preview 不暴露 mutation。
- [ ] 组件及 adapter 测试验证 projection 不回写领域图；浏览器验证多 End 接线、pan/zoom、键盘和弹框焦点。

Gate E：画布可直观说明交接关系，且两层 Canvas 没有双向拓扑写入。

## 8. Phase F — 旧数据、模板、导入导出

- [ ] 按 Gate A 批准方案提供显式 migration／兼容入口、备份与失败恢复说明；不能在 render 时迁移。
- [x] 新旧单 End、多目标、Loop body 混合文档逐类验证，不能误迁移 Loop End。
- [ ] Template save/instantiate、duplicate、Agent 移动均按目标 Pattern 重新协调边界；重映射 owned ID，禁止源 Journey Slot 泄漏。
- [ ] Workflow JSON、Journey ZIP 及已有 DSL 工作检查同一合同；独立 Workflow 缺少 Pattern 上下文时按批准的可移植协议处理，不能伪造目标。
- [x] Round-trip 保留合法的内部路径与布局，遇到不可匹配目标产生明确待配置状态或结构化拒绝。

Gate F：旧数据和可移植资产不会被新校验静默破坏。

## 9. Phase G — 场景矩阵与完成标准

| 场景 | 验证重点 |
| --- | --- |
| Linear 增删、重排 | 下一站准确，最后仅一个完成 End，内部路径按 identity 决策保留 |
| Hub 三种方向切换 | 两端 End 集合正确，取消无变更，确认后无旧出口或悬空入线 |
| Hub 多 Spoke、多个空 Slot | 数量、默认名称、待配置状态与 Routes 一致 |
| Solo、无出向路由 | 正确生成一个完成 End，不重复 |
| Circular Loop | 固定有向闭环，不擅自增加完成出口，不宣称运行退出已解决 |
| Agent 替换、交换、移动 | 目标按 Slot 绑定，源位置路由权限不跟随 Agent |
| Loop compound node | root 多 End 不影响子图固定边界、布局和连接作用域 |
| 并发与网络失败 | Pattern/Workflow 无部分提交，旧 autosave 不复活 End |
| 模板、导入导出、旧数据 | 稳定引用、可解释的适配／修复、不静默改道 |
| Guardrail 边界 | 不误用 Main Execution 的结束规则 |

- [x] 前端执行 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
- [x] 后端在 `apps/api` 执行 `uv run ruff check .`、`uv run pytest`，并完成 PostgreSQL 集成测试及必要的 migration 验证。
- [x] 真实浏览器、真实 API 验证新增／删除／方向切换／接线／刷新及失败恢复，留存结果。
- [x] 更新权威设计、合同、示例、fixtures 和完成报告，记录剩余 runtime 待决项。
- [x] 报告本轮实际改动与既有工作区改动的边界，不把文档或单元测试通过当作整项完成。

最终验收：Pattern 是出口唯一来源；任何保存路径都不能反向改写 Pattern 或复活失效 End；所有合法编辑刷新后保持一致，所有破坏性变化都有明确影响处理。
