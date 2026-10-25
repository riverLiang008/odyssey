# Odyssey Agent Workflow DSL V0.1 语法规范（评审稿）

> 2026-10-25 已确认的下一版增量：[直接变量绑定设计](./runtime-variable-binding-design.md)。采用 `$namespace.key$` 使用位置直接绑定，不新增 bindings 分区；资源类型与授权受约束。此设计覆盖下文固定资源/裸引用对下一版的限制，但尚未实现，现有 V0.1 示例继续表示当前 parser。

> Status: V0.1 实施中 — 已接入 DSL Edit，节点名称语法已更新  
> Date: 2026-10-20  
> Updated: 2026-10-22 — 节点直接以名称声明和引用；layout 不进入 DSL  
> Scope: 单 Agent Workflow 的声明、检查及 canonical JSON 生成  
> Validation draft (2026-10-22): [语法与语义检查规范](./odyssey-workflow-dsl-v0.1-validation-spec.md)、[验收案例](./validation-cases.md)  
> Related: [RFC 与实施计划](./agent-workflow-dsl-v1-rfc-implementation-plan.md)、[用户最初草稿](./DSL%20语法草案.md)

## 1. 本版定位与决策状态

DSL 编译器负责 `DSL → 检查 → canonical Workflow JSON`，Printer 负责反向生成 DSL。正式产品入口是现有 Canvas 右侧 DSL Edit 面板：JSON 在内存中桥接，两方向均须交付，用户无需下载/上传文件。文件 Import/Export 是可选验证能力，不是面板同步的前置步骤。当前实施以 [双向同步计划](./dsl-edit-bidirectional-sync-implementation-plan.md) 为准。

已经讨论确认的方向：

- 花括号显式界定结构，采用接近 C++ 的声明风格。
- Workflow 保留 `variables`、`nodes`、`edges` 分区。
- 每条连线独立声明，不提供链式连线。
- Loop 包含自己的 `nodes`、`edges`，隐式拥有 `loop_start` / `loop_end`。
- 编辑时提供语法、语义和 Workflow 检查；错误定位到源文本。
- 检查和编译共用逻辑，失败不修改 Canvas。
- 编辑器加载可选资源和工具 inventory；使用位置直接引用已有项，无须先在顶层声明。集中 tools 仅作为新建共享工具配置的可选能力。
- 用户语法仅按名称引用资源和工具，不提供 UUID 配置参数；节点等对象 identity 由内部编辑会话维护。
- 已确认：未完成连线按 warning，允许导出/Apply；命名 End 从父 Pattern 的命名出口选择 binding；名称匹配键为 NFC(trim(name))，大小写敏感。

本文其余细节均是**本轮提出、等待评审的规则**，不包括已确认的节点名称声明、名称引用和 Canvas 独立布局规则。它们不是已经实现或已获批准的语言合同。

DSL 不直接执行 Agent，不编辑 Journey Pattern，不提供通用函数、宏、任意表达式或嵌套 Loop。当前产品没有执行引擎，本文运行行为描述的是配置所表达的预期语义。

## 2. 文件结构

建议文件扩展名为 `.ody`。一个文件恰好包含一个 Workflow：

```odyssey
workflow "Research Agent" version "0.1" {
  variables {
    string user_managed research_topic = "Odyssey";
    string shared research_brief;
  }

  nodes {
    agent_action "research" {
      model "gpt-5";
      goal "Research ${agent.research_topic}; update research_brief.";
      knowledge ["Product Docs"];
      toolbox [];
    }
  }

  edges {
    start -> "research";
    "research" -> end;
  }
}
```

- `version "0.1"` 是 DSL 版本；无 binding 的新建 graph 使用 `schemaVersion "1.0.0"`，含 Pattern-bound End 使用 `"1.1.0"`；已有文档保留合法版本，不静默降级。导出 `formatVersion` 为 `1`，三者不能混用。
- Workflow 名称作为导出 `source.agentName` 的标签；导入现有 Agent 不因此重命名目标 Agent。
- `nodes`、`edges` 必须出现，可为空；`variables`、`tools`、`identity` 可省略。不再提供顶层 resources 分区。
- 每种分区在同一容器中最多出现一次，输入分区顺序不限，Printer 使用上例顺序，最后输出 `identity`。
- 节点和可选 tools 声明允许前向引用；已有资源通过 inventory 解析。声明顺序只在 Task steps 与 Branch cases 中决定业务顺序。

## 3. 词法规则

