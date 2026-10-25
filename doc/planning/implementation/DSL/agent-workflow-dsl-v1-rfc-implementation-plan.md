# Odyssey Agent Workflow DSL V1 RFC 与实施计划

> 2026-10-25 已确认的下一版增量：[直接变量绑定设计](./runtime-variable-binding-design.md)。采用 `$namespace.key$` 使用位置直接绑定，不新增 bindings 分区；资源类型与授权受约束。此设计覆盖下文固定资源/裸引用对下一版的限制，但尚未实现，现有 V0.1 示例继续表示当前 parser。

> 当前语法以 [V0.1 规范](./odyssey-workflow-dsl-v0.1-spec.md) 为准：节点使用 `类型 "名称" { ... }`，连线引用名称，无节点 alias 或块内 name；下文早期草案保留作设计背景。

> 2026-10-22 产品入口澄清：[DSL Edit 双向同步实施计划](./dsl-edit-bidirectional-sync-implementation-plan.md) 为当前交付计划。最终目标是现有面板内 Canvas ↔ DSL 双向编辑，canonical JSON 在内存中桥接，用户无须文件中转。下文“先文件导入”的历史阶段安排不再作为产品交付前置门槛。

> Status: Proposed — JSON bridge 与编辑时诊断方向已确认；具体语法待评审  
> Date: 2026-10-19  
> Discussion decisions updated: 2026-10-20  
> Resource reference decisions updated: 2026-10-21  
> Validation draft: 2026-10-22 — [检查规范](./odyssey-workflow-dsl-v0.1-validation-spec.md) 与 [验收案例](./validation-cases.md)，尚未开始检查器实现  
> Scope: Agent Workflow DSL、编译器、诊断系统、Canvas 双入口同步、LLM authoring contract  
> Depends on: canonical Agent Workflow schema、Workflow JSON Import/Export、Workflow Store atomic replacement、autosave/revision CAS  
> Primary outcome: 用户或 LLM 可以用一份紧凑、可检查的 DSL 创建完整 Agent Workflow，并安全同步到 Canvas

> 2026-10-20 评审入口：[DSL V0.1 语法规范](./odyssey-workflow-dsl-v0.1-spec.md) 与 [完整示例](./examples/README.md)。用户原始草稿保持原样；本 RFC 第 5.2 节旧示例不再作为当前语法提案。具体规则待用户确认，尚未开始检查器实现。

## 1. 背景

Odyssey 第一阶段已经完成 Agent Workflow Canvas、canonical JSON 持久化以及版本化 JSON Import/Export。当前设计复杂案例仍主要依赖 Canvas 手工配置；直接让 LLM 生成 canonical JSON 虽然可行，但存在以下问题：

- JSON 冗长，LLM 输出成本高且难以人工 review；
- ID、引用、Loop body 和 Tool configuration 容易出错；
- JSON 缺少适合人类阅读的意图表达；
- 错误通常只能落到 schema path，难以定位到作者正在编辑的位置；
- Canvas 适合视觉编排，但不适合快速批量生成和复制案例结构。

因此第二阶段优先设计 Odyssey Agent Workflow DSL。DSL 是 Agent Workflow 的文本 authoring surface，也是未来 LLM 生成初始 Workflow 的正式输入合同。

目标流程：

```text
用户 / LLM 生成 DSL
  → Lexer / Parser
  → 带 Source Span 的 AST
  → 语义分析与资源解析
  → canonical Agent Workflow document
  → 现有 atomic replacement command
  → autosave / revision CAS
  → Canvas
```

反向流程：

```text
Canvas mutation
  → canonical Agent Workflow document
  → DSL Printer / Formatter
  → DSL 页面
```

## 2. 已冻结的初步决策

### 2.1 唯一事实来源

canonical `AgentWorkflowEditorDocument` 是唯一持久化事实来源。

- DSL 不是第二份长期业务状态；
- Canvas/Vue Flow view model 不是 DSL 的输入合同；
- DSL 和 Canvas 不互相直接 mutation；
- 两个入口都只能通过 domain/compiler 生成 canonical document，再通过 Store application command 提交；
- 后端 V1 不保存 DSL 源文本，继续保存现有 canonical JSON；是否保存 DSL 草稿留待后续决策。

### 2.2 同步语义

V1 不实现“每输入一个字符就修改 Canvas”的即时双向绑定。

冻结行为：

