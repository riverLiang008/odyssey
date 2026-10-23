# Odyssey DSL V0.1 语法与语义检查规范

> Status: Draft — 待评审；不是检查器实现完成报告  
> Date: 2026-10-22  
> Depends on: [语言规范](./odyssey-workflow-dsl-v0.1-spec.md)、[RFC](./agent-workflow-dsl-v1-rfc-implementation-plan.md)  
> Examples: [完整案例](./examples/README.md)、[检查验收案例](./validation-cases.md)

## 1. 目标、范围与批准状态

为编辑器实时提示和 `DSL → canonical JSON` 编译定义同一检查合同。合法输入生成完整配置；非法输入给出可定位诊断，不能生成可应用的部分结果。检查器不修改 Store，不执行模型、脚本、网络或工具。

沿用已确认的单条连线、nodes/edges 分区、Loop body、名称引用与名称唯一性决策。本文中的错误码、完整语法细节、恢复规则、类型比较策略仍为本轮评审提案；readiness warning、命名 End 和名称规范化已于 2026-10-22 确认，其余规则不因写入文档而视为已获批准。

### 1.1 End 与 Pattern 合同

2026-10-22 已确认支持命名 End 与父级出口选择，详见语言规范第 6.5 节。现有 graph schemaVersion 支持 1.0.0/1.1.0，binding 要求 1.1.0；不得静默降级。

主图单隐式 end 与显式命名 Ends 互斥。命名 End 必须选 exit，Loop body 仍为唯一 loop_end。父级提供唯一命名的合法 EndBinding inventory，不接受 DSL 修改 Pattern 或填写 Slot ID。现有 Pattern 尚无出口名字段，父级 metadata 与 inventory 合同必须先实现；缺该 context 返回 ODSL504，而非伪造绑定。

Printer 可在完整 context 下表达多个已绑定 End；无法反解出口名、多个 unbound End 或其他未覆盖语义才报 ODSL602。原配置始终保留，不能丢出口后继续 Apply。

## 2. 输入、输出与上下文

一次检查显式接收 source、DSL version/capabilities、inventory snapshot、可选 current-document/identity baseline。inventory 包含 Knowledge Spaces、当前 Agent 的 Reusable Tools、System Tool definitions、System Variables 及内部 ID、名称、类型和 ownership。快照必须能标识其版本。

资源仍未加载时，不把“暂时没有列表”解释为“名称不存在”。词法/语法检查继续执行，结果为 context-required，不返回可应用 document；UI 显示等待资源。加载失败由 application 层处理，不伪装成源文本拼写错误。无外部引用的独立文本可使用显式空 inventory。

结果分三类：

| 结果 | 含义 | document |
| --- | --- | --- |
| checked | 全部必要检查完成且无 error，可含 warning | 完整 canonical 配置 |
| invalid | 存在源文本错误、配置错误、结构错误或不支持的合同 | 无 |
| context-required | 资源未准备好、身份映射不确定或基线 stale | 无 |

三类均允许返回可恢复 AST 和 diagnostics；AST 不等于可应用结果。UI 不以 diagnostics 数量为零作为唯一 Apply 条件。导出 envelope 的时间/Agent 来源由 adapter 提供，缺失 export context 不属于用户 DSL 的语法错误。

## 3. 词法与 grammar

### 3.1 Token 规则

- 标识符 `[A-Za-z_][A-Za-z0-9_]*`；数字采用 JSON number，拒绝非有限数值。
- 符号包含 `{ } [ ] ( ) ; , : . = -> == != > >= < <=`，按最长合法 token 匹配。
- `//` 与非嵌套 `/* ... */` 仅在字符串外生效；字符串内的箭头、括号和注释符不作为结构。
- 普通双引号字符串不含未转义换行，接受 JSON escapes 及 DSL 的 `\$`。三双引号 raw-string 按语言规范处理，不自动去缩进。
- 插值是 ValueSource 字符串的后续解析：`${` 后仅接受 namespace.key，再接 `}`；非 ValueSource 字符串和 literal(...) 不解析插值。
- UTF-8 解码属于文件 adapter；lexer 接收已解码文本，开头 BOM 可忽略但保留原始 offset。LF/CRLF 不改变语义，raw-string 正文换行不归一化。