| 项目 | V0.1 提案 |
| --- | --- |
| 编码 | UTF-8，允许文件开头 BOM；接受 LF / CRLF |
| 大小写 | 关键字和标识符大小写敏感 |
| 标识符 | `[A-Za-z_][A-Za-z0-9_]*`；显示名称和正文允许 Unicode |
| 注释 | `//` 行注释、`/* ... */` 非嵌套块注释 |
| 结束符 | 简单声明必须 `;`；结构块后不加 `;` |
| 数字 | JSON 数字规则，允许负数和指数；禁止 NaN、Infinity |
| 布尔与空值 | `true`、`false`、`null` |
| 列表/对象 | 逗号分隔，允许尾逗号；重复对象 key 是 error |

结构关键字不能作声明 alias；完整保留词由本版 grammar 中的固定词组成。`start`、`end`、`loop_start`、`loop_end`、`default`、`agent`、`task`、`sys` 保留；`default` 可用作 Branch 出口选择器。工具配置字段名使用 schema 定义的名称，不共享 alias 的保留词限制。

普通字符串使用双引号和 JSON 转义。ValueSource 位置的字符串支持 `${agent.key}`、`${task.key}`、`${sys.key}` 插值；引用必须是一个变量，不能嵌入计算。非 ValueSource 字段（名称、脚本等）的字符串不执行插值。

```odyssey
goal "Research ${agent.research_topic}.";
goal literal("Show ${agent.research_topic} verbatim.");
```

`literal(...)` 强制生成 literal ValueSource，可用于字符串及 JSON 值。模板中若要包含字面 `${`，使用 DSL 专属转义 `\$`；此转义仅普通字符串允许。普通 JSON 转义之外的其他转义报错。

三双引号提供原始多行字符串：内容不处理反斜杠转义，不自动去缩进，保留实际换行；以首个后续 `"""` 终止，无法包含该终止符，遇此情形改用普通转义字符串。ValueSource 位置仍识别插值，`literal(...)` 可以关闭插值。Printer 可统一输出普通转义字符串，避免改变内容。

```odyssey
goal """Research ${agent.research_topic}.
Return a concise brief.
""";
```

注释与排版不属于 Workflow 语义。V0.1 不保证 Canvas → DSL 往返保留注释；页面必须在可能丢失草稿时提示。

## 4. 变量与值

### 4.1 Agent 变量

```odyssey
variables {
  string user_managed topic = "Odyssey";
  number agent_managed confidence = 0;
  boolean shared approved = false;
  json shared findings = [];
  string shared brief {
    display_name "Research brief";
    description "The Agent maintains a concise research summary.";
    read_only false;
  }
}
```

简单声明与带 metadata 的声明二选一。metadata 形式也允许在块前写 `= value`。默认值必须为 JSON 字面量，不能引用其他变量。未写默认值映射为 canonical `null`，不产生 required 语义。

| DSL | canonical |
| --- | --- |
| alias | `key` |
| `string / number / boolean / json` | `dataType` |
| `user_managed / shared / agent_managed` | `ownership` |
| `= value` | `defaultValue` |
| `display_name`，省略时用 alias | `displayName` |
| `description`，省略时为 null | `description` |
| `read_only`，省略时 false | `readOnly` |

非 null 默认值必须符合声明类型。`json` 接受任意 JSON 值。ownership 表示谁可写；`read_only true` 进一步禁止写入，不得用它替代 ownership。

| ownership | Task Tool 写入 | Agent Action 直接写入 |
| --- | --- | --- |
| user_managed | 允许 | 禁止 |
| shared | 允许 | 允许 |
| agent_managed | 禁止 | 允许 |

Agent Action 的 Goal 中自然语言提到更新某变量，不等于编译器能证明或强制该更新；执行时权限与结构化更新协议属于未来 runtime。

### Variable type capability constraint (2026-10-25)

DSL variable declarations must use the current canonical variable type inventory, not types invented for an example or returned by an API. The current implementation supports the following exact, case-sensitive keywords:

| Variable panel label | Canonical dataType | DSL keyword |
| --- | --- | --- |
| String | string | string |
| Number | number | number |
| Boolean | boolean | boolean |
| Object / JSON | json | json |

Object / JSON is the UI label for the existing json type; it is not a separate object type. Json, JSON, object, array, integer, map, and custom record names are not valid declaration keywords. Objects and arrays can be values of a json variable, not additional variable types. This applies to both Agent and Task-local declarations.

Sources: packages/schemas/src/workflow/variables.ts (variableDataTypeSchema), apps/web/src/features/workflow-editor/AgentVariablesPanel.vue (dataTypeOptions), and the DSL compiler's declaration type checks. Keep the language, editor, and canonical schema aligned when capabilities change. An API returning an object does not authorize a new variable type.

Use type-compatible literal defaults: string text must be quoted; number and boolean use their corresponding literals; json can contain JSON values. A JSON-encoded string is still a string, not a json object, and JSON.parse/stringify in a script is an explicit conversion rather than an implicit DSL feature. A quoted string containing braces does not become an object automatically.