- Canvas → DSL：canonical document 发生合法 mutation 后，可重新打印为规范化 DSL；
- DSL → Canvas：输入期间持续 parse/check，但仅当 diagnostics 中不存在 error 时，才允许 `Apply to Canvas`；
- DSL 非法或不完整时，Canvas 保留最后一次合法状态；
- Apply 使用现有原子替换、autosave、network retry 和 revision conflict 流程；
- DSL 有未应用修改时，Canvas mutation 或离开页面必须触发明确的冲突/未保存提示；
- 不允许部分编译结果覆盖 Canvas。

### 2.3 导入关系

**2026-10-20 已确认：DSL 通过现有 canonical JSON 合同桥接 Canvas。第一阶段使用实际 JSON 文件中转，后续页面集成可直接在内存中传递同一份 JSON 数据。**

**编译器的核心职责包括将 DSL 转换成 canonical Workflow JSON，而不只是检查语法。** 完整编译包含解析、语义分析、资源解析、图构建与校验，并在成功时产出符合现有 JSON 合同的完整配置数据；失败时返回 diagnostics，不产出可应用的部分配置。编辑时检查复用这条编译链路。

第一阶段验证链路：

```text
用户 / LLM 编写 DSL
  → compiler 检查并生成 canonical document
  → file adapter 包装为现有 AgentWorkflowExport JSON 文件
  → 用户通过现有 JSON Import 导入
  → authoritative schema/domain validation
  → atomic replacement / autosave
  → Canvas
```

文件遵循现有 `AgentWorkflowExport` envelope（`kind`、`formatVersion`、`exportedAt`、`source`、`document`）；compiler 的领域输出为 `AgentWorkflowExportDocument`。导出时间、来源元数据与文件读写由 adapter 负责。

职责边界：compiler 负责 `DSL → canonical JSON 配置数据`；file adapter 负责补齐导出 envelope、序列化并写出/下载 `.json` 文件，不承担 DSL 到 Workflow 的语义转换。

文件阶段用于先验证真实 Case 的语言表达能力，无须先实现完整 DSL Edit 页面。后续页面内 Apply 复用同一 JSON 合同、校验和原子替换入口，无须下载后重新上传。

DSL 编译器不直接调用 JSON Import UI，也不模拟文件上传；文件阶段由用户操作导入，后续由 application 层调用共享提交入口。

正确边界：

```text
DSL compiler output
  → AgentWorkflowExportDocument-compatible canonical payload
  → authoritative domain validation
  → replaceWorkflowFromImport-equivalent application command
```

JSON Import/Export 与 DSL 共用 canonical schema、validation 和 Store transaction，但保留各自的 browser/file adapter。

- 不新增仅供 DSL 使用的持久化 JSON 合同；AST 是语言内部结构，不是第二份 Workflow 数据模型。
- JSON 格式合法仍须经过引用、类型、ownership、资源、Branch、Loop 和图不变量校验。
- 完整验证通过后才能原子应用；失败保留原 Canvas，不应用部分结果。
- 稳定 ID 与引用完整性是编译和往返转换的必要条件；具体 ID/rename 规则仍待冻结。
- 反向链路为 `Canvas → canonical JSON → DSL Printer → DSL`，从语言设计阶段考虑。

### 2.4 LLM 信任边界

LLM 输出永远视为不可信输入：

- 不得直接写 Store、Repository 或后端；
- 必须经过 Lexer、Parser、semantic analysis、resource resolution 和 canonical schema validation；
- 不得因为输出来自受信模型而跳过诊断；
- prompt、Tool header/value、文档内容不得出现在 console 或 telemetry；
- LLM 只负责提出 DSL candidate，编译器是最终权威。

### 2.5 编辑时检查与诊断

**2026-10-20 已确认：Canvas 的 DSL 界面必须在用户编辑时提供检查提示；诊断与语法同时设计。**

| 层次 | 检查内容 |
| --- | --- |
| 语法 | 声明格式、符号与块结构、字符串闭合及转义；分号是否必需由最终 grammar 决定 |
| 语义 | 重复或未知名称、作用域、类型、变量写入权限、输入输出绑定 |
| Workflow/domain | 非法环、Branch 出口、Loop 限制、外部资源缺失或歧义 |

交互要求：

- 输入后自动检查，可通过短暂 debounce 控制频率，无须先导出或 Apply。
- 在 source span 对应位置显示下划线/高亮；Problems 面板列出位置、原因和可提供的修复方向，点击可跳转。
- 区分 error 与 warning；存在 error 时不能导出可导入的配置 JSON，也不能 Apply。warning 本身不阻止上述操作。
- 未完成输入支持错误恢复，尽量继续分析，抑制单个错误引起的级联误报。
- 编辑器与 JSON compiler 共用 Lexer、Parser、语义和领域检查；UI 展示结构化 diagnostics，不另设判定规则。
- 迟到的结果不得覆盖新源文本；检查与输入不修改 Canvas，只有明确 Apply 才提交。

