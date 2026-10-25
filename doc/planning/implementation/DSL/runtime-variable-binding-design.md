# DSL 直接变量绑定设计

> Status: 编辑器实现中；DSL 0.2 / graph 1.2.0 合同已落地，runtime 执行仍不在本轮范围。
> Date: 2026-10-25
> Decision: 使用位置直接写 `$namespace.key$`，不新增 bindings 分区。
> Applies to: DSL 0.2；旧版 0.1 保持原语法，使用显式 Upgrade to 0.2 迁移。

## 1. 目标与既有语法的关系

同一份 Workflow 应能处理来自不同 Knowledge Space 的文件事件，而不是在 Agent Knowledge 和检索工具中写死某一个游戏 KS。目标身份由系统从事件解析、校验并注入，不由模型根据文件内容猜测。

本设计确定新的统一整值引用形式 `$agent.key$`、`$task.key$`、`$sys.key$`。实现本增量后，普通值/变量目标位置的既有裸引用 agent.key、task.key、sys.key 迁移到新形式，不长期维持两套等价语法。字符串内 `${agent.key}` 等已有文本插值保留。

现有 version "0.1" 示例与 .ody 案例仍反映当前实现，不能直接宣称已支持新绑定。实现时须通过明确的语言版本/能力门槛区分旧语法与新语法，并提供迁移；不在未升级 parser 的情况下批量改写可运行的旧例。旧文档中“资源仅限固定名称”和“只支持裸变量引用”的描述，由本文对下一版的约定覆盖。

## 2. 三种输入必须区分

| 写法 | 含义 | 解析时间 |
| --- | --- | --- |
| `"Document Curator Playbook"` | 固定资源名称，或值位置的普通字符串 | 配置时，根据字段语义判断 |
| `$sys.target_knowledge_space$` | 类型化整值/资源引用表达式 | 配置时查系统输入合同；运行时注入值 |
| `"Question: ${agent.question}"` | 字符串插值，结果是文本 | 配置时检查变量；运行时构造文本 |

`"$sys.target_knowledge_space$"` 是普通字符串，不是动态绑定。在 Knowledge 名称位置它就是一个待解析的字面名称，不能因为看起来像表达式而偷偷替换。字符串内 `$agent.question$` 同样不会自动插值。整值绑定保留类型，不默认转为字符串。

## 3. 建议语法

以下语法由 DSL 0.2 compiler 支持：

```odyssey
agent_action "Propose Local Changes" {
  model "gpt-5";
  knowledge ["Document Curator Playbook", $sys.target_knowledge_space$];
  toolbox [find_related];
  goal "Inspect the changed document using the assigned maintenance rules.";
}
```

对应 Reusable Tool 的资源字段：

```odyssey
config {
  knowledgeSpaceId = $sys.target_knowledge_space$;
  topK = 5;
}
```

普通值、变量目标与条件采用相同的引用边界：

```odyssey
query = $agent.question$;
input_bindings [$agent.question$];
output "response.text" -> $agent.answer$;
when $agent.requires_review$ == false;
```

script_execution 的 inputs.variableId 等“变量身份位置”也使用 `$agent.context$` 形式，表示绑定该变量，不是先取它的对象值再当作变量 ID。set_variable 的写入目标同理。读值还是绑定可写目标由字段合同决定，不增加第二套标记。

字符串插值保持：

```odyssey
goal "Question: ${agent.question}";
```

## 4. 最小 grammar 与词法边界

```ebnf
binding        = "$", namespace, ".", IDENT, "$" ;
namespace      = "agent" | "task" | "sys" ;
knowledge_ref  = STRING | binding ;
variable_ref   = binding ;
```

这是绑定增量，不代替完整 grammar。knowledge_ref 中的 binding 必须在语义检查中得到 KnowledgeSpace 类型；不是所有 binding 都可用作资源。