Object member access and indexing remain unsupported in DSL variable references. To branch on validation.requiresReview, a script_execution step must explicitly extract and validate a boolean into a declared boolean variable; writing agent.validation.requiresReview in a Branch is not supported. Compilation checks configuration and references, not the future runtime types of tool responses.

### 4.2 引用与作用域

- `agent.topic`：当前 Agent 变量；Loop body 可读取同一 Agent 状态。
- `task.cached`：仅当前 Task 的局部变量；其他 Task、Agent Action、Branch 和 Loop 退出条件不可访问。
- `sys.current_message`：由显式 system-variable inventory 解析到 UUID；缺少 inventory 或名称未知时报错，不能虚构系统变量，也不把它们加入用户 variables。
- 不提供裸变量名简写，减少别名与作用域歧义。
- Task 局部变量语法是 `类型 alias [= JSON值];`，不带 ownership 和 Agent metadata。
- 不提供 Loop 局部变量、对象路径访问、数组索引、节点 `.output`、算术、函数调用或隐式类型转换。

一个值是 JSON literal、变量引用或字符串模板。变量引用映射 `{ kind: "variable", variableId }`；模板映射 text/variable segments；其他值映射 literal。数组和对象内部不能嵌套变量引用，因为当前 JSON ValueSource 无法表达；需要动态构造时使用配置好的 script Tool。

## 5. 资源与 Reusable Tools

### 5.1 直接引用已有资源

```odyssey
agent_action "research" {
  model "gpt-5";
  goal "Research the product.";
  knowledge ["Product Docs"];
  toolbox ["Product Lookup"];
}
```

编辑器负责加载供用户选择的 Knowledge Spaces、当前 AgentReusableTools 与 System Tool definitions，并向 compiler 显式传入 inventory；compiler 不自行查询网络。Knowledge 与 Toolbox 中的字符串表示名称引用；它们不是 ValueSource，不执行插值。不提供 `id` 引用或 UUID fallback，用户不需要知道内部 ID。

名称以 `NFC(trim(name))` 为匹配键，大小写敏感；重名、缺失、不可用都报错，不按列表顺序挑选。trim 去除 Unicode White_Space 集合的首尾字符，并明确包含 U+FEFF（与 ECMAScript trim 一致）；保留中间空白，不做 NFKC、case-fold 或同形字替换。规范化后空名称非法。Printer 输出当前规范名称。这里只引用 Knowledge Space，不创建、复制或导出其正文。

名称唯一性是本轮确认的产品要求，尚不表示数据库已有对应约束：

| 对象 | 唯一性范围 |
| --- | --- |
| Knowledge Space | 当前 Workspace 内 |
| AgentReusableTool | 所属 Agent 内，包括本文件新建工具与应用后保留的已有工具 |
| System Tool definition | 工具类型目录内，使用固定唯一类型名，如 api_request |

不同类别可以同名，由 knowledge/toolbox/using system_tool 的语法位置区分。创建、重命名、唯一性校验和编译解析必须使用同一匹配键；新的资源名称保存为规范化值。历史数据不批量改名：读取时计算匹配键，碰撞阻止有歧义的引用，提示先修正，不自动合并。Product Docs 与 product docs 仍为不同名称；组合/分解 Unicode 字符及首尾空白不能用于规避唯一性。

资源重命名不改变 canonical UUID，Canvas 已有绑定继续有效，Printer 使用新名称。未应用草稿若基于旧 inventory，则进入 stale 并要求重新检查；不得把旧名静默绑定到后来占用同名的新资源。会话保留 name→UUID 解析基线以检测变化，不能仅重查名称后悄悄替换。独立旧 DSL 文件没有基线时只能按当前 inventory 解析，无法证明历史身份；跨时间复用需审阅当前绑定，JSON 保留内部身份信息。

加载整个目录供选择不等于授权整个目录：只有 knowledge/toolbox 明确列出的资源才绑定到该 Agent Action。Toolbox 的已有工具引用只匹配当前 Agent 拥有的 AgentReusableTool；System Tool definition 是工具类型，不能仅凭类型名称当作已配置的 Reusable Tool，也不能跨 Agent 直接引用私有工具。

### 5.2 工具选择与配置

- 选择已有 AgentReusableTool：在 toolbox 中直接写名称，无须 tools 声明。
- 创建 Task Tool instance：在 Task steps 内选择 System Tool kind 并写完整 config；目录提供能力类型，不能替代实例参数和输入输出绑定。
- 新建一个供多个 Agent Actions 使用的共享工具配置：可选使用 tools 分区并以 alias 引用，格式见下。字符串名称引用 inventory，裸 alias 只引用本文件 tools，二者不隐式回退；新配置的最终 name 仍须在所属 Agent 内唯一。