结构合法的编辑草稿与执行就绪的完整 Workflow 必须区分。沿用现有 `structuralErrors` / `readinessErrors` 概念；2026-10-22 已确认未连接等 readiness 问题作为 warning，允许导出/Apply 结构合法草稿，仍须通过 context、stale 与保存冲突门槛。

### 2.6 本轮确认范围

本轮确认单 Agent Workflow 的文本 authoring 定位、JSON bridge 和编辑时检查方向。具体 C++ 风格语法、parser 技术、ID 策略、编辑器组件与同步细节尚未因此获得最终批准。`DSL 语法草案.md` 保持为用户语法提案；本 RFC 中其他初步、建议或待定内容继续等待评审。

### 2.7 资源与工具直接选择（2026-10-21）

- 编辑器加载可选资源与工具 inventory，DSL 在节点配置中仅通过名称引用已有项，无须顶层 resources 或 tools 前置声明。UUID 只在内部 JSON 和编译上下文中使用，不提供用户 ID 参数。
- 不再提供 resources 分区；tools 仅作为可选的新建共享工具配置分区。具体写法见 V0.1 规范第 5 节。
- Task steps 仍在使用位置配置工具实例；System Tool 类型目录不能替代实例参数配置。
- 全量加载用于选择，不等于全部授权：Agent Action 仅绑定 knowledge/toolbox 明确选中的项。
- Toolbox 中已有工具限当前 AgentReusableTools；不能跨 Agent 引用私有工具。编译 JSON 包含选中工具的完整配置快照，并校验依赖。
- Canvas 反向打印用可选 tools 分区保留完整 Agent-owned 配置；页面内原子替换须保留未被引用的现有工具，避免直接选择语法造成配置丢失。
- Knowledge Space 名称在 Workspace 内唯一；AgentReusableTool 名称在所属 Agent 内唯一；System Tool 使用固定唯一类型名。不同类别可同名，创建和重命名均校验唯一性；历史重名引用报错，不提供 UUID fallback。
- 资源重命名保留 canonical ID，Printer 输出新名称；已有 DSL 草稿基于 name→UUID 会话基线检测 stale，不能静默绑定后来占用旧名的资源。独立旧文本没有历史基线，无法保证原资源身份。

## 3. V1 产品目标与非目标

### 2026-10-22 已确认的实现前决策

1. 未完成连线、不可达与其他 readiness 问题为 warning，允许配置 JSON 导出/Apply；语法、引用、结构错误继续阻断，context/stale/CAS 门槛不变。
2. 支持 `end alias { exit "名称"; }`，命名 Ends 与单隐式 end 互斥。出口来自父 Pattern 的当前 source Slot 合法 EndBinding inventory；DSL 不编辑跨 Agent route。现有 PatternRoute 无稳定出口名，须补父级命名 metadata/inventory 合同，范围内名称唯一，目标 Agent 变化不改变身份。具体见语言规范第 6.5 节。
3. 名称匹配键为 NFC(trim(name))，大小写敏感，保留中间空白；资源创建、重命名、唯一性与编译解析共用。历史规范化碰撞不自动合并；空名称拒绝。原“名称比较待冻结”和“多 End 一律不支持”的记录由本决策取代。

这是设计冻结记录，不代表 parser、数据库唯一性或父级出口命名已实现。

### 3.1 V1 目标

- 能表达当前 Agent Workflow 的全部 canonical 语义；
- 支持 DSL → canonical document；
- 支持 canonical document → deterministic formatted DSL；
- 支持稳定、带位置的语法和语义诊断；
- 支持在现有 `DSL Edit` 资源页面编辑、检查、格式化和 Apply；
- 支持 Canvas 与 DSL 两个 authoring surface 的安全协作；
- 提供适合 LLM 使用的正式语法说明、约束和案例；
- 支持首批 Odyssey Cases 快速生成与迭代。

### 3.2 V1 非目标

- DSL 直接执行 Agent；
- 多 Agent / 整个 OdyJourney DSL；
- 通用编程语言能力、任意表达式求值或用户自定义函数；
- macro、module/import、package manager；
- collaborative text editing；
- 后端编译服务；
- DSL merge 或三方合并；
- 自动修复所有错误；
- 在 DSL 中内嵌 Secret；
- 保证手写排版和注释经过 Canvas round-trip 后原样保留；
- 用 DSL 取代 canonical schema 或 JSON Export contract。

