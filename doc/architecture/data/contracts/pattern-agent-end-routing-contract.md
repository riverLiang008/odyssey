# Pattern / End 路由合同增量

> Status: 本次实施合同；2026-10-22  
> 依据：[已接受产品决策](../../execution/pattern-agent-end-routing-decision.md)  
> 适用：当前 HTTP 编辑器、Agent Template、独立 Workflow JSON；无 kernel。

## 1. 版本与兼容

- PatternConfig 与 WorkflowGraph 同时接受 `1.0.0` 和 `1.1.0`；其他文档版本保持原合同。
- Hub 方向配置使用 Pattern `schemaVersion: "1.1.0"`。
- Pattern 管理的 root End 使用 Workflow `schemaVersion: "1.1.0"`。
- 旧 `1.0.0` 文档继续可读。读取／渲染不迁移；正常 Pattern 保存时，在事务内协调出口，不提供独立的手动同步按钮。仅当协调会删除已有入线时返回影响确认；可保留边界及入线的旧格式升级不单独打断用户。
- 不需要数据库结构迁移：增量由现有 JSONB 容纳；旧数据升级是显式 application command/save，不是后台改写数据库。严格旧客户端会拒绝新版本，不能让旧客户端静默编辑新合同。

## 2. Hub 方向

方向存放在 Spoke Slot 的 `configuration.direction`，允许：

| 值 | 派生路由 |
| --- | --- |
| `hub_to_spoke` | Hub → Spoke |
| `spoke_to_hub` | Spoke → Hub |
| `bidirectional` | 两条相反有向路由 |

缺省方向为 `hub_to_spoke`，延续原有行为。显式方向仅属于 Hub 的 Spoke；Linear、Circle、Solo 不接受方向字段。不增加第二份“关系实体”；Routes 由类型规则生成，并由服务端复核。

## 3. Root End binding

```json
{
  "id": "10000000-0000-4000-8000-000000000003",
  "name": "End",
  "type": "end",
  "config": {
    "binding": {
      "sourceSlotId": "10000000-0000-4000-8000-000000000001",
      "target": { "type": "slot", "slotId": "10000000-0000-4000-8000-000000000002" }
    }
  }
}
```

完成出口的 target 为 `{ "type": "journey_end" }`。`binding` 不出现在 Loop End；旧 End、Guardrail 边界和可移植出口可以不带 binding。API 的可选 null binding／layout dimensions 在前端边界归一化为未设置。

每条出向路由对应一个 End，无出向路由则生成一个完成 End；显式完成路由不重复生成。绑定使用 source/target Slot，避免 route ID 重建或 Agent 替换破坏出口 identity。

- 未变化的 source/target 保留 End ID、内部入线和布局。
- Linear/Circle 的唯一“下一站”出口在重排时保留 ID 和入线，更新绑定。
- Hub 目标变化按具体 source/target 匹配；新增目标生成未接线 End，删除目标移除对应 End。
- 旧单 End 仅在唯一目标时复用；旧单 End 面对多个目标时，不能选第一项或复制入线。如果涉及入线删除，确认影响后移除旧边界／入线，保留上游节点，生成未接线出口供用户修复；没有入线损失时随正常 Pattern 保存完成兼容处理。
- Guardrail 和未分配 Agent 不从 Main Execution Pattern 推导结束语义。本次不定义跨 Guardrail 执行协议。

## 4. Pattern 保存与影响确认

既有 `PUT /journeys/{journeyId}` 保留 expectedRevision，新增可选 `routingConfirmation`。服务端先计算影响；仅在需要删除已有入线时返回：

```text
409 STATE_CONFLICT
reason: END_ROUTING_CONFIRMATION_REQUIRED
routingImpact[]:
  agentId, revision, removedEndIds[], removedEdgeIds[], legacy
```

预检失败不写任何状态。用户确认后重发同一个 Pattern 候选及：

```text
routingConfirmation[]:
  agentId, revision, removedEndIds[], removedEdgeIds[]
```

服务端重新计算并匹配 Agent revision 和确切删除集合，不能用同一 revision 的确认去删除另一组出口。已有占用 Slot 删除 command 使用同样的确认合同。

一次事务内完成 Pattern、受影响 Workflow graph/layout、入线和 revision 更新。删除 End 时同时清理对应入线及布局，保留上游节点，不重定向路径；取消则重新载入已保存 Pattern。界面确认期间阻止继续修改候选拓扑。

## 5. 并发与权威边界

Pattern、Agent 创建／删除／移动以及 Workflow save 都先锁定服务端 Workspace 范围内的 Journey，再执行 aggregate CAS；受影响 Workflow 也以自身 revision CAS 更新。事务失败整体回滚。

Workflow save 必须保留服务器当前 End ID 集合及 binding，不能新增、删除或改绑，违规则返回 `STATE_CONFLICT / END_BOUNDARY_IMMUTABLE`。拓扑已更新导致的旧 Workflow revision 返回 `REVISION_CONFLICT`，旧 autosave 无法复活出口。Pattern 与 Workflow 没有反向拓扑写入。

HTTP repository 保留成功返回的 Journey 文档，store 更新 Agent revision summaries 并关闭失效 Preview；不得用旧响应覆盖较新的本地 Pattern 编辑。

## 6. 可移植出口

保存 Template、导出独立 Workflow 时移除源 Journey binding，保留内部路径和可识别出口名称。实例化／导入时复用或生成目标 Pattern 管理的边界：

- 目标只有一个出口时，确定性映射到唯一出口。
- 有多个候选目标时，用户必须显式匹配每个源出口，禁止按名称／数组位置猜测。
- Template instantiate request 新增 `endAssignments[]: { endNodeId, target }`，其中 endNodeId 来自 Template，target 必须属于目标 Slot 的合法路由。
- 多个源出口显式映射到同一目标时，合并边界与语义重复入线；未使用的合法目标仍生成未接线 End。
- 缺少／非法 Template 映射返回 `STATE_CONFLICT / TEMPLATE_END_MAPPING_REQUIRED`，事务不创建孤立 Agent。
- 导入 Workflow 保留服务器当前 End ID 与 binding，映射源入线及 layout；不能通过导入扩大 Pattern 通信权限。

Journey ZIP 与 DSL 当前没有本机制的可执行导入导出路径，本合同不宣称它们已完成适配。未来实现必须沿用同一 source-of-truth 和可移植边界规则。

## 7. 草稿与执行就绪

多个 root End 仍属于内部 DAG 的终止节点，不允许内部 outgoing edge。可保存未接线或目标为空的草稿；Canvas 显示未接线出口和未配置目标数量，Loop body 校验不变。平台不创建 `next_agent` 系统变量，不让 LLM 隐式选择下一站。

Circle／双向 Hub 的退出、入口调度、调用返回、交接 payload 和 kernel 仍不在本轮范围内。