可选集中定义示例：

```odyssey
tools {
  reusable_tool lookup using system_tool knowledge_retrieval {
    name "Product lookup";
    config {
      knowledgeSpaceId = "Product Docs";
      topK = 5;
    }
    input_bindings [];
    output_binding none;
  }
}
```

引用此新配置时写 `toolbox [lookup];`。`knowledgeSpaceId` 在 DSL 中仅接 Knowledge Space 名称字符串，编译器解析为 UUID。该字段名暂沿用 canonical 配置名，其中的 Id 不表示用户需要填写 ID。

- `name` 默认 alias；`input_bindings` 默认 `[]`，元素为 ValueSource。
- `output_binding` 为 `none` 或 `{ sourceKey: "…", targetVariable: agent.key }`，映射 canonical `outputBinding`；目标限当前 Agent 可写变量。
- `sourceTemplateId` 是内部 provenance，不作为 DSL 参数暴露：新配置默认为 null；编辑已有配置时由会话上下文保留。独立文本不能无损携带原始模板来源，完整保真使用 JSON。
- Reusable Tool 配置与同类 Task Tool 共用配置合同；唯独 knowledge retrieval 的 `query` 可省略，表示由使用者提供。
- Task 在本版只声明自己拥有的完整工具步骤，不直接引用 Reusable Tool 作为 live step；这与当前 Task JSON 存储形态一致。

### 5.3 JSON 自包含与反向打印

canonical document 中 knowledgeSpaceIds 是独立资产引用，reusableTools 则是 Agent 拥有的配置集合。compiler 引用 inventory 中的已有 Reusable Tool 时，必须把其完整配置快照及依赖纳入输出 reusableTools，不能只输出 toolbox ID。多次引用按 ID 去重；显式引用的工具依赖其他资源或变量时继续校验，缺失时报错，不隐式新建变量。

页面内应用时还须保留当前文档未被节点引用的 AgentReusableTools，避免整份替换造成无关工具丢失；不从 workspace-wide 类型目录复制所有工具。具体保留集合由显式当前文档 context 提供。新建文件没有此 context 时，仅输出本文件新定义或明确引用的工具。

JSON → DSL Printer 为了重建配置，应在可选 tools 分区输出文档拥有的工具配置快照（包括未被引用的工具），并通过 alias 绑定节点。编辑已有文档时，会话基线识别这些声明对应的已有对象，保留 ID；这是更新同一配置，不是创建同名副本。全新导入时仍验证目标名称唯一性，不静默覆盖同名工具。手写直接选择与反向打印展开配置共用同一 JSON 合同，但独立 DSL 文本不携带原始 UUID/provenance。

## 6. 节点

所有普通节点格式为 `节点类型 "名称" { ... }`。名称直接作为同图连线引用，不再提供节点 alias 或块内 name 属性。同图名称按 NFC(trim(name)) 匹配且必须唯一，大小写敏感；原始名称文本保留。`nodes` 中仅允许四类普通节点，以及用于往返的可选边界声明。

### 6.1 Agent Action

```odyssey
agent_action "Research" {
  model "gpt-5";
  goal "Research ${agent.topic}; update the shared findings.";
  knowledge ["Product Docs"];
  toolbox ["Product Lookup"];
}
```

`model`、`goal` 必填；knowledge/toolbox 缺省为空列表，引用不得重复。Goal 是 ValueSource，但静态可知值必须为字符串。节点不新增 canonical 尚不支持的通用 output 字段。

### 6.2 Task 与工具步骤

```odyssey
task "summarize" {
  variables {
    string cached;
  }
  steps {
    step draft using system_tool llm_call {
      config {
        model = "gpt-5";
        prompt = "Summarize ${agent.topic}.";
      }
      output "response.text" -> task.cached;
      on_failure retry 2;
    }
    step store using system_tool set_variable {
      config {
        targetVariableId = agent.brief;
        operation = assign;
        value = task.cached;
      }
      on_failure fail_task;
    }
  }
}
```

`variables` 可省略，`steps` 必须存在但可为空。steps 按声明顺序生成数组。step alias 在当前 Task 唯一；`output` 缺省为 null，`on_failure` 缺省 `fail_task`。仅支持现有 `retry 2`（映射 `maxAttempts: 2`），不扩展其他重试次数。

`config` 内每项为 `field = value;`。普通对象内部用 `key: value`；仅配置合同明确标记为变量或资源引用的位置才接受引用。未知字段和缺失必填字段均报错。

schema 明确规定的枚举字段可使用裸枚举词（如 `POST`、`assign`、`kind: form_data`）；它们不是通用 JSON literal。变量默认值或其他普通 JSON 数据中的字符串必须加引号。不同 config 字段没有未声明的隐式默认值。