## 4. V1 表达能力

V1 至少覆盖：

| 领域 | DSL 能力 |
| --- | --- |
| Workflow | schema/version、Start、End、nodes、routes |
| Agent Action | name、model、goal、Knowledge Space bindings、Reusable Tool bindings |
| Task | name、local variables、ordered System Tool steps、input/output bindings |
| Branch | cases、conditions、handles、default route |
| Loop | maxTurns、变量比较退出条件、body graph（body layout 由 Canvas 独立维护）；不支持嵌套 Loop 或 collection 遍历 |
| Variables | Agent Variables、类型、ownership、默认值、displayName、description、readOnly metadata |
| Reusable Tools | definition/configuration 与稳定引用 |
| Resources | Knowledge Space、System Tool 与 Reusable Tool 的符号引用 |
| Layout | 不进入 DSL；保留 Canvas 当前布局，仅为新增节点初始化位置 |

V1 资源引用仅使用名称，编译阶段解析为 canonical UUID。重名通过 ownership 范围内的名称唯一性规则解决；歧义时报错，不暴露显式 ID 形式。新共享工具可以使用文件内 alias，最终配置名称仍须唯一。

## 5. 语法设计原则

### 5.1 原则

- 对人类和 LLM 都容易生成和 review；
- 结构显式，不依赖缩进猜测语义；
- 尽量减少标点噪声，但不牺牲无歧义解析；
- block 和引用写法保持一致；
- 字符串、URL、prompt 和 literal value 有明确转义规则；
- 条件表达式采用受限 grammar，不执行任意 JavaScript；
- formatter 输出唯一 canonical style；
- 关键字保留、大小写规则和 Unicode identifier 策略必须书面冻结；
- 每个 AST node 都保存 source span。

### 5.2 初步语法草案（非最终合同）

以下为历史提案，含尚未支持的节点 output、file.write 与 required 示意写法。当前评审以 [V0.1 规范](./odyssey-workflow-dsl-v0.1-spec.md) 为准，不得据此旧示例实现 compiler。

```odyssey
workflow "Research Agent" version 1 {
  variable research_topic: string required

  knowledge product_docs = knowledge_space "Product Docs"

  start -> research

  agent_action research {
    model "gpt-5"
    goal "Research ${research_topic} and produce a structured brief."
    knowledge [product_docs]
  }

  task publish {
    step save_report using system_tool "file.write" {
      path = "reports/${research_topic}.md"
      content = research.output
    }
  }

  research -> publish -> end

}
```

该草案只用于验证可读性，不代表已经选择 parser 技术或冻结所有关键字。

## 6. Compiler Pipeline

```text
source text
  → tokenize
  → parse CST/AST with source spans
  → name binding / symbol table
  → type and scope checking
  → resource resolution
  → graph construction
  → graph/domain validation
  → preserve current Canvas layout and place new nodes
  → canonical runtime-schema validation
  → immutable compile result
```

建议纯领域 API：

```ts
type DslCompileResult =
  | {
      readonly ok: true
      readonly ast: WorkflowDslAst
      readonly document: AgentWorkflowExportDocument
      readonly diagnostics: readonly WorkflowDslDiagnostic[]
    }
  | {
      readonly ok: false
      readonly ast: WorkflowDslAst | null
      readonly diagnostics: readonly WorkflowDslDiagnostic[]
    }
```

约束：

- compiler 不依赖 Vue、Pinia、DOM、Vue Flow 或 Repository；
- parser 不查询网络；
- resource resolver 接收显式 inventory/symbol context；
- compile 不 mutation 输入字符串、当前 document 或 inventory；
- ID 生成通过注入式 factory，测试中必须 deterministic；
- 相同 DSL、相同 resolution context 和相同 ID policy 应产生确定性结果。

## 7. AST、符号和 ID 策略

### 7.1 AST

AST 必须是语言结构，不复制 canonical JSON：

- 保留 DSL 中的声明、引用与 source span；
- 不包含 Vue Flow node、DOM object 或 Store state；
- 不使用弱类型字典承载节点 config；
- 使用 discriminated unions 表达声明和表达式；
- AST schema/version 独立于 canonical Workflow schema/version。

### 7.2 符号表

至少维护：