- lexer 仅在字符串外把完整 `$...$` 识别为绑定；字符串内继续执行既有字符串/插值规则。
- IDENT 沿用现有标识符规则。绑定内不接受空白、嵌套表达式、调用、拼接、算术、数组索引或任意属性路径。
- `$sys.target_knowledge_space$` 是系统输入目录中注册的平面 key，不意味着开放 `$sys.event.anything$`。
- 非 ValueSource 的源代码正文（如 script 字符串）不因出现 `$...$` 而被重写。
- 不新增 bindings、resources 声明分区，也不要求用户先起 target 别名。

## 5. 类型与可用位置

普通变量仍只有 string、number、boolean、json；本次不增加用户可声明的 KnowledgeSpace 或 Document 类型。

系统输入目录可以提供受信任的类型化资源值。`sys.target_knowledge_space` 的类型是 KnowledgeSpace 引用，由系统声明；不能把一个 json/string 变量冒充此资源类型。资源身份、归属与授权信息的内部表示由后续 canonical/runtime 合同确定，不在文本中暴露 UUID 参数。

| 位置 | 允许的绑定 | 检查 |
| --- | --- | --- |
| Agent Action knowledge 列表 | KnowledgeSpace 类型的系统资源绑定；也可混合固定名称 | 类型及触发输入合同 |
| knowledge_retrieval.config.knowledgeSpaceId | 一个 KnowledgeSpace 资源绑定或固定资源名称 | 与 knowledge 列表使用同一资源类型 |
| query、prompt、goal、API ValueSource 等 | 按字段要求接受普通变量/已注册系统值绑定 | 类型与当前 ValueSource 合同一致 |
| output、targetVariableId、script inputs.variableId | 对允许作用域中的变量绑定 | 变量身份、ownership、可写性或输入可读性 |
| Branch / Loop 条件 | 符合运算符类型要求的值绑定 | 不开放任意表达式 |
| 变量默认值、节点名、Case 名、固定工具名、版本等 | 不因本增量自动允许绑定 | 继续使用原合同要求的字面量/声明 |

`knowledgeSpaceId = $agent.some_string$;` 非法，即使字符串内容恰好是 KS 的 UUID 或名称。`${sys.target_knowledge_space}` 也不能通过文本插值绕过资源类型检查。本版不开放 Agent 修改目标 KS 或在运行中动态选择另一个 KS。

toolbox 的工具名称/本地 alias 继续沿用当前约定；本次仅确定 KS 资源绑定，不隐式开放动态工具目录选择。普通 JSON 对象和数组中也不因此开放任意深度的绑定表达式；仅既有合同明确接收 ValueSource/变量引用的字段支持。

## 6. 系统事件与生命周期

文件插入/更新事件由系统确定 Workspace、所属 KS、文档身份与来源版本。系统输入合同至少声明 target_knowledge_space 以及该触发类型实际提供的文档/版本输入；后者的 key 与类型需在具体触发合同中登记，本文不凭示例虚构 sys 字段。

- 每次运行解析并固定本次目标绑定，不把它写回 Workflow 固定配置。
- 系统值只读，Agent、Task 和脚本不能给 sys 目标赋值。
- 文档必须属于目标 KS，目标 KS 必须属于授权 Workspace；写入工具独立执行权限与版本检查。
- 多次执行可以绑定不同 KS；同一次执行的知识选择、检索工具及读取/提交上下文须保持同一目标身份。
- 缺少必要系统输入时拒绝启动/继续相关操作，不回退到上一次目标或任意默认 KS。
- 目标绑定稳定不等于内容版本永久有效；提交前仍检查 source/graph/evidence/policy freshness。

固定 Playbook 的规则身份与版本由显式配置确定。准备阶段完整读取三份规则，不因为目标 KS 动态化而改成随机检索规则。

## 7. 两阶段检查

配置时检查绑定语法、namespace/key、普通变量作用域、系统输入目录、资源/值类型、字段可用性及写入权限。未注册系统 key 是错误；系统输入目录尚未加载是 context-required。动态目标尚无具体实例是合法的，只要触发输入合同已知，不应被当成固定 inventory 缺失。