| Tool kind | config 必填字段 | config 可选字段 | output sourceKey |
| --- | --- | --- | --- |
| knowledge_retrieval | knowledgeSpaceId、query | topK（正整数） | retrieved_documents |
| script_execution | language、script | inputs | result |
| api_request | method、url、headers、body | 无 | response.data |
| set_variable | targetVariableId、operation；除 toggle 外必须 value | 无 | 不允许 output |
| llm_call | model、prompt | systemPrompt | response.text |

字段约束：

- `query`、`url`、header/form value、`value`、`prompt`、`systemPrompt` 是 ValueSource；其他字段按 schema 静态解析。
- script language 是 `python` 或 `javascript`；script 是原样字符串，不做插值。inputs 为 `[{ alias: "topic", variableId: agent.topic }]`，alias 遵循现有脚本输入约束且不得重复。
- API method 为 `GET / POST / PUT / DELETE`；headers 是 `[{ name: "Accept", value: "application/json" }]`，名称大小写不敏感去重。
- API body 是 `{ kind: none }`、`{ kind: json, value: <ValueSource> }` 或 `{ kind: form_data, entries: [{ name: "topic", value: agent.topic }] }`。
- set_variable operation 为 `assign / append / increment / toggle`；toggle 不写 value。increment 要求 number 目标；toggle 要求 boolean；append 限 string/json，json 的运行值是否为数组仍需 runtime 检查。
- Tool 输出只能绑定可写 Agent 变量或当前 Task 局部变量；不得以 Task Tool 修改 agent_managed / System / read_only 变量。
- 输出类型无法静态确定时不宣称验证成功的运行类型；类型明确不兼容时报错，动态值在 runtime 校验。当前没有 runtime，不能把编译成功解释为执行成功。

### 6.3 Branch

```odyssey
branch "review" {
  case "approved" {
    when agent.approved == true;
    when agent.confidence >= 0.8;
  }
  default;
}
```

- case 按声明顺序求值；每个 case 至少一个 `when`，内部条件全为 AND。至少且恰好一个 `default`，位于 cases 之后。
- 可用 `case "Approved" { ... }` 与 `default "Needs revision";` 保存显示标签，Case 必须显式给出名称，Default 标签缺省为 `Default`。
- 条件支持二元 `== != > >= < <= contains not_contains`，一元 `is_empty is_not_empty`。
- 不支持 OR、NOT、括号逻辑组合、任意函数或表达式计算。静态可知的比较类型必须兼容；contains 限字符串/JSON 集合语义，一元判空的 runtime 边界须在未来执行合同中细化。
- Case 名称在同一 Branch 内按 NFC(trim(name)) 唯一，大小写敏感。允许名称为 "default"，通过 ."default" 引用，与裸 .default 区分。
- 路由只写在 edges：`"review"."Approved" -> "publish";`、`"review".default -> "revise";`。条件块内不能写目标。
- sourceHandleId 对应 case/default 的稳定 UUID，而非显示名称。

### 6.4 Loop

```odyssey
loop "refine" {
  max_turns 5;
  exit_when agent.approved == true;
  nodes {
    agent_action "revise" {
      model "gpt-5";
      goal "Improve the brief and update shared state.";
    }
    task "validate" {
      steps {
        // 配置校验步骤，更新 agent.approved
      }
    }
  }
  edges {
    loop_start -> "revise";
    "revise" -> "validate";
    "validate" -> loop_end;
  }
}
```

`max_turns` 为必填正整数；`exit_when` 必填，只支持 `Agent/System变量 比较运算符 JSON字面量`，比较运算符限 `== != > >= < <=`。这对应当前 `variable_comparison`，不是集合遍历、任意 Branch 表达式或 LLM 退出评估。

一轮到达 loop_end 后检查退出条件；满足或达到最大轮次后退出，否则进入下一轮。因此即使初始条件已满足，也先运行一轮，和现有执行模型一致。最大轮次退出不表示业务目标必然达成。

Loop body 允许 Agent Action、Task、Branch，禁止 Loop；独立节点名称命名空间、图和布局，但共享 Agent 变量与资源。不能连接内外节点，也不能从一个 Loop body 引用另一个 body 节点。Loop 本身不创建新 AgentWorkflow。

### 6.5 Start、命名 End 与父级出口

默认边界节点采用分号简写：`start;`、`end;`，Loop body 使用 `loop_start;`、`loop_end;`。简写不带名称或配置；名称分别为 Start、End、Loop Start、Loop End。已有单 End 的 binding 保持不变。重复声明仍报错；多 End 时不能用 end; 替代命名出口。

Start 仍隐式唯一；可写 `start "Start" {}` 保留显示名称。单 End 场景可写 `end "Finish" {}`，或省略声明；多 End 场景每个 End 都必须按名称声明并写 exit：