- node symbols；
- Agent/local variable symbols；
- reusable tool symbols；
- Knowledge Space aliases；
- System Tool definition references；
- Loop-local scope。

符号解析必须检测 duplicate、unknown、ambiguous 和 illegal shadowing。

### 7.3 ID

2026-10-21 更新：用户语法不暴露 UUID 或 `@id(...)`。ID 由 compiler 与编辑会话内部维护：

- Canvas 打印 DSL 时保留内部符号→UUID 基线，同一文档编译复用已识别对象身份。
- 新对象由注入式 ID factory 创建；alias rename、重排与删除后新建不能仅按名称猜测原身份。
- 同一会话内的 identity 保留与独立 DSL 文件重建配置是不同保证；独立文本不承诺原 UUID/provenance，完整保真使用 JSON。
- 映射、rename 和冲突策略在 Compiler 实现前冻结，并覆盖确定性与 round-trip 测试。

## 8. Diagnostics Contract

诊断是 V1 核心能力，不作为后补 UI 文案。

```ts
interface WorkflowDslDiagnostic {
  readonly code: WorkflowDslDiagnosticCode
  readonly severity: 'error' | 'warning' | 'info'
  readonly messageKey: string
  readonly span: {
    readonly start: { readonly offset: number; readonly line: number; readonly column: number }
    readonly end: { readonly offset: number; readonly line: number; readonly column: number }
  }
  readonly related?: readonly {
    readonly messageKey: string
    readonly span: WorkflowDslSourceSpan
  }[]
  readonly suggestion?: WorkflowDslEdit
}
```

诊断不得依赖 parser 异常字符串作为业务控制流。建议错误码分段：

| 范围 | 类别 | 示例 |
| --- | --- | --- |
| `ODSL0xx` | lexical | invalid escape、unterminated string |
| `ODSL1xx` | syntax | missing block、unexpected token |
| `ODSL2xx` | symbol/scope | duplicate node、unknown variable |
| `ODSL3xx` | type/config | incompatible binding、missing required input |
| `ODSL4xx` | graph/domain | invalid route、cycle、invalid Loop body |
| `ODSL5xx` | external resource | missing/ambiguous KB or Tool |
| `ODSL6xx` | canonical emission | schema mismatch、unsupported version |

示例：

```text
ODSL203  18:12  Unknown variable "research_topic".
ODSL401  31:5   Route target "ReviewResult" does not exist.
ODSL502  44:9   Knowledge Space "product-docs" cannot be resolved.
```

UI 仅负责把稳定 diagnostic 映射为用户文案、行列高亮和可选 Quick Fix。

## 9. Printer、Formatter 与 Round-trip

Printer 是双入口同步成立的必要条件。

冻结要求：

- `print(canonicalDocument)` 输出 deterministic DSL；
- formatter 对已解析 AST 输出同一 canonical style；
- `format(format(source)) === format(source)`；
- `compile(print(document))` 与原 document 语义等价；
- object ordering、route ordering、配置字段 ordering 规则必须固定；
- DSL 不包含 layout；已有布局必须保留，仅为新增节点分配位置；
- 注释保留属于待研究项；V1 可以明确说明 Canvas round-trip 会规范化并丢弃非语义注释。

建议建立 semantic equivalence helper，而不是依赖完整 JSON 字符串相等；但 ID、bindings、graph、configuration 和有效 layout 必须严格保留。

## 10. DSL Edit 页面状态模型

DSL 编辑器使用一个显式状态联合，避免散落 boolean：

```ts
type WorkflowDslSession =
  | { type: 'synced'; source: string; baseMutationSeq: number }
  | { type: 'editing'; source: string; baseMutationSeq: number; diagnostics: readonly WorkflowDslDiagnostic[] }
  | { type: 'compiling'; source: string; requestId: number; baseMutationSeq: number }
  | { type: 'ready'; source: string; candidate: AgentWorkflowExportDocument; diagnostics: readonly WorkflowDslDiagnostic[]; baseMutationSeq: number }
  | { type: 'stale'; source: string; diagnostics: readonly WorkflowDslDiagnostic[]; baseMutationSeq: number; currentMutationSeq: number }
  | { type: 'applying'; source: string; baseMutationSeq: number }
  | { type: 'failed'; source: string; error: WorkflowDslApplyError; baseMutationSeq: number }
```

V1 页面至少包含：

- DSL text editor；
- 行号和 syntax highlighting；
- Problems/Diagnostics panel；
- `Format`；
- `Revert to Canvas`；
- `Apply to Canvas`；
- 当前同步/未应用/stale/save failure 状态；
- 敏感配置提示；
- LLM 使用说明或 `Copy prompt contract` 入口（可后置到 Case tooling batch）。