### 3.2 结构 grammar（评审用 EBNF）

`{ X }` 表示重复，`[ X ]` 表示可选；引号内是终结符。IDENT/STRING/RAW/NUMBER 由 lexer 提供，EOF 是输入结束。STRING 可含 escape，RAW 是三双引号字符串。下列所有非终结符均在此定义；配置中的字段类型与允许位置由第 5 节继续收紧，不能因为 grammar 接受就直接输出 JSON。

```ebnf
document       = "workflow", STRING, "version", STRING, "{", { section }, "}", EOF ;
section        = variables | tools | nodes | edges | identity ;
variables      = "variables", "{", { variable }, "}" ;
variable       = type, ownership, IDENT, [ "=", json ], ( ";" | metadata ) ;
type           = "string" | "number" | "boolean" | "json" ;
ownership      = "user_managed" | "shared" | "agent_managed" ;
metadata       = "{", { meta_field }, "}" ;
meta_field     = ( "display_name", STRING | "description", STRING
               | "read_only", boolean ), ";" ;
locals         = "variables", "{", { type, IDENT, [ "=", json ], ";" }, "}" ;
identity       = "identity", "{", { "variable_key", IDENT, STRING, ";" }, "}" ;
tools          = "tools", "{", { reusable }, "}" ;
reusable       = "reusable_tool", IDENT, "using", "system_tool", IDENT,
                 "{", { reusable_item }, "}" ;
reusable_item  = name | config | "input_bindings", value_list, ";"
               | "output_binding", ( "none" | binding ), ";" ;
binding        = "{", "sourceKey", ":", STRING, ",",
                 "targetVariable", ":", variable_ref, [ "," ], "}" ;
nodes          = "nodes", "{", { node }, "}" ;
node           = action | task | branch | loop | boundary | end_decl ;
name           = "name", STRING, ";" ;
action         = "agent_action", STRING, "{", { action_item }, "}" ;
action_item    = "model", STRING, ";" | "goal", value, ";"
               | "knowledge", name_list, ";" | "toolbox", tool_list, ";" ;
task           = "task", STRING, "{", { task_item }, "}" ;
task_item      = locals | steps | identity ;
steps          = "steps", "{", { step }, "}" ;
step           = "step", IDENT, "using", "system_tool", IDENT,
                 "{", { step_item }, "}" ;
step_item      = config | "output", STRING, "->", variable_ref, ";"
               | "on_failure", ( "fail_task" | "retry", NUMBER ), ";" ;
branch         = "branch", STRING, "{", { case }, default, "}" ;
case           = "case", STRING, "{", when, { when }, "}" ;
when           = "when", condition, ";" ;
default        = "default", [ STRING ], ";" ;
condition      = value, ( binary_op, value | unary_op ) ;
binary_op      = compare_op | "contains" | "not_contains" ;
compare_op     = "==" | "!=" | ">" | ">=" | "<" | "<=" ;
unary_op       = "is_empty" | "is_not_empty" ;
loop           = "loop", STRING, "{", { loop_item }, "}" ;
loop_item      = "max_turns", NUMBER, ";"
               | "exit_when", variable_ref, compare_op, json, ";"
               | nodes | edges ;
boundary       = ( "start" | "loop_start" | "loop_end" ),
                 ( ";" | [ STRING ], "{", "}" ) ;
end_decl       = "end", ( ";" | [ STRING ], "{", { "exit", STRING, ";" }, "}" ) ;
edges          = "edges", "{", { endpoint, "->", node_ref, ";" }, "}" ;
endpoint       = node_ref, [ ".", ( STRING | "default" ) ] ;
node_ref       = STRING | "start" | "end" | "loop_start" | "loop_end" ;
variable_ref   = ( "agent" | "task" | "sys" ), ".", IDENT ;
value          = json | variable_ref | "literal", "(", json, ")" ;
json           = STRING | RAW | NUMBER | boolean | "null" | json_array | json_object ;
boolean        = "true" | "false" ;
json_array     = "[", [ json, { ",", json }, [ "," ] ], "]" ;
json_object    = "{", [ key, ":", json, { ",", key, ":", json }, [ "," ] ], "}" ;
key            = IDENT | STRING ;
name_list      = "[", [ STRING, { ",", STRING }, [ "," ] ], "]" ;
tool_list      = "[", [ tool_ref, { ",", tool_ref }, [ "," ] ], "]" ;
tool_ref       = STRING | IDENT ;
value_list     = "[", [ value, { ",", value }, [ "," ] ], "]" ;
config         = "config", "{", { IDENT, "=", config_value, ";" }, "}" ;
config_value   = value | IDENT | config_array | config_object ;
config_array   = "[", [ config_value, { ",", config_value }, [ "," ] ], "]" ;
config_object  = "{", [ key, ":", config_value,
                 { ",", key, ":", config_value }, [ "," ] ], "}" ;
```