```odyssey
end "Accepted result" {
  exit "Accepted";
}
end "Rejected result" {
  exit "Rejected";
}
```

exit 引用父 Pattern 提供的既有出口，不是目标 Agent 名称。DSL 不能创建、删除或改绑 Pattern-owned End。单 End 的 exit 可省略，保留既有 binding；多 End 必须精确覆盖当前已有出口。

连线可引用 `"Accepted result"`。`start`、`end`、`loop_start`、`loop_end` 是隐式边界的专用裸关键字，end 仅在单 End 时可用；普通节点引用必须带双引号。同图声明的边界名称也参与唯一性检查。Loop body 的边界可写 `loop_start "Loop Start" {}`、`loop_end "Loop End" {}`，不允许 exit。

#### 父级 exit inventory 合同

当前 PatternRoute 只有 ID、sourceSlotId、target；Slot.label 也没有唯一性约束。仓库目前没有可直接采用的稳定出口名称，因此以下是实现前必须补齐的合同，而非声称已有功能：

- Pattern 层为当前 source Slot 的合法 EndBinding 提供 `{ name, binding }` inventory 及版本。binding 使用现有 sourceSlotId/target；内部按 binding key 识别，名称不是身份。
- 出口名称在同一 Pattern 的同一 source Slot 内按 NFC(trim(name)) 唯一。创建/重命名在父级配置完成，不在 DSL 创建；目标 Agent 换人、重命名、Slot 排序不改变该 binding 的出口名。
- 无 route 时，沿用 deriveEndBindings 的 journey_end fallback，提供默认名称 `Journey End`；有 route 时每个不同合法 binding 有一个出口名，不能从 Agent 名称或数组下标临时猜测。
- 用户可在父级设置 Accepted / Rejected 等业务标签。名称 metadata 的具体存储字段与迁移另行设计；完成前，涉及命名出口的编译返回 context-required，而不是生成假的 binding。
- 缺失/重名/旧 binding 不再合法必须诊断；出口改名或同名替换触发会话 stale，沿用资源绑定基线规则。
- Printer 将 binding 解析成出口名称；未绑定的单 End 保持简写。多 End 中存在 unbound End 或无法反解的 binding 时报告 ODSL602 并保留原配置，不私自补路由。

相关代码来源：packages/schemas/src/pattern/pattern.ts 与 packages/schemas/src/workflow/routing.ts。父级合同需要 schema/application 支持，但本轮只更新 DSL 设计，不修改数据库或产品代码。

## 7. 连线

```odyssey
edges {
  start -> "research";
  "research" -> "review";
  "review"."Approved" -> "publish";
  "review".default -> "refine";
  "refine" -> "publish";
  "publish" -> end;
}
```

- 每个声明生成一条 edge；禁止 `a -> b -> c;`。
- 只有 Branch source 使用 `."Case 名称"` 或 `.default`；目标只能是同图节点名称或隐式边界关键字。
- Start 不接入边，End 不发出边，Loop 边界遵循相同限制。
- 禁止自连接、语义重复边、非法 source handle、每个 Branch 出口多条边、跨图引用和任意有向环。
- 普通节点多个出边如何执行属于未冻结 runtime 语义；本版不新增 fan-out 语法或并发承诺，发现此情况给 warning，后续评审决定是否限制。
- 未连接出口、不可达节点及无法到达 End 属于 readiness 问题，按第 10 节已确认的 warning 策略处理。

## 8. Layout 与 identity（往返支持提案）

### 8.1 Canvas 布局独立管理

DSL 不包含 layout、节点坐标、容器尺寸或 viewport，主图与 Loop body 均遵循此规则。Printer 不输出这些字段；输入 layout 分区按未知语法报错。

布局仍保存在 canonical JSON，由 Canvas 管理。编译与 Apply 使用当前 Canvas 的布局：保留已有节点位置、尺寸和 viewport，删除已移除节点的 placement，仅为新增节点分配初始位置。仅布局变化不刷新 DSL 文本，也不使草稿 stale。JSON bridge 中存在 layout 不代表它属于 DSL 语言。

### 8.2 内部 identity（不进入用户语法）

DSL 不提供 `@id(...)`；节点、变量、步骤、条件、边及 API header/form entry 的 UUID 由 compiler 和编辑会话管理。名称/alias 是用户侧符号，canonical UUID 仍是持久化引用，不把数据库业务引用改成名称。

