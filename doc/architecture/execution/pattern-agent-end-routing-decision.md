# Pattern → Agent Workflow End 单向同步设计

> Status: Accepted; editor / HTTP persistence implemented 2026-10-22  
> Accepted: 2026-10-21  
> Scope: Built-in Pattern direction, root Workflow End boundaries, Canvas presentation  
> Runtime: 当前无 kernel；本文固定编辑器设计及未来交接语义，不代表已实现执行能力。

## 1. 权威性与范围

本文覆盖旧文档中“每个 Agent 恰好一个 End”“所有内置 Pattern 都不能编辑箭头”“Hub 仅有 Hub → Spoke”的约定。与本文冲突的旧实施计划、图校验及 JSON 示例属于待更新的实现基线，不能据此恢复旧产品语义。

设计已落实为 [1.1.0 合同增量](../data/contracts/pattern-agent-end-routing-contract.md)，覆盖 schemas、API、持久化、模板及画布。实施结果与验证范围见[完成报告](../../planning/implementation/pattern-agent-end-routing-completion-report.md)。旧数据只能显式升级，不在渲染时迁移。

## 2. 路由方向与 Pattern 能力

底层路由始终有向；双向箭头是两条相反有向路由的合并展示，不是一个含糊的无向关系。

| Pattern | 方向 | 用户可编辑内容 |
| --- | --- | --- |
| Linear | 按 Slot 顺序指向下一站，最后为 Journey 完成 | 增删、重排 Slot；不可编辑箭头 |
| Circular Loop (`diamond_loop`) | 按顺序组成有向闭环，最后返回 entry | 增删、重排 Slot；不可编辑箭头 |
| Hub and Spoke | 每条 Hub–Spoke 关系可选 Hub → Spoke、Spoke → Hub、Hub ↔ Spoke | 增删支持的 Spoke、修改已有关系方向；不可添加 Spoke–Spoke 或任意连线 |
| Solo | 无跨 Agent 路由 | 不提供方向编辑 |

Hub 的方向编辑是受限的 Pattern command，不是开放自由连线。切换方向后的 Routes 由 Pattern 规则生成并校验。Hub 新关系默认使用 `Hub → Spoke`，用户可以显式切换方向。

## 3. End 生命周期：严格单向同步

唯一同步方向为 **Pattern → Agent Workflow End**。

- 当前 Agent 所在 Slot 的每条出向路由自动生成一个 End。目标为 `journey_end` 的显式路由生成完成 End。
- Slot 没有出向路由时，自动生成一个“完成 Journey”的 End；不能重复生成完成出口。
- End 不能在 Workflow Canvas 手动新增、删除或更改目标；这些变化只能来自 Pattern。
- End 不反向创建、删除或更改 Pattern 路由。
- 新生成的 End 在 Canvas 出口区可见，但不自动连接内部节点。用户编排通往各个 End 的内部路径。
- Root Workflow 可以有多个 End；Loop body 的 Loop Start/End 不受此决策影响。
- 每个 End 都是当前 Workflow 的终止边界；跨 Agent 交接不是同一个 WorkflowGraph 内的普通 outgoing edge，不能破坏内部 DAG 约束。

End 的数量及目标属于 Pattern 派生的领域边界，不是可独立修改的第二份事实来源。内部 Edge 及布局需要稳定引用这些边界；具体持久化编码由上述合同增量规定；End 属于领域图，不只存在于 Vue Flow 投影。

## 4. 用户通过执行路径选择交接目标

多个 End 在画布上分别显示明确的目标。用户通过内部路径、必要的 Branch 选择到达哪个 End；无需再搭建隐藏于 End 面板内的条件路由表。

```text
Start → 执行 → Branch
                 ├─ 条件 A → End〔Research Slot〕
                 └─ Default → End〔Writing Slot〕
```