运行时检查实际输入存在、身份/归属、文档与 KS 的关系、授权、类型以及版本条件。运行时失败不能伪装成配置错误或自动换资源。

编译器不能自行读取当前页面选中的 KS 来替代 `$sys.target_knowledge_space$`。Editor preview 中展示某个样例 KS 也不能改变持久化绑定。

## 8. JSON bridge 与双向编辑

canonical JSON 必须能区分固定资源引用和系统输入引用。固定资源保持内部稳定身份；动态引用保存系统 key/类型化引用描述，而非本次运行解析出的资源 UUID。具体判别联合、字段名及 schemaVersion 另行设计，不伪造为当前已支持的 JSON 字段。

同一系统 key 在 knowledge 和 Tool config 中表示同一个本次运行资源。Compiler、Printer、Canvas、导出/导入和 autosave 均须保留这一身份。

Canvas 需要区分“固定 KS”和“由系统事件绑定”，动态项可显示 From event: target_knowledge_space；不要求没有运行输入时选择一个虚假的具体 KS。Printer 输出原绑定表达式；往返不得把它冻结成样例 KS 名称。未实现该引用类型的旧客户端应明确拒绝/提示不支持，不能静默丢失或降级。

## 9. 实施前的门槛

确定语言版本/迁移策略和系统输入目录合同，再设计 canonical 资源引用增量，然后同步 lexer/parser、类型检查、Printer、Canvas 和错误定位。此轮仅固定文档，不改编译器、schema、产品 UI 或现有 .ody 示例。

Document Curator 的下一版应保留固定 Document Curator Playbook，把固定游戏 KS 替换为 `$sys.target_knowledge_space$`。其旧 DSL 暂是当前 parser 的配置样例，不是通用事件绑定能力已经落地的证明。

实施入口：[直接变量绑定实施计划与 TODO](./runtime-variable-binding-implementation-plan.md)，包含合同 Gate、编译算法、文件范围、持久化与 Canvas 阶段及验收矩阵。当前仅完成计划，未开始实现。

## 10. Implementation contract (2026-10-25)

The implementation freezes DSL `0.2`, Workflow graph `1.2.0`, and export envelope version `1` independently. Legacy DSL `0.1` remains readable. Opening a document never migrates it. **Upgrade to 0.2** compiles the draft and prints a normalized 0.2 preview; Apply commits it. Normalization replaces formatting and comments, so keep the original source if those are needed. Canvas creation of a system binding promotes the graph capability to 1.2.0 in the same command. Pattern exit reconciliation preserves this version.

Canonical resource fields retain their existing names and fixed UUID representation for backward compatibility. They now accept a strict union:

```typescript
type KnowledgeSpaceReference = UUID | {
  kind: 'system_knowledge_space';
  key: 'target_knowledge_space';
}
// Agent Action: knowledgeSpaceIds: KnowledgeSpaceReference[]
// Task / Reusable retrieval: configuration.knowledgeSpaceId: KnowledgeSpaceReference
```

This supersedes the proposed new knowledgeSources/knowledgeSpaceSource fields in the initial implementation plan. There is one persisted representation per reference and no duplicate legacy/new fields. Fixed references still undergo Workspace availability checks; system references are validated by their registered key and never queried as concrete KS IDs. Dependency collection and template remapping retain system references but collect only fixed UUIDs as external dependencies.

System values and template segments use `{ kind: 'system', key }`. Registered value keys are `change_event` (json), `document_id` (string), and `document_revision` (string). `target_knowledge_space` is exclusively a resource key. All are read-only, and system keys cannot be variable identities, script variable inputs, output destinations, or Set Variable targets. Their future provider is a document-change trigger adapter; editing and saving do not assert that adapter exists or that runtime authorization has succeeded.

Known bindings can be saved without a concrete event or target KS instance. Unknown keys, resource/value role mismatches, and system bindings inside an old graph version are rejected. Literal JSON that happens to contain `kind: system` remains literal data. The shared cross-language fixture is `packages/schemas/fixtures/runtime-bindings.json`.