- Canvas → DSL 时记录内部符号与 UUID 的基线映射；同一会话重新编译时复用已识别对象的 ID。
- 新声明通过注入的 ID factory 创建，测试使用确定性 factory；不能把显示名称当作全局身份。
- rename、重排、删除后新建不能仅按新文本名字猜测原对象。不能确定匹配时须进入明确的新增/删除或冲突处理流程，禁止宣称自动保留 identity。
- 纯 DSL 文件脱离编辑上下文后，仅承诺配置语义可重建，不承诺 UUID、sourceTemplateId 等内部元数据逐项相同；完整保真导出使用 JSON。
- identity 分区仅保留 `variable_key alias "原key";` 的可选提案，用于 canonical key 不满足标识符规则的情况；Task 内可有一个用于局部变量的 identity 分区。它不承载 UUID，alias 用于解析，canonical key 保留原值。

内部基线映射、rename 匹配及冲突策略必须在 compiler/Apply 实现前明确并测试；不因移除用户 ID 参数而静默牺牲已有 Canvas 对象身份。本节不宣称已经实现无损往返。

## 9. JSON 映射合同

| DSL | canonical document |
| --- | --- |
| 主图 nodes / edges | workflow.nodes / workflow.edges |
| variables | variables |
| tools | reusableTools |
| knowledge/toolbox 中的直接名称引用 | 经 inventory 解析为 UUID；已有 Reusable Tool 配置快照纳入 reusableTools |
| Canvas 布局（无 DSL 语法） | 保留当前 layout |
| Agent Action model / goal / knowledge / toolbox | config.model / goal / knowledgeSpaceIds / reusableToolIds |
| Task variables / steps | config.localVariables / steps |
| Branch case / when / default | config.cases / conditions / defaultCase |
| Loop max_turns / exit_when / nodes / edges | config.maxTurns / exitCondition / body.graph |
| step config / output / on_failure | configuration / outputMapping / failureBehavior |

条件运算符分别映射 `eq / neq / gt / gte / lt / lte / contains / not_contains / is_empty / is_not_empty`。Loop 的同名比较映射前六种。

编译器输出 `{ workflow, layout, variables, reusableTools }`。adapter 再写出现有 `AgentWorkflowExport` envelope，注入显式 export context 的 journeyId、agentId 与时间，workflow 名称作为 source 标签。文件不可缺少 envelope，也不能由纯 compiler 随机读取系统时钟或猜测目标身份。

既有 JSON Import 可能为导入目标 remap owned IDs；这与 DSL Printer/Compiler 在同一文档中保留 identity 是不同操作。后续页面 Apply 必须明确使用哪种替换策略，不得把跨 Agent 导入的 ID remap 与原文档往返混为一谈。

## 10. 检查合同与未完成草稿

- 词法/语法、名称与作用域、静态类型、ownership、资源、结构不变量错误：error，阻止配置 JSON 导出和 Apply。
- **已确认（2026-10-22）**：readiness 问题是 warning，允许保留结构合法的未完成编辑草稿，和现有 Import 只阻断结构错误的行为一致。显示“工作流尚未就绪”，不宣称可以运行。
- warnings 不掩盖 references/config 的真正错误，不因用户选择草稿模式而跳过权威校验。
- 编译失败返回 AST（可部分恢复）与 diagnostics，但不返回可应用 document；成功返回完整 JSON 配置与 warnings。
- 每条 diagnostic 包含稳定 code、severity、messageKey、source span，可包含相关声明位置。span 使用 UTF-16 offset、从 1 开始的 line/column、结束位置不包含在 span 内；CRLF 算一次换行。
- 编辑器对新文本 debounce 检查、丢弃过期结果、标红并支持 Problems 跳转；不完整文本不修改 Canvas。
- 编译器不执行脚本、模型调用或网络请求；resource inventory 由外部提供。

错误示例：

```odyssey
// 未声明变量：定位到引用
goal "Research ${agent.missing_topic}.";

// 非法链式边：定位到第二个箭头
start -> research -> end;

// 不存在的 Branch 出口：定位到 absent
"review".absent -> end;

// Tool 越权目标：定位到 targetVariableId 的引用
targetVariableId = agent.confidence; // confidence 是 agent_managed
```

## 11. 核心结构 grammar 摘要

下面用 `?`、`*`、`|` 表示可选、重复和择一。此摘要覆盖结构；值、工具字段、metadata 和 ID 约束以各节为准，不是可以直接交给 parser generator 的完整 EBNF。

