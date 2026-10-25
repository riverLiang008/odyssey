# DSL 直接变量绑定实施计划与 TODO

> Status: Implemented and verified；验收结果见本文末尾。
> Date: 2026-10-25
> Design: [直接变量绑定设计](./runtime-variable-binding-design.md)
> Scope: 编辑、检查、Canvas 双向同步、HTTP 持久化与导入导出；不开发 kernel、mock API 或真实 Curator API。
> Engineering: [前端规范](../../../frontend-engineering-guidelines.md)、[后端规范](../../../backend-engineering-guidelines.md)

## Gate A frozen decision

See [the implementation contract](./runtime-variable-binding-design.md#10-implementation-contract-2026-10-25), which supersedes the field-name proposal below. The shipped shape keeps UUID fixed references and adds a tagged system resource object in the existing fields. DSL 0.2 maps to graph 1.2.0; export envelope stays version 1. The existing strict schemas reject new graph versions in old clients. There is no automatic downgrade or replacement with a preview UUID.

## 1. 交付目标

在同一份 Workflow 中保留固定 Playbook，同时通过 `$sys.target_knowledge_space$` 绑定本次事件目标 KS。支持 `$agent.key$`、`$task.key$` 和已注册的 `$sys.key$` 整值引用；保留字符串中的 `${...}` 文本插值。

完成后的编辑器必须能检查、展示、保存、重载和反向打印动态绑定；没有运行实例时仍可保存合法配置。不能把当前页面选中的 KS 或预览样例替换进持久化 JSON，也不声称已经执行事件注入、检索或授权。

本计划采用共享 schema → 后端合同/存储 → compiler/printer → Canvas/Store → 端到端验收的依赖顺序。先实现持久化能力再开放产品入口，避免“DSL 能生成、API 不能保存”。

## 2. 已核对的当前基线

| 位置 | 当前实现 | 本次影响 |
| --- | --- | --- |
| workflow/variables.ts | string / number / boolean / json | 不新增用户变量类型 |
| workflow/values.ts | literal / variable(UUID) / template | 系统输入需要稳定 key 引用，不能伪造普通变量 UUID |
| Agent Action config | knowledgeSpaceIds: UUID[] | 无法存储运行时目标，需要资源引用合同 |
| Task/Reusable knowledge_retrieval | configuration.knowledgeSpaceId: UUID | 两处必须采用一致资源引用语义 |
| DSL compiler DslInventory | systemVariables?: TaskLocalVariable[] | 系统输入被当作带 UUID 的普通变量，需独立描述类型 |
| DSL syntax/compiler | V0.1、裸 agent/task/sys 引用 | 增加绑定词法节点和明确版本策略 |
| Workflow graph | schemaVersion 1.0.0 / 1.1.0 | 新资源/系统值表达需要版本门槛 |
| Workflow export | formatVersion: 1 | 审计 envelope 是否需升级，不与 DSL 版本混用 |
| API workflow_domain.py | 提取具体 KS UUID 并校验引用 | 固定资源查库，系统绑定查定义；不能把系统 key 当 UUID 查询 |

还需沿引用查找导出、模板实例化、删除影响分析、工具输入/输出检查等消费者，不能只更新三个字段的静态类型。

## 3. 首阶段合同决策（Gate A）

以下是实施建议，不把计划中的字段名或版本号误当作已冻结合同。开始编码前用正负 fixtures 固定一次；后续阶段不再各自另选表达。

### 3.1 语言兼容

建议下一语法版本为 0.2：V0.1 继续按旧规则读取；V0.2 统一打印和要求 `$...$` 整值引用，不接受等价裸引用。0.2 中字符串 `${...}`、普通变量默认值、节点/Case 名称、单条连线和布局独立规则保持不变。

迁移必须是显式命令或明确升级步骤，不因打开旧文件自动重写。升级只变结构中的引用节点，不能搜索替换脚本、字符串、注释里的 agent.x。无损保留对象 UUID、End binding、未引用 Reusable Tools 和布局。注释/排版若因规范化打印丢失，升级预览需提示。

DSL version、Workflow schemaVersion、export formatVersion 独立管理。建议新 graph 能力评估为 1.2.0；没有完成兼容审计前不承诺具体值，不自动降级含动态引用的文档。

### 3.2 资源引用

建议使用明确的判别联合，而不是 UUID|string 的猜测规则：

```typescript
type KnowledgeSpaceSource =
  | { kind: 'fixed'; knowledgeSpaceId: UUID }
  | { kind: 'system'; key: 'target_knowledge_space' }
```

此处是合同草图，不是现有 schema。推荐新版本使用 Agent Action.knowledgeSources 与 retrieval.configuration.knowledgeSpaceSource，旧版本仍严格识别原 UUID 字段；通过版本化纯 adapter 统一编辑视图，不在同一配置中保存新旧双份事实来源。最终字段名及版本 Gate A 冻结。

- 固定资源名称仍只在 DSL/选择器出现，canonical 保存已解析 UUID。
- 动态资源只保存系统 key，不保存解析结果、样例 UUID、权限标志或任意表达式。
- 不把动态 KS 放入普通 ValueSource 的 json/string 来绕过类型。
- 对 Task Tool 与 Reusable Tool 使用同一资源类型；reusableTools 位于 graph 外，也要由所属 aggregate 的能力版本检查。
- 按引用身份去重：fixed UUID 或 system key；不能把预览时恰好相同的实例混为一个配置项。

旧数据的显式升级应把固定 UUID 映射为 fixed 引用；无动态内容的历史文档可继续旧版本往返。含 system 引用不支持降级，导出也不能偷偷固定为当前 KS。

### 3.3 普通系统输入与变量引用

Agent/Task 变量继续用 UUID 引用；`$...$` 是文本语法变化，不改变它们的内部 identity。系统输入引入独立只读 key 引用及 template 系统片段，避免使用全零或随机 UUID 代表 sys 值。

系统目录的 descriptor 至少区分 primitive_value 与 knowledge_space_resource，携带 key、值类型（适用时）、只读属性、提供该输入的触发合同。第一版至少登记 target_knowledge_space；Curator 需要的事件正文 key（建议 change_event，json）必须一并明确来源与结构，不能从客户端默认值冒充真实事件。

使用共享受控定义/跨语言 fixture，使 TS 与 Python 对已知 key/类型/位置一致。先不增加系统目录管理后台或为本功能新增通用 CRUD API。

required system inputs 从 canonical 引用推导，不另存可漂移的第二份列表。配置期可验证 key 和类型；将来部署到具体触发器时再验证它提供全部 required inputs。没有配置触发器的编辑文档可以保存已知绑定，并显示运行前置条件；这不等于触发适配器已实现。

### Gate A TODO

- [x] 冻结 0.1/0.2 语法行为、显式升级与不支持降级策略。
- [x] 冻结 graph/aggregate/export 能力版本及旧客户端拒绝规则。
- [x] 冻结资源判别联合和旧字段升级/序列化 adapter。
- [x] 冻结 sys 目录与系统 ValueSource/template segment 合同；保持 sys 不可写。
- [x] 冻结每个字段的引用角色矩阵：值、变量身份、可写目标、KS 资源。
- [x] 建立跨语言 positive/negative/legacy fixtures；合同草图成为可执行 schema 后再进入 Gate B。

## 4. 核心算法

### 4.1 词法与 CST

扩展 syntax.ts，识别字符串外完整 `$namespace.key$`，保留原始 UTF-16 span。建议绑定 token 有 namespace/key 与完整 span；缺闭合 $、空 key、空白或多级路径给专门诊断，并恢复到当前语句分隔符，不吞后续节点。

字符串和注释沿原 lexer 规则处理：`"$agent.x$"` 是文本；`"${agent.x}"` 仍走模板分析；script 源码不展开。绑定内禁止任意成员访问、数组索引、调用、算术和嵌套。

不要把 source 去掉 $ 后喂给旧 parser：这会丢 span、混淆字符串及版本规则。V0.1 与 V0.2 可共享语义层，但必须保留不同语法入口的明确检查。

### 4.2 符号解析与字段角色

```text
parse binding → namespace/key
→ 查当前 Agent/Task scope 或显式 system descriptor
→ 根据字段角色解析为：ValueSource / VariableIdentity / WritableTarget / KnowledgeSpaceSource
→ 检查类型、ownership、只读及版本能力
→ 生成未解析运行实例的 canonical 引用
```

变量身份位置包括 script inputs.variableId；可写位置包括 set_variable.targetVariableId、step output 和 reusable output_binding。二者不能误当作读值后拿值作 UUID。sys 在写入位置始终拒绝；resource descriptor 在普通值/插值中拒绝隐式转字符串，primitive descriptor 在 KS 字段拒绝。

unknown key 与 system catalog not loaded 分别为 error、context-required。已知动态资源但没有本次运行实例可以 checked。fixed KS 名称仍使用 inventory 解析，并按现有 Workspace/可用性合同检查。

### 4.3 资源列表与工具配置

knowledge 元素逐项解析：STRING → 固定资源；binding → 要求 resource 类型。knowledgeSpaceSource 走同一解析器；不可把一个普通 string/json 变量当作资源。toolbox 保持工具名称/alias，不在本轮增加动态选工具。

配置字段必须由字段矩阵决定解析模式，不能对所有 JSON key 通用替换。headers/body/config 内只对当前合同已经声明的 ValueSource 或变量引用位置开放新写法；变量默认值与普通 JSON literal 中的绑定仍拒绝。

### 4.4 引用遍历与后端检查

建立统一纯遍历输出：固定 KS 引用、系统 required inputs、普通变量读/写引用、未知/不合法路径。覆盖根图、Loop body、Task steps、Reusable Tools、templates 和字符串模板。

- 固定 KS：继续执行 Workspace scoped existence/eligibility 校验。
- 系统 KS：只验证已登记资源 key、字段角色和 schema 能力；不查一个尚不存在的实例 UUID。
- 系统普通值：按 descriptor 验证使用类型，不引用 AgentVariable 列表或 ORM 行。
- 未知系统 key、旧版本携带新字段、重复资源、资源冒充值均在入库前拒绝。
- 将来实例化后的资源归属与权限校验属于 kernel/调用服务；编辑阶段没有授权所有 KS。

禁止分别维护 compiler、API、删除分析三份散落的字符串扫描规则。

### 4.5 Printer、迁移与等价性

Printer 按 canonical source kind 输出固定名称或 `$sys.key$`，按变量 UUID 输出 `$agent.key$`/`$task.key$`。系统片段按 sys key 输出 `${sys.key}` 文本插值。打印前核对能力版本，不能无条件打印 next 语法。

显式 migrate(oldDoc/oldSource) 先按旧版本解析，再通过已验证的结构变换生成新候选，最后新 Printer 输出。迁移不调用运行资源解析器、不重新生成 UUID，也不修改文档布局。

等价比较关注 canonical 配置，覆盖：两次预览 KS A/B 之后配置仍为同一 system 引用；同 key 的不同使用点保存相同语义；保存重载/导出导入不丢 system 分支。

### 4.6 错误定位

保留完整 `$...$` span，并可定位 namespace/key 子 span。区分 malformed binding、unsupported syntax version、unknown key、wrong binding type、readonly target、out-of-scope Task、unsupported field、unsupported schema version。实现前核对现有 ODSL 编号，统一分配新错误码，不用英文文案作为判断条件。

## 5. 改动文件与审计范围

下表是已存在的主要入口；新增文件为建议命名，实施时可按实际职责细化。

| 层 | 文件/目录 | 工作 |
| --- | --- | --- |
| Shared | packages/schemas/src/workflow/values.ts、tools.ts、workflow.ts、variables.ts | 新 source/system 类型、严格字段和版本边界；普通变量 enum 不扩展 |
| Shared | packages/schemas/src/editor/editor.ts、workflow/workflowExport.ts | aggregate cross-reference、依赖检查、导入导出兼容 |
| Shared 新增 | workflow/systemInputs.ts、workflow/resourceSources.ts（建议） | descriptor/schema、引用身份与纯检查 |
| API | apps/api/src/odyssey_api/journeys/dto.py、workflow_domain.py | strict DTO 对齐、固定/动态依赖提取与校验 |
| API 审计 | journeys/service.py、repository.py、agent_templates/ | 保存/读取校验、scoped fixed 引用、模板与迁移边界 |
| DSL | apps/web/src/domain/workflow-dsl/syntax.ts、compiler.ts、printer.ts | 版本、lexer/CST、角色解析、系统目录、打印与升级 |
| Web domain | domain/workflow/、domain/workflow-import/ | commands、资源/变量引用统计、模板/remap、只读与 import checks |
| Web UI | AgentReusableToolPanel.vue、SystemToolPanel.vue、ToolValueInput.vue、BranchOperandField.vue、AgentVariablesPanel.vue | 资源/值/目标选择器覆盖；系统值只读，不伪装成用户创建变量 |
| Canvas/UI | WorkflowNodeRenderer.vue、WorkflowResourceBrowser.vue、WorkflowDslEditor.vue、dslMessages.ts | 动态资源 badge、移除/替换 intent、语法着色和诊断 |
| Session | useWorkflowDsl.ts、stores/workflowEditor.ts、views/AgentWorkflowView.vue | descriptor 上下文、fingerprint/stale、原子 Apply 和 UI 状态 |
| Adapter | canvas/workflow/workflowCanvasAdapter.ts、repositories/httpEditorRepository.ts | canonical 与第三方 view model 隔离、严格 response validation |
| Docs/cases | DSL 规范、检查规范、案例 .ody、Document Curator API 示例 | 版本化更新、通用 KS 系统绑定示例、标注无 kernel |

全文搜索 knowledgeSpaceIds、knowledgeSpaceId、ValueSource、variableId、TemplateSegment 和 schemaVersion；逐个确认分支穷尽及旧格式语义。不得用 any、弱字典或类型断言消除编译错误。

## 6. 分阶段 TODO 与验收门槛

### Phase A — 合同与兼容（先行）

- [x] 完成 Gate A 所有决策并更新设计/规范。
- [x] 固定和动态资源、系统值/模板、legacy fixtures 在 TS/Python 上语义一致。
- [x] 审计 export envelope、模板及整个 aggregate 对版本的约束。

门槛：明确一份可实现合同，不存在“前端先塞一个新对象、后端以后再说”。

### Phase B — Shared + API 配置持久化

- [x] 添加 shared schemas/纯引用遍历与 Python DTO parity。
- [x] 覆盖 graph 内外工具、Loop、templates 和 system template segments。
- [x] 后端只校验 fixed KS 的实际 scoped 对象，动态项验证系统目录合同。
- [x] JSONB 写前/读后严格校验，保留 CAS 与 service-owned transaction。
- [x] 评估是否需要数据库迁移：不能只因 JSON 结构改动就加列；如现有 DB constraint 不兼容，再提交明确迁移与恢复方案。
- [x] API/存储测试覆盖 fixed+dynamic 混合、非法 system key、跨 Workspace 固定引用拒绝、旧版本回归、并发 CAS/rollback。

门槛：服务端接受并完整返回新合同，旧文档不被静默重写。未完成前不在生产编辑器开放可保存的动态绑定。

### Phase C — Compiler / Printer / 迁移

- [x] 新绑定 token/span、版本入口和完整字段角色解析。
- [x] 重构 sys inventory，不把类型化资源当作普通 TaskLocalVariable。
- [x] 新旧版本 Printer 与显式迁移预览。
- [x] 整值绑定/字符串插值/脚本正文互不误识别。
- [x] 诊断仍遵循 checked / invalid / context-required；错误候选不修改基线。

门槛：新正例编译和 canonical round-trip 通过，负例定位正确，旧例未迁移仍可按原版本解析。

### Phase D — Canvas 与编辑会话

- [x] 资源选择器提供固定 KS / From event 两种明确模式；既有拖放默认为 fixed。
- [x] 系统资源显示独立 badge/key，支持受控移除/替换；不能拖动一个具体 KS 就偷偷改写其他动态引用。
- [x] Tool config、普通 ValueSource、变量目标及 Branch/Loop 编辑都保留对应类型。
- [x] Apply 走 Store command 一次原子 mutation，保留 End、UUID、布局和 Loop body 布局。
- [ ] fingerprint 包含系统目录/合同变化，不含运行样例值或 layout-only 变化。
- [x] read-only、conflict、catalog loading/error、旧 schema unsupported 状态明确；保留脏 DSL 草稿。
- [ ] descriptor 变化与异步 inventory 返回不覆盖较新编辑。

门槛：Canvas ↔ DSL 修改、保存重载、导出导入和显式升级端到端通过。

### Phase E — 案例与最终回归

- [x] 更新 Document Curator：固定 Playbook + 动态事件 KS；替换伪用户 change_event 默认值为已登记系统输入引用。
- [x] API 合同说明区分事件系统身份与普通 JSON 输入，不把 client payload 视为授权。
- [x] 维护 V0.1 历史例和 V0.2 新例，入口写清版本/能力；不改变无关业务图。
- [x] 执行回归与浏览器验收，记录结果及无 kernel 限制；截图已在本次验收工具输出展示。

## 7. 最小测试矩阵

| 类别 | 必测 |
| --- | --- |
| Lexer | 完整绑定、缺闭合、空白/多级路径错误、CRLF/Unicode offset、截断编辑不抛异常 |
| Text | 引号内 $...$ 字面量、${...} 插值、raw strings、comments、script 中未执行替换 |
| Type | KS resource vs string/json、普通值 vs可写目标、sys 只读、Task scope、对象成员访问拒绝 |
| Descriptor | key 已登记无实例合法、目录loading=context-required、未知key错误、缺触发能力不伪装已提供 |
| Canonical | 同 key 多位置、fixed/dynamic 混合去重、旧版本拒新字段、导出版本与 template 一致 |
| Backend | 两端fixture一致、固定KS跨Workspace不可见、动态资源不假查UUID、invalid不写入、不消耗revision |
| Persistence | save/reload、JSONB读取校验、CAS冲突、失败rollback、模板复制保留system key |
| UI | From event模式、Tool实例、readonly/dirty/stale、catalog异步竞态、资源重命名不影响system key |
| Round-trip | Compiler→canonical→Printer、Canvas→DSL→Canvas、升级保留UUID/End/全部布局 |
| Runtime边界 | KS A/B只作为纯fixture解析/替身测试，不声称真实事件注入、授权或跨KS运行完成 |

配置测试可以用纯 schema/domain fixtures 或窄测试替身。后端 JSONB/CAS/事务集成测试必须用 PostgreSQL，不以 SQLite 或模拟冲突替代。无需搭建 mock Curator API。

## 8. 验证命令与完成定义

按改动阶段先运行最相关单元/合同测试；完成时运行仓库标准 pnpm lint、pnpm typecheck、pnpm test、pnpm build。API 使用项目现有 pytest/Ruff 命令，包含 test_workflow_domain.py、test_journey_router_contract.py、test_journey_postgres_integration.py；先查看当前 API 工程配置确定环境和 PostgreSQL 设置，不在文档中猜测连接参数。

完成必须同时证明：新语法检查正确、动态引用被完整持久化、Canvas双向可编辑、旧配置兼容/显式升级、固定资源Workspace校验保留、sys只读且不被实例值污染。只让 parser 吃下 `$...$` 不算交付。

未包含的能力：kernel、真正文件事件注入、运行时授权/执行、Curator领域写入API、mock API、审批队列、Agent Action通用结构化输出。最终交付报告必须单列这些边界。

## 9. 本次计划记录

2026-10-25：已读取当前前后端工程规范，核对变量/ValueSource/工具/graph/export schemas、DSL入口、API DTO和固定KS引用提取。本文列出的代码文件为审计与修改入口，不代表已完成逐行修改。所有实现 TODO 均保持未勾选。

## Implementation progress and validation

- Implemented the binding token, original spans, 0.1/0.2 parsing rules, source/identity/write/resource role checks, system registry, canonical unions, and normalized printing.
- Implemented the explicit DSL upgrade preview. It normalizes formatting/comments; Apply is still required. Layout, object identity and Pattern-owned Ends stay outside DSL migration semantics.
- Implemented system value selection and preservation in Tool inputs and Branch operands, event KS selection in Task/Reusable retrieval, and event KS binding/display in Agent Action.
- Updated Store commands, fixed-resource extraction, import dependencies, duplication, template references and Pattern End reconciliation.
- Added a shared TS/Python fixture, compiler/printer rejection and round-trip cases, UI controls, editor save/reload, API boundary checks and a PostgreSQL save/reload integration case.
- Migrated the Document Curator DSL by compiling its old syntax, changing typed references and printing 0.2; verified recompilation before writing the fixture. Its APIs and Agent Action output remain illustrative executor contracts.

Validation logs: `doc/temp/binding-check.log`, `binding-targeted.log`, `binding-api-full.log`, and `binding-api-runtime-integration.log`. Final results are recorded after verification completes. Runtime injection, execution and permission checks remain future executor work.

### Scope clarification

The system input catalog is a compiled, read-only registry in this increment. There is no asynchronously editable system descriptor inventory, so descriptor loading/error/race behavior is not exposed as a new API or UI. Existing fixed-resource inventory race/fingerprint behavior is retained. A separately versioned remote registry is deferred until a runtime trigger contract needs one. Legacy 0.1 systemVariables inventory remains a compatibility input; 0.2 system keys use the new registry and never masquerade as TaskLocalVariable UUIDs.

No database migration is needed: existing validated graph/reusable-tool JSONB stores the tagged references. Concrete KS reference rows contain fixed UUIDs only. Full backend regression, including Workspace isolation/CAS/rollback and the new runtime-binding save/reload case, passed: **154 tests** against local PostgreSQL on port 55432. Ruff passed. No runtime executor was added.

### Final verification

- `pnpm check`: lint, shared/web typecheck, **93 schema tests + 596 Web tests**, and production build all passed. Full log: `doc/temp/binding-check-final.log`.
- API: Ruff passed; **154 tests** passed against PostgreSQL on 55432. Full log: `doc/temp/binding-api-full.log`.
- Browser: opened the existing Document Curator through a temporary local Web/API pair (4175/8205). Verified Upgrade to 0.2 produces an unapplied draft, fixed Playbook plus `$sys.target_knowledge_space$` checks with zero diagnostics, Apply becomes enabled while Save remains disabled, and retrieval settings expose From event plus typed System input choices.
- Browser drafts were discarded/cancelled. Existing persisted Document Curator remains unchanged; the repository's revised `.ody` fixture is ready for user import/review. Temporary verification services were stopped.
- Registry fingerprint/async-descriptor TODOs are deferred as described above, rather than claiming a remote mutable catalog exists. Runtime/event injection remains future executor work.