JSON 与 config 的数组/对象存在语法交集，应按当前字段上下文消歧，不产生两种业务解释。bare IDENT 仅在 config 的 enum 位置合法；字段 validator 决定实际类型。ValueSource 的 JSON object 内不接受动态变量；但 API body/headers 的结构记录中，schema 指定的 value 字段允许 ValueSource，这不是 JSON literal 内动态插值。

裸边界词仅在 node_ref 位置指向隐式边界；普通节点必须使用 STRING，允许名称内容为保留词，且与裸边界词区分。关键字作为 config 字段或对象 key 时允许按 word token 读取；普通 alias 禁止结构关键字。实现须把词法保留词和 contextual words 分开，不能因 `json`/`default` 是关键字而拒绝合法字段。

分区、action/task/loop 字段按任意顺序解析，再验证唯一性和必填性；Branch name 在 cases 前、default 在最后，保持 case 顺序。V0.1不接受多 Workflow、链式边、resources、@id、source_template、import/function、任意运算或 .output。

## 4. 诊断合同与位置

建议每条诊断包含 code、severity(error/warning/info)、phase、messageKey、typed 参数、span、related、可选 edits。源码字符串、Goal、脚本、Header 等不写入日志/telemetry。用户界面可展示所引用的变量/资源名，但诊断参数不得自动复制整段敏感配置。

- offset 从 0 开始，按原始 source 的 UTF-16 code unit；line/column 从 1 开始，column 同按 UTF-16。emoji 可占两列；UI 映射到实际字符显示，不改变 offset。
- span 为 `[start,end)`，缺失 token 用当前位置零宽 span，EOF 为 `(source.length, source.length)`。
- CRLF 占两个 offset、一个换行；tab 在位置合同中占一列，视觉展开由编辑器负责。
- 重复声明标第二处，related 指向第一处；未知引用标 alias；缺失字段标 owner 块末尾；非法环主 span 为确定性选出的环上最后一条源边，related 标其余环边。
- 先按 start offset、再按阶段、code、end offset 稳定排序；按 code/span/同一主体去重。不可用对象的后续推导错误被抑制，不按 message 文本判重。
- Quick Fix 仅提供确定的文本编辑，不自动改 ownership、资源选择、路由、模型或业务条件。V0.1 可只显示建议而不提供自动修改。

## 5. 检查规则与错误码

下表是本版完整的 code registry 提案。同一码可覆盖同一规则的多个字段，但不混合不同规则；实现后不能重用旧 code 表达其他含义。以下未特别标 warning/info 的均为 error。

### 5.1 词法与语法

| code | 触发条件 | 主位置 |
| --- | --- | --- |
| ODSL001 | 非法字符/token 或普通字符串内非法控制字符 | 字符 |
| ODSL002 | 字符串未闭合 | 起始引号到恢复点 |
| ODSL003 | 非法转义 | 转义序列 |
| ODSL004 | 块注释未闭合 | 注释起始到 EOF |
| ODSL005 | 数字格式非法或数值不有限 | 数字 |
| ODSL006 | 插值不完整、含计算或不是 namespace.key | 插值内容 |
| ODSL101 | 缺失预期 token，如分号/右括号 | 插入点 |
| ODSL102 | 多余 token、非法声明或废弃语法 | 首个意外 token |
| ODSL103 | 重复 section、字段、对象 key 或 boundary metadata | 第二处声明 |
| ODSL104 | 缺失必需 section/字段/default/config/steps | owner 块末尾 |
| ODSL105 | 非法 alias 或保留词用于声明 | alias |
| ODSL106 | 受限表达式外的计算、链式边、函数/属性访问 | 首个越界操作符 |