```text
workflow       := "workflow" string "version" string "{" section* "}"
section        := variables | tools | nodes | edges | identity
nodes          := "nodes" "{" (action | task | branch | loop | boundary | end_decl)* "}"
action         := "agent_action" string "{" action_field* "}"
task           := "task" string "{" local_variables? steps identity? "}"
steps          := "steps" "{" step* "}"
step           := "step" identifier "using" "system_tool" tool_kind
                  "{" config output? failure? "}"
branch         := "branch" string "{" case* default "}"
case           := "case" string "{" when+ "}"
when           := "when" condition ";"
default        := "default" string? ";"
loop           := "loop" string "{" max_turns exit_when
                  nodes edges "}"
boundary       := ("start" | "loop_start" | "loop_end") ( ";" | string? "{" "}" )
end_decl       := "end" ( ";" | string? "{" ("exit" string ";")? "}" )
edges          := "edges" "{" edge* "}"
edge           := endpoint ("." (string | "default"))? "->" endpoint ";"
endpoint       := string | "start" | "end" | "loop_start" | "loop_end"
```

标量字段顺序在各节点内不限，重复字段报错；Task 的 variables/steps 各最多一个；Loop 内只能有 body 允许的节点类型。正式实现前应补齐完整机器可检查 grammar 和恢复同步点（`;`、`}`、声明起始词）。

## 12. 评审与后续门槛

完整示例见 [examples](./examples/README.md)。示例与编译器回归测试同步维护。运行语义未冻结的部分仍以合同评审为准。

请优先评审：

1. 明确的 `agent.` / `task.` 引用与字符串插值是否合适？
2. Tool 采用 `steps / config / output / on_failure` 是否清楚？
3. Branch 的 `case / when / default` 及出口写法是否自然？
4. readiness warning 与命名 End 已确认；后续核验实现与父级出口 inventory 合同一致。
5. 多行文本、Canvas 独立布局与内部 identity 基线策略是否接受？

开始检查器前，还须补齐完整 grammar、锁定 ID policy、核对 canonical capability matrix 与 fixture round-trip，并确认运行语义尚未冻结的比较细节。不得把本评审稿的存在当作自动授权开始实现。



## 节点名称语法决策（2026-10-22）

节点名称写在类型后：`agent_action "Research" { ... }`；节点块内 name 属性及旧节点 alias 写法均报错。此改动仅涉及节点；Reusable Tool 的 name 和 step alias 不变；case 改为名称引用。主图与每个 Loop body 分别检查名称唯一；重名 Canvas 会给出阻断诊断，不能静默改名。

内部符号仍映射到 UUID。仅改名且节点内容未变时，可通过唯一结构匹配保留节点及其子对象 ID；匹配有歧义时要求用户 review，绝不按数组位置猜测。Canvas 改名后 Printer 按 UUID 重新生成所有连线名称。布局不进入 DSL。

Printer 对默认名称、无额外 DSL 配置的边界输出分号简写；自定义名称或多个命名 End 仍输出完整块，保留名称与出口绑定。

### Branch Case 名称决策（2026-10-23）

使用 `case "通过" { when ...; }`，不再提供 Case alias。连线使用 `"审核"."通过" -> "发布";`，Default 固定通过 .default 引用。Case 名称按 NFC(trim(name)) 匹配、大小写敏感、同 Branch 唯一；不同 Branch 可重名。UI 与 DSL 均拒绝空名称和重名。Case 调序保留 ID 与连接；单纯改名可唯一匹配未变条件时保留 ID，歧义时要求 review。

## 下一版直接绑定约束（已确认，待实现）

`knowledge ["Document Curator Playbook", $sys.target_knowledge_space$];` 与 `knowledgeSpaceId = $sys.target_knowledge_space$;` 直接引用同一个运行目标。普通整值引用统一迁移为 `$agent.key$` / `$task.key$` / `$sys.key$`；字符串内 `${agent.key}` 保留文本插值。带引号的 `$...$` 是字面字符串，变量默认值仍为字面量。具体词法、类型、位置、触发输入与 JSON 往返约束以[直接变量绑定设计](./runtime-variable-binding-design.md)为准。不得把普通 string/json 当作资源引用，不新增用户变量类型，不开放任意对象成员访问。

## Runtime binding implementation amendment — DSL 0.2

The accepted [runtime binding implementation contract](./runtime-variable-binding-design.md#10-implementation-contract-2026-10-25) defines the executable 0.2 extension and canonical graph 1.2.0. Old 0.1 syntax remains supported. Whole-value references in 0.2 must use `$agent.key$`, `$task.key$` or registered `$sys.key$`; `${...}` inside strings remains interpolation. `ODSL007` reports malformed bindings, `ODSL008` reports old bare reference syntax in 0.2, and `ODSL206` reports unknown/wrong-role system keys. Read-only system destinations use `ODSL302`. System keys are typed separately from ordinary variables, which retain string/number/boolean/json.

Knowledge lists and both retrieval configuration surfaces accept `$sys.target_knowledge_space$`. Known system bindings do not require a runtime event instance during validation or persistence. Resource and primitive roles cannot be interchanged. Upgrade uses compile/print to preserve semantic identity and layout while normalizing source formatting/comments; Apply remains explicit.
