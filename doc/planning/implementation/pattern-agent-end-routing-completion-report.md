# Pattern → Agent Workflow End 实施完成报告

> Date: 2026-10-22  
> Scope: 当前 HTTP 编辑器、JSONB 持久化、模板、独立 Workflow JSON  
> Contract: [1.1.0 增量](../../architecture/data/contracts/pattern-agent-end-routing-contract.md)

## 已实现

- Pattern 是 root End 的唯一来源。出向路由逐一生成出口；无出向路由生成单个完成出口。Loop body 保持固定 Start / End。
- Hub 每条既有关系支持三种方向，默认 Hub → Spoke；双向关系以两条有向路由持久化。Linear / Circle 不暴露方向编辑。
- 出口绑定稳定 Slot ID；空 Slot 有 Agent-N 标签，配置 Agent 后更新展示。未接线及空目标会显示诊断，新出口不自动接线。
- 后端统一协调 End、入线、布局与 Agent revision。Pattern 与 Workflow 保存按同一 Journey 锁顺序执行，再使用 CAS；同步和 Pattern 写入同事务提交，所有查询按 Workspace 隔离。
- 删除已接线出口前显示影响确认；凭据绑定 Agent revision 与精确 End / Edge 删除清单。确认时重新计算，过期凭据不能批准不同删除集合。旧 Workflow save 不能复活出口或改绑目标。
- 旧文档读取不迁移；通过正常 Pattern 保存事务处理兼容，仅在删除已有入线时确认影响，不提供手动同步按钮。单目标保留原边界及入线；多目标不猜测旧出口去向，清理的入线须确认并由用户修复。升级前可导出备份；取消不提交同步，失败由事务回滚。没有后台批量迁移或新数据库列。
- 模板与独立 Workflow JSON 移除源 Journey 的绑定权限；导入 / 实例化到多目标时要求显式出口映射。单目标确定性适配，owned ID 重映射；不存在把名称当授权依据的自动路由。
- Canvas 与只读 Preview 使用相同出口名称；方向菜单、影响确认和映射对话框接入现有组件体系。

## 验证

| 检查 | 结果 |
| --- | --- |
| Shared schemas | 93 tests passed |
| Web | 478 tests passed / 82 files（含提示展示修正） |
| API / PostgreSQL | 145 tests passed；含路由同步、并发旧保存、事务失败回滚、模板映射 |
| 静态检查 | `pnpm lint`、`pnpm typecheck`、API `ruff check .` 通过 |
| 构建 | `pnpm build` 通过（3094 modules） |
| Git | `git diff --check` 无 whitespace error；存在既有 CRLF 提示 |

API 使用仓库 `.venv` 运行 `python -m pytest -q`，数据库为本机 PostgreSQL 55432；不依赖 mock 替代事务验证。仅有 Starlette / httpx 的现有弃用提示。

新增纯函数测试覆盖共享路由 fixtures、稳定 identity、幂等性、输入不变性、100 次确定性方向变更、引用完整性及 Canvas projection round-trip。后端另覆盖 Circle entry 重排后删除时选择实际后继并保留未变化路由 ID。

真实浏览器使用独立 Workspace、API 8311、Web 4177 验证：Hub 初始多个空目标出口；Start 到 End 拖线后保存及刷新；反转已使用关系时确认删除 1 个 End / 1 条入线；Spoke 的反向出口指回 Hub；切换双向后 Hub 恢复对应出口；填入 Agent 后目标标签更新。验收截图保存在本机任务 artifact 目录。

为稳定回归，将 Web worker 限制为 2，首次编辑器依赖加载 timeout 为 20 秒；功能断言未放宽。已有 Knowledge manifest 正向测试固定注入其 fixture 的时间，避免过期 token 随日历失效；Knowledge workflow fixture 保留服务器拥有的 Start / End 以符合新边界规则，生产 Knowledge 行为未调整。

## 范围与后续

- kernel、循环退出 / 次数上限、Journey 入口调度、交接 payload、失败重试和调用返回协议仍未实现。
- 当前 HTTP 实现是验收对象；InMemory repository 的历史 harness 不作为本特性的服务端替身。Journey ZIP / 独立 DSL 的完整路由 round-trip 尚未纳入本轮实现承诺。
- 计划中广泛组合场景（两种方向并发、交换与删除交叉、所有网络失败时序、所有键盘及弹框焦点路径）尚未逐项完成端到端自动化；保留未勾选项，不将核心回归通过等同于这些矩阵全部完成。
- 工作区原有 Loop compound Canvas、Workflow JSON 导入导出、导航与样式等未提交改动已保留。本轮在相关入口做必要适配；没有 reset、stash、提交或覆盖既有工作。

设计、合同和实施清单已同步。这里的“完成”指本报告明确列出的编辑器 / HTTP 路由机制，不代表执行引擎已具备运行能力。

## 提示展示修正（2026-10-22）

以下为已撤回的历史实现，已由下一节产品纠正替代。

旧数据的 `Pattern exits need synchronization` 是兼容提示，不是节点执行或保存报错。原画布左下角状态条层级低于 Palette，导致文案被遮挡。现改为 Teleport 到 body 的顶部可关闭气泡，说明旧 End 尚未绑定 Pattern，并提供返回 Journey 的检查入口；未接线 / 空目标使用另一种说明。关闭不改文档，同一状态不会反复弹出，切换 Agent 或诊断变化后重新提示。

新增 3 项组件测试覆盖外部浮层、导航目标、关闭与重新提示、健康及非 Pattern Workflow 的隐藏状态。已在现有 Journey 的 Agent Workflow 上验证浮层展示和关闭，未执行数据同步或修改节点 / 连线；截图为 `workflow-exit-notice-fixed.png`。


## 产品纠正：取消手动同步入口（2026-10-22）

移除 Journey 页面的同步按钮、对应 store 手动 action，以及 Workflow 中引导用户返回同步的旧格式提示和跳转。Pattern 是 End 唯一来源，正常 Pattern 保存事务自动协调 End；读取仍不写数据库。兼容升级无入线损失时无需额外确认，有入线删除时保留 revision / 精确删除清单确认。没有为取消按钮增加启动或 GET 自动写入，也没有直接改写现有用户数据。

同步后的 Workflow 仍可通过气泡提示实际待接线 / 空目标配置项；不再把历史格式兼容当成用户需要执行的操作。PostgreSQL 新增两种旧格式路径测试：无入线损失时正常保存成功；存在入线损失时返回影响并完整回滚。Journey 组件断言不再出现同步按钮。

本次纠正后的验证：Web 478 / schemas 93 / API 145 tests passed；lint、typecheck、Ruff、production build 通过。浏览器确认 Journey 按钮已移除，未提交该用户 Journey 的任何数据变更。