字段缺失检查只对语法结构已恢复完整的 owner 执行；未闭合 owner 不再额外报告其所有必填项。版本不支持用 ODSL601，不作为普通 unexpected token。

### 5.2 名称、作用域与引用

| code | 触发条件 | 主位置 |
| --- | --- | --- |
| ODSL201 | 所属 namespace 内节点名称、alias 或变量 canonical key 重复 | 第二个 alias/key |
| ODSL202 | 未声明的变量、节点、case 或本文件 tool alias | 引用 |
| ODSL203 | 引用已知对象但超出 Task/Loop 图作用域 | 引用 |
| ODSL204 | 已解析知识库/工具引用列表包含重复同一对象 | 第二个引用 |
| ODSL205 | identity variable_key 指向未知 alias、重复覆盖或覆盖后 key 冲突 | 覆盖声明 |

节点按所在图唯一；Task 局部变量/step alias 按所属 Task 唯一；Branch case 按所属 Branch 唯一；Agent 变量和本文件 Reusable Tool alias 各自唯一。相同 key 的 agent.x 与 task.x 可并存，因为必须显式 namespace。同图内相同规范化节点名称报错；不同图可重名，内部对象身份由 UUID 区分。

System Variable 只读且必须由 sys inventory 提供。Agent Action/Branch/Loop 不访问 Task locals；Loop body 共享 Agent variables，不拥有新的变量作用域。前向引用合法，不按声明位置误报 unknown。

### 5.3 类型、配置与写入权限

| code | 触发条件 | 主位置 |
| --- | --- | --- |
| ODSL301 | 非 null 默认值、已知赋值或输出类型不兼容 | 值/绑定 |
| ODSL302 | 工具写入 System、agent_managed、read_only 变量 | 目标引用 |
| ODSL303 | config 未知字段、无效枚举、静态字段错误形态或约束 | 字段/值 |
| ODSL304 | output sourceKey 非该工具支持项，或 set_variable 带 output | output |
| ODSL305 | on_failure 非 fail_task/retry 2 | failure 值 |
| ODSL306 | 比较/contains/判空不支持已知操作数类型 | 操作符 |
| ODSL307 | increment/toggle/append 目标类型或参数组合错误 | operation/value |
| ODSL308 | 脚本 inputs alias 重复/格式错误，或 API header 大小写不敏感重名 | 第二条 entry |
| ODSL309 | ValueSource literal 内出现动态引用，或模板引用超出允许形式 | 动态引用 |
| ODSL310 | 保留编号；布局由 Canvas 校验，不属于 DSL | — |

工具字段矩阵以语言规范第 6.2 节及当前 shared schemas 为基准：required query 在 Task 中必须有，在 reusable knowledge tool 中可省略；headers/body 即使为空也要显式配置；toggle 禁止 value；其他 set 操作要求 value；LLM systemPrompt 可选；script 原文不做插值。config 缺字段用 ODSL104，错误字段用 ODSL303，不能重复报两次。

类型检查提案：string/number/boolean 按声明；json 表示 JSON 值而不是任意强制转换。null 默认值不改变声明类型；动态读取可能仍为 null，不能承诺非空。已知字符串与 number 赋值不兼容；json 动态结果无法证明具体类型时推迟 runtime 校验，不因 unknown 就拒绝全部脚本。模板明确产生 string；非字符串变量插值的序列化规则仍待 runtime 合同确认，本版建议只允许 string 插值，其他类型报 ODSL306 或通过 script 显式转换。

比较提案：等值比较允许同类型和与 null 比较；大小比较限两个 number；contains 左侧为 string 时右侧必须 string，左侧 json 时仅检查配置形态、不宣称已确定运行集合类型；判空接受 string/json/null，number/boolean 不接受。json 深比较、空集合/对象和 runtime null 细则仍为待冻结执行语义，不在编译时执行 JavaScript 代替。

读取权限与写权限分离。编译器检查显式 Tool bindings，不从自然语言 Goal 猜测 Agent Action 将写什么，Agent Action 的运行写权限仍须 runtime 根据 ownership 执行。