### 10.1 异步安全

- 每次 parse/compile 使用递增 request ID；
- 迟到结果不得覆盖更新的 source；
- component dispose 后不得提交结果；
- 大文本编译后续可迁移 Web Worker，domain API 不变；
- Apply 前重新编译并校验，不信任缓存 candidate；
- saving 时禁止 Apply；
- revision conflict 时要求先完成 conflict recovery。

## 11. Canvas 与 DSL 冲突策略

场景：用户在 DSL 中有未应用修改，同时 Canvas canonical document 发生变化。

V1 不自动 merge，进入 `stale`：

- 保留 DSL 草稿；
- 显示 Canvas 已变化；
- `Revert to Canvas`：丢弃草稿并重新 print；
- `Review and replace Canvas`：重新基于最新 inventory 编译，通过后明确确认并原子替换；
- 不允许静默用 Canvas 覆盖 DSL，也不允许 DSL 自动覆盖 Canvas；
- 离开页面复用 unsaved changes guard。

当 DSL 处于 `synced`，Canvas mutation 可以自动刷新打印结果。

## 12. LLM Authoring Contract

为了让 LLM 稳定地产生候选 DSL，需要随语言版本维护：

1. 语言版本与完整 grammar reference；
2. 可用节点和字段 capability matrix；
3. System Tool、Knowledge Space、Reusable Tool inventory 的紧凑描述；
4. 一个最小合法示例；
5. Branch、Loop、Tool binding 等典型示例；
6. 错误码和修复提示；
7. “只输出 DSL，不输出 Markdown fence/解释”的 prompt contract；
8. compiler feedback → LLM repair 的受控循环规范。

建议 Case authoring 流程：

```text
Case brief + available resource inventory + DSL V1 contract
  → LLM candidate DSL
  → local compiler diagnostics
  → 人工或 LLM 修复
  → preview
  → Apply to Canvas
  → 人工视觉微调
```

禁止将完整 Secret、用户隐私数据或不必要的文档正文放入 LLM prompt inventory。

## 13. 建议代码边界

```text
packages/schemas/src/workflow-dsl/
  diagnostics.ts                 # shared diagnostic/value contracts
  ast.ts                         # versioned typed AST contracts（如确需跨包）

apps/web/src/domain/workflow-dsl/
  lexer.ts                       # pure tokenization
  parser.ts                      # pure CST/AST + spans
  analyzer.ts                    # symbol/type/scope checks
  resourceResolver.ts            # explicit inventory resolution
  compiler.ts                    # AST → canonical document
  printer.ts                     # canonical document → DSL
  formatter.ts                   # AST → canonical DSL style
  equivalence.ts                 # semantic round-trip checks

apps/web/src/features/workflow-editor/
  WorkflowDslEditor.vue          # presentational editor shell
  WorkflowDslDiagnostics.vue
  workflowDslSession.ts          # UI session reducer/state machine

apps/web/src/stores/workflowEditor.ts
  applyCompiledWorkflow(...)     # single application transaction or shared replacement command
```

是否将 parser/compiler 抽到独立 workspace package，应在 Grammar Spike 后根据 Node/browser 双运行需求决定；不要在语法尚未冻结时过早拆包。

## 14. Parser 技术选型待办

在实现前完成一个短期 Spike，对比：

- 手写 recursive descent；
- Chevrotain；
- Peggy；
- Lezer（若编辑器增量解析需求明确）；
- Tree-sitter（只有在跨语言/原生 tooling 收益明确时考虑）。

评估维度：

- TypeScript 类型质量；
- error recovery 和 source span；
- browser bundle size；
- incremental parsing；
- grammar 可维护性；
- formatter/AST 构建成本；
- Node 与 browser 共用；
- CSP/Web Worker compatibility；
- 测试和调试体验。

初步倾向不是结论：V1 grammar 规模可控时优先 typed recursive descent 或 Chevrotain；如果编辑器必须提供高质量增量 syntax tree，再考虑 Lezer。

## 15. 测试策略

### 15.1 Lexer / Parser

- 每个 token、keyword、literal 和 escape；
- incomplete input 的 recovery；
- source span 行列/offset；
- Unicode、CRLF/LF、空文件和大文件；
- malformed input 不 throw 到 UI。

### 15.2 Analyzer / Compiler

