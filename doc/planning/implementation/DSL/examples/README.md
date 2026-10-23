# DSL V0.1 评审示例

这些文件配合 [语法规范](../odyssey-workflow-dsl-v0.1-spec.md) 阅读。它们是尚未实现的语言草案，不是已编译或已执行验证的产物。

| 文件 | 验证重点 |
| --- | --- |
| [01-research.ody](./01-research.ody) | Agent Action → Task；Knowledge Space、Reusable Tool、API 配置与变量写入 |
| [02-branch.ody](./02-branch.ody) | 脚本输出绑定、Branch 条件、命名出口与两个 Agent Actions |
| [03-loop.ody](./03-loop.ody) | Loop 内 Agent Action + Task、局部变量、检索输出与变量退出条件 |
| [04-named-exits.ody](./04-named-exits.ody) | 多个命名 End 选择父级 Pattern 的已有出口 |

04 要求父级 context 提供名为 Accepted 和 Rejected 的合法唯一出口，并映射到当前 source Slot 的 EndBinding。当前仓库尚无出口命名 metadata，示例说明已确认的语法设计，不声称已有父级支持；缺 context 时不得编造 binding。

示例直接在使用位置选择已有资源，无须 resources/tools 前置声明。01/03 要求 inventory 存在唯一名称为 `Product Docs` 的 Knowledge Space；01 还要求当前 Agent 存在名为 `Product Lookup` 的已配置 Reusable Tool（例如绑定该知识库的检索工具），其完整配置将纳入编译 JSON。资源和工具仅使用名称引用：Knowledge Space 名称在 Workspace 内唯一，Reusable Tool 名称在所属 Agent 内唯一；重名必须先修正。加载所有目录项仅用于选择，不自动授权给节点。

需要新建共享工具时，可选 tools 定义见规范第 5.2 节。Task steps 仍在使用位置配置新工具实例。模型字符串仅为配置示例，不承诺模型可用性。API 地址使用 `example.invalid` 占位，必须替换后才能用于未来执行。

脚本采用假定 inputs alias 在执行环境中可访问、返回值映射 result 的示意约定。当前没有执行引擎，此处验证的是 DSL 的配置表达能力，不冻结未来脚本沙箱协议。

01/03 的自然语言 Goal 要求 Agent 更新 Shared 变量，用于说明设计意图；编译器不能证明 Agent 会完成更新。02 的 revise 分支修改 brief 后直接结束，示例不包含隐式回边。03 在轮次耗尽时同样退出，即使 approved 仍为 false；若后续业务需要区分退出原因，可在 Loop 后显式增加 Branch。

评审后需要把这些例子转换为 compiler golden fixtures，并校验 canonical schema、领域规则、ID、资源与往返等价性。


当前节点语法：`类型 "名称" { ... }`，连线按双引号名称引用；不使用节点 alias 或块内 name。同图名称规范化后唯一，Loop body 独立；内部 UUID 继续由会话保留。详见语言规范的“节点名称语法决策”。