### 5.4 图与 readiness

| code | 触发条件 | 严重程度 |
| --- | --- | --- |
| ODSL401 | 自连接或语义重复边 | error |
| ODSL402 | Branch 缺失/未知 handle、普通节点误带 handle、同一出口多边 | error |
| ODSL403 | Start 有入边或 End 有出边，含 Loop 对应边界 | error |
| ODSL404 | 任意有向环 | error |
| ODSL405 | Loop 中嵌套 Loop、图中边界类型非法 | error |
| ODSL406 | max_turns 不是正整数，exit_when 非允许比较形态 | error |
| ODSL408 | 隐式/命名 End 混用、命名 End 缺 exit、Loop 内命名 End/exit 或出口不属于当前 source Slot | error |
| ODSL407 | 共享 schema/domain 其他结构拒绝，且尚无更具体映射 | error |
| ODSL451 | Branch case/default 未连接 | warning（已确认） |
| ODSL452 | 节点从 Start 不可达 | warning（已确认） |
| ODSL453 | 节点无法到达任何合法 End | warning（已确认） |
| ODSL454 | 非 Branch/End 节点多个出边，runtime fan-out 未定义 | warning（已确认） |

跨图连线先报 ODSL203；未知节点先报 ODSL202，不再使用其坏边计算环或级联不可达。结构合法后才运行 readiness，根图与 Loop body 分别检查；body 已有具体错误不再重复报一个含糊的 INVALID_LOOP_BODY。后端/领域返回错误必须通过 code 映射，不能解析异常 message 字符串。

### 5.5 资源、上下文和 canonical

| code | 触发条件 | 严重程度/行为 |
| --- | --- | --- |
| ODSL501 | 完整 inventory 中找不到所引用名称 | error |
| ODSL502 | 所引用类别/ownership 范围内名称存在多候选 | error |
| ODSL503 | 新建/保留工具配置导致最终 Agent 内名称冲突 | error |
| ODSL504 | inventory 未准备好或缺失必需能力描述 | info，context-required |
| ODSL505 | 会话资源绑定发生重命名、删除、同名替换或配置版本变化 | info，context-required |
| ODSL506 | 引用工具的配置/变量/知识库依赖无法满足 | error |
| ODSL507 | 会话无法确定持久化对象 identity 的对应关系 | info，context-required |
| ODSL508 | 资源/工具/出口名称规范化后为空 | error |
| ODSL601 | DSL/canonical 版本或目标 capability 不支持 | error |
| ODSL602 | Canvas 当前语义无法由 V0.1 无损表达 | error，保留原文档 |
| ODSL603 | 已通过前置检查但 emission 未通过 canonical schema | error，不提供候选 |
| ODSL604 | 达到诊断预算，结果截断 | info，完整检查未完成，不可提交 |

ODSL603 优先定位对应 AST，找不到 source map 时标 Workflow header，内部报告稳定 issue path。它可能是编译器缺陷，不能让用户靠改无关文本绕过。canonical issue 已有具体诊断时不再补一个重复 ODSL603。

名称唯一范围：Knowledge Space / Workspace、Reusable Tool / Agent、System Tool / definition catalog；跨类别允许同名。已确认匹配键为 NFC(trim(name))，大小写敏感、保留中间空白；trim 集合与语言规范一致。创建、重命名、唯一性校验与解析共用此规则；空匹配键报 ODSL508。Pattern 出口名称在同 source Slot 内唯一。历史未引用重名作为目录治理问题提示 application 层，不污染所有无关 DSL；被引用名称有歧义必须阻断。新建工具与最终保留集冲突同样阻断。

UI inventory 必须已按 ownership 过滤；检查器不查询其他 Workspace 来解释缺失项。模板名称不等于配置实例名称，System Tool 类型不能直接放入 toolbox。复制工具配置快照时按内部 ID 去重，保留 Agent 未引用工具，并检查最终完整文档所有依赖。

## 6. 错误恢复、抑制与确定性