- duplicate/unknown/ambiguous symbols；
- variable scope 和 type mismatch；
- Tool required inputs 和 output bindings；
- Branch handles/default；
- Loop body/reference invariants；
- missing KB/Tool；
- deterministic ID；
- invalid candidate 零 mutation；
- source input 和 inventory 不被 mutation。

### 15.3 Printer / Round-trip

- 每种 node/config 的 canonical → DSL → canonical；
- Loop body 往返，以及拒绝 nested Loop 的非法输入；
- strings/URLs/prompts；
- layout 不进入 DSL、Canvas 布局保留；
- deterministic ordering；
- formatter idempotence；
- checked-in golden fixtures。

### 15.4 Store / UI

- Apply 原子替换且只增加一次 mutation；
- saving/conflict blocking；
- network failure 保留本地 compiled result；
- stale compile response 不覆盖新 source；
- Canvas mutation 导致 stale 状态；
- Revert/replace confirmation；
- keyboard、focus、screen reader diagnostics；
- Focus Mode、1024×900、1440×900。

### 15.5 Case acceptance

至少用三个案例验证语言，而不是只用人为构造单测：

1. linear research → publish；
2. Branch routing + multiple Agent Actions；
3. Loop + Tool steps + Knowledge Space bindings。

## 16. 分批实施 ToDo

### Batch A — Language Discovery / Grammar Spike

- [x] 确认 canonical JSON bridge、第一阶段文件导入及后续页面内 Apply 方向（2026-10-20）；
- [x] 确认 DSL 编辑时检查及共享 compiler diagnostics 要求（2026-10-20）；
- [ ] 从 canonical schema 列出 V1 capability matrix；
- [ ] 编写 3 个代表性 Case DSL；
- [ ] 比较 parser 技术选型；
- [ ] 冻结 keyword、identifier、literal、comment、reference 和 condition grammar；
- [ ] 冻结 ID/alias 与 rename 规则；
- [ ] 冻结布局独立管理和新增节点初始位置 contract；
- [ ] 评审本 RFC 并记录 accepted decisions。

Gate：三个案例能够自然表达，且所有 canonical 字段都有明确语言映射或显式排除理由。

### Batch B — Diagnostics、Lexer、Parser

- [ ] 新增 source position/span 和 diagnostic contracts；
- [ ] 实现 Lexer；
- [ ] 实现 Parser 与 error recovery；
- [ ] 实现 typed AST；
- [ ] 建立 parser golden fixtures；
- [ ] 完成 lexical/syntax tests。

Gate：任何输入都返回 AST/diagnostics，不向 UI 抛未处理 parser exception。

### Batch C — Semantic Analyzer 与 Compiler

- [ ] 实现 symbol table 和 scope；
- [ ] 实现 type/config checks；
- [ ] 实现 resource resolver；
- [ ] 实现 graph construction 与 domain validation；
- [ ] 实现 deterministic ID factory；
- [ ] 输出 canonical document；
- [ ] 完成 compiler tests。

Gate：只有零 error candidate 才能产出可被 runtime schema 接受的 canonical document。

### Batch D — Printer、Formatter、Round-trip

- [ ] 实现 canonical document printer；
- [ ] 实现 formatter；
- [ ] 冻结 deterministic ordering；
- [ ] 实现 semantic equivalence helper；
- [ ] 覆盖 JSON → DSL → JSON round-trip；
- [ ] 建立首批 Case golden files。

Gate：当前复杂 fixture 和三个 Case round-trip 语义等价。

### Batch E — DSL Edit UI 与安全同步

- [ ] 实现 DSL session state machine；
- [ ] 实现 editor、diagnostics panel、Format/Revert/Apply；
- [ ] 接入完整 resource inventory；
- [ ] 接入 Store atomic replacement 和 autosave；
- [ ] 实现 stale/unsaved/conflict UI；
- [ ] 完成 accessibility/component/store race tests。

Gate：非法或 stale DSL 不能修改 Canvas；合法 DSL 只通过一次原子 transaction 生效。

### Batch F — LLM Contract 与 Case Workflow

- [ ] 编写面向 LLM 的精简 grammar reference；
- [ ] 编写 inventory serialization contract；
- [ ] 提供最小、Branch、Loop 三类 examples；
- [ ] 编写生成和 repair prompts；
- [ ] 用首个真实 Case 完成 DSL → Canvas → JSON Export；
- [ ] 记录 token、错误类型和人工修正成本；
- [ ] 根据 Case 反馈冻结 DSL V1。