不强制引入 `next_agent`、`task.kind` 等路由系统变量；不默认让 LLM 选择下一站。需要条件判断时，Branch 使用用户显式配置的规则及其可用数据。上图不要求每个 Workflow 都有 Branch，也不将 Branch 与 End 强制成组。

## 5. Slot identity 与空 Slot

- End 交接目标绑定稳定 Slot ID，不绑定 Agent 名称、数组下标或当前占位 Agent ID。
- 空 Slot 仍参与 Pattern 拓扑，仍为其他 Agent 生成指向它的 End；空 Slot 本身不因此创建 AgentWorkflow。
- Slot 创建时有默认名称，例如 `Agent-1`。默认名称创建后保持稳定，不随重排或删除其他 Slot 自动重编号；名称不是 identity。
- End 展示目标 Slot 和已配置 Agent；空目标显示如 `交接 → Agent-1（待配置）`。
- 目标填入或替换 Agent 时，更新展示，保留对应 End 身份及内部入线。目标变空时保留出口及绑定。
- 允许保存未完成设计；空目标不能通过运行就绪检查，不能被自动跳过或改道。加载失败必须与空 Slot 区分。

## 6. Pattern 变更的影响

| 变更 | End 响应 |
| --- | --- |
| 新增出向路由 | 自动新增未接入内部路径的 End |
| Slot Agent 替换或变空 | 更新目标展示／待配置状态，保留 End 及入线 |
| Linear 重排 | 按新的下一站更新 End，不能继续指向旧的下一站 |
| 删除路由／Slot、反转方向 | 自动删除不再对应当前路由的 End，生成新方向所需的 End |
| Agent 移动／交换 Slot | 按新的所属 Slot 重新派生出口，不携带旧位置的路由权限 |

删除 End 不得静默丢失相关内部编排，也不能留下 dangling edge。变更前应展示受影响 End 和入线，明确处理这些入线并提示用户修复内部路径；实现采用 revision 与精确删除清单绑定的确认弹框；取消恢复保存快照，确认后清除对应出口及入线，保留上游节点待修复。不得为了保留旧 End 而保留旧 Pattern 路由，不得擅自把旧入线接到其他目标。未变化出口应保持稳定 identity 和已有入线。

涉及持久化的 Pattern、End、内部 Edge 与 layout 变更必须遵循 application transaction、revision/CAS 和 Workspace ownership 约束；不能通过组件 watcher 或多个独立 save 伪装原子同步。并发 Pattern 编辑与 Workflow 编辑须显式检测过期路由上下文。

## 7. 交接不是调用返回

本设计限定为单路径交接：到达 End 后结束当前 Workflow 本次执行，目标 Agent 从 Start 开始。

- `Hub → Spoke`：交接到 Spoke。Spoke 若无出向路由，其完成 End 表示 Journey 完成。
- `Spoke → Hub`：交接后 Hub 从 Start 再次执行。
- `Hub ↔ Spoke`：两条有向路由，两边分别生成 End；不表示并行广播或恢复 Hub 的暂停位置。
- 无出向路由时的“完成 Journey”规则限于单路径模型，不能直接用于未来并行分支完成判断。

“Hub 调用 Spoke、等待结果、从调用位置继续”需要独立的调用节点与返回协议，不由反向箭头或交接 End 隐式实现。

## 8. 待决项与实施检查

以下问题尚未冻结，不能宣称已支持：

- Circular Loop、双向 Hub 的显式退出方式、执行次数上限及 Journey 完成条件；不能擅自在闭环中增加完成出口。
- Journey 入口选择（包括只有 Spoke → Hub 的情况）。
- 交接输入／输出、上下文映射、失败与重试协议。

实施验收至少覆盖方向切换、动态增删、空 Slot、替换／移动 Agent、Linear 重排、已接线出口删除、刷新恢复、并发冲突、模板实例化与 Loop boundary 隔离。新增但尚未接线的出口应显示待编排状态；保存草稿与运行就绪校验必须区分。