1. 缺分号但下一 token 明确是兄弟字段/声明：在其前报告零宽 ODSL101，虚拟补符号仅用于 AST 恢复；有此 error 仍不生成候选。
2. 未闭合普通字符串到该行结束恢复；raw-string 或块注释缺终止符延伸到 EOF，不能在正文里的花括号假恢复。
3. 同步点是当前容器的 `;`、匹配的 `}` 和合法兄弟声明起始词；始终维护括号深度，不能吞掉父容器结尾。
4. 不认识的嵌套声明跳过其配对块；非法链式边只报第二个箭头附近一个 ODSL106，整条坏边不参与图分析。
5. 重复声明保留 AST 两处并报告；依赖该歧义符号的检查被抑制，不能“第一条获胜”。
6. 缺少字段或引用失效不继续推导其类型；坏节点所在图暂停 readiness，但无关 Task 中的独立错误仍继续检查。
7. 建议最多保留 200 条普通诊断，另加一条 ODSL604。达到预算后结果明确不完整，不可因截断没显示 error 而 Apply。具体输入大小/深度/时间预算须实现前确定，不能承诺任意大文本无阻塞。
8. 恢复每步必须消费 token 或退出当前层，EOF 路径必须结束，不能死循环。相同 source/context/ID policy 产生相同顺序诊断。

## 7. 编辑器与提交门槛

编辑器发送 source revision + inventory revision + document mutation sequence，结果带回同一组标识；任一过期就丢弃。debounce 建议 250ms，可调整但不影响检查语义。组件销毁/路由切换后的返回结果不能更新 session。

| 状态 | 可编辑 | 可导出配置 JSON / Apply |
| --- | --- | --- |
| 检查中、invalid、context-required、结果已过期或截断 | 是 | 否 |
| checked，只有普通 warnings | 是 | 允许；标明未就绪 |
| revision conflict / 正在保存 | 是或由现有页面规则控制 | Apply 禁止；导出当前已检查快照不等于已保存 |

Apply 前针对最新 source 与 context 重新编译/校验，走一次原子替换和既有 autosave/CAS。源文本合法不代表会话允许覆盖新 Canvas；stale recovery 是独立门槛。保存失败保留草稿和候选，不伪造语法错误。

**已确认（2026-10-22）：**ODSL451–454 维持 warning，允许导出/Apply 结构合法的未完成配置，仍须通过 context、stale、完整校验和保存冲突门槛。invalid 文本本身可另存为 `.ody` 草稿，但不能导出成可应用配置 JSON。

## 8. 验收与实现前门槛

验收案例见 [validation-cases.md](./validation-cases.md)。后续测试应断言稳定 code/span/related、候选有无、输入不变、无副作用和恢复能力，不以完整本地化 message 快照为唯一证据。

实现前需要评审：

- 本 grammar 与已有语法提案是否接受；类型比较/插值是否冻结，已确认的 readiness 与名称规范化是否一致落实。
- 多 End 语法已经确认；实现父级命名出口 inventory 与 metadata，验证 binding 往返。
- 内部 identity 与资源快照的匹配和 stale recovery；无用户 UUID 的设计不能靠别名猜测替代。
- ID factory、性能/深度预算与诊断版本；parser 技术在此之后选择。

本阶段只交付规范与案例。后续编写代码须重新完整阅读当前前后端工程规范中适用部分，并通过实际 schema/domain fixtures 验证，不能把本文的规则表当作现有运行实现。


### Canvas 布局边界

主图或 Loop 内的 layout 分区均报 ODSL102。坐标、尺寸、viewport 不进入 DSL。仅布局变化不使草稿 stale；Apply 重新使用当前 Canvas 布局和 mutation sequence，已有节点位置与 viewport 保留，仅为新节点生成位置。

节点名称采用 STRING；同图 NFC(trim(name)) 唯一，重复报 ODSL201，空名称报 ODSL508。旧节点 alias、块内 name 或普通节点裸引用报 ODSL102。不同 Loop body 可重名，禁止跨图引用。未改内容的唯一改名保留 UUID；歧义时 ODSL507，原 Canvas 不变。

边界分号简写（2026-10-23）：start; / end; 仅限主图，loop_start; / loop_end; 仅限 Loop body。简写不接受名称或配置参数；重复边界报 ODSL103；多 End 使用 end; 报错，不创建或删除 Pattern 出口。默认名称简写往返须保持 UUID、布局及既有 End binding。