Gate：LLM 能在有限修复轮次内产出可编译 Case，且人工可以阅读、诊断和继续编辑。

### Batch G — 集成验收与发布文档

- [ ] 完整 lint、typecheck、tests、production build；
- [ ] 真实浏览器验证 DSL → Apply → Save → Reload；
- [ ] 验证 Canvas edit → DSL refresh；
- [ ] 验证 network failure、revision conflict 和 stale session；
- [ ] 编写用户验收清单和 completion report；
- [ ] 更新 domain model 中“full DSL compiler”阶段状态。

Gate：三个代表性 Case 在刷新后语义等价，且不存在静默数据丢失。

## 17. Definition of Done

1. DSL grammar/version 和 canonical mapping 有正式文档；
2. Parser 对任意输入返回结构化 diagnostics，不泄漏内部异常；
3. Analyzer 覆盖 symbol、scope、type、graph 和 external resource checks；
4. Compiler 只输出 runtime-schema-valid canonical document；
5. Printer 和 formatter deterministic，核心 fixtures round-trip 等价；
6. DSL 与 Canvas 共享一个 canonical source of truth；
7. DSL Apply 使用单一 Store transaction 和现有 persistence pipeline；
8. invalid、stale、saving、conflict 和 network failure 不造成静默丢失；
9. DSL Editor 提供行列诊断、Format、Revert 和明确 Apply；
10. LLM 输出必须经过同一 compiler，不存在特权路径；
11. 三个真实 Case 通过编译、Canvas review、保存和刷新验收；
12. lint、typecheck、tests、production build 全绿。

## 18. Open Questions

以下问题必须在 Batch A 评审，不在实现中暗自决定：

1. V1 是否允许 comments；若允许，Canvas round-trip 是否保留？
2. 条件表达式是自定义受限 grammar，还是复用现有 variable binding expression model？
3. 不暴露 ID 时，会话基线如何匹配 alias rename、重排和对象新增/删除？
4. Reusable Tool definition 是完整内嵌，还是只允许引用既有 definition？
5. System Tool configuration 中任意 JSON-like value 如何表达和转义？
6. 名称规则已确认使用 NFC(trim(name))、大小写敏感；需实现跨创建/重命名/编译入口一致的校验与历史规范化重名处理，不自动合并。
7. DSL 草稿是否需要本地持久化；如果需要，使用 session storage、IndexedDB 还是后端 draft？
8. 编辑器使用 textarea/CodeMirror/Monaco/Lezer 的边界和 bundle 成本；
9. 是否在 V1 提供 Quick Fix，还是先只提供 diagnostics；
10. LLM repair loop 在浏览器本地执行，还是未来由后端 orchestration 承担？

## 19. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| DSL 和 canonical JSON 漂移 | capability matrix + runtime schema validation + round-trip golden tests |
| 双向同步覆盖用户草稿 | explicit session union + mutation sequence + stale state，不自动 merge |
| LLM 产生看似合法但语义错误的文本 | compiler fail closed；无特权导入路径 |
| name-based resource reference 歧义 | 按 ownership 范围保证名称唯一；ambiguous diagnostic；rename 基线检查，不使用 UUID fallback |
| parser error recovery 复杂 | Grammar Spike 先验证技术；diagnostics 是选型核心指标 |
| ID 在 round-trip 中变化 | 冻结 deterministic/explicit ID policy，并做 rename tests |
| Tool config 泄漏敏感值 | 不记录 source/config；提示 review；Secret 类型后续独立设计 |
| 大 DSL 阻塞 UI | 纯 compiler API；必要时迁移 Web Worker；stale request guard |
| 过早设计成通用语言 | V1 严格映射当前 Agent Workflow capability，不加入无实际 Case 的抽象 |

## 20. 推荐下一步

先执行 Batch A，不立即进入编辑器实现：

1. 选定三个代表性 Case；
2. 为每个 Case 手写一份 DSL 草案；
3. 将草案逐字段映射到当前 canonical schema；
4. 比较 parser 方案并做最小 error-recovery prototype；
5. 召开一次语法 review，冻结 V1 grammar 后再开始 Batch B。

这能确保语言首先服务真实 Case，而不是先造一套漂亮但不实用的语法。

## Variable capability boundary (2026-10-25)

DSL types must match product/canonical support: string, number, boolean, json. The editor labels json as Object / JSON. No extra object/array/Json/custom types may be introduced by DSL examples. See the V0.1 language specification’s Variable type capability constraint; future type changes require coordinated schema, editor, compiler, and Printer updates.
