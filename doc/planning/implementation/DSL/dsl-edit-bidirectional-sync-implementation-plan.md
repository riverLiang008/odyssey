# DSL Edit 面板双向同步实施计划

> Status: First integration implemented — [首版集成报告与剩余事项](./dsl-edit-first-integration-report.md)；尚非全部 Gate 完成  
> Date: 2026-10-22  
> Primary outcome: 用户在现有 Agent Workflow 页面右侧 DSL Edit 面板与 Canvas 之间双向编辑同一配置  
> Contracts: [语言规范](./odyssey-workflow-dsl-v0.1-spec.md)、[检查规范](./odyssey-workflow-dsl-v0.1-validation-spec.md)、[验收案例](./validation-cases.md)

## 1. 产品交付目标

DSL Edit 是现有 Canvas 页内的正式编辑入口。用户在面板里查看、编写和检查 DSL，再应用到当前 Canvas；Canvas 修改可以反向生成 DSL。用户不需要先下载 JSON 再上传。JSON 是两个入口共享的 canonical 数据桥梁，不是强制的磁盘文件流程。

```text
Canvas command → canonical document → Printer → DSL Edit
DSL Edit → Parser/Analyzer/Compiler → canonical JSON candidate
         → Apply application command → canonical document → Canvas
```

编译器和 Printer 必须一起交付；只有 Parser、单向 JSON 导出或可输入的占位文本框，均不算完成。文件导入导出仅保留为可选能力和 fixture 验证方式。

双向同步采用已有 RFC 的明确提交模型：输入自动检查；Canvas 在 DSL 无未应用修改时自动刷新打印文本；DSL → Canvas 通过明确 Apply 生效，不做每个字符即时覆盖。若未来需要合法即自动 Apply，另行设计开关和冲突协议，不在本轮隐式引入。

## 2. 已有代码与约束

- `WorkflowResourceNav.vue` 与 workflowEditor resource category 已有 dsl-edit 入口。
- `WorkflowResourceBrowser.vue` 仍以 Coming next 展示该资源，需替换为真实面板。
- `workflowEditor.ts` 已有 document、mutationSeq、autosave 和 conflict 流程。
- `replaceWorkflowFromImport` 已做 schema/domain 检查与原子更新，但会进行 End import adaptation，且 resetSessionAfterWorkflowImport 会关闭当前资源面板、清空选中项并收起 Loop。不能直接照搬成 DSL Apply。
- 当前 root Ends 属于 Pattern 单向派生边界，存在已接受的 [End 路由决策](../../../architecture/execution/pattern-agent-end-routing-decision.md)。用户仅编排进入这些 End 的内部路径。

实现前按 AGENTS.md 重新完整阅读 frontend-engineering-guidelines；涉及 schema/API、出口命名持久化或数据库唯一性时，也重新完整阅读 backend-engineering-guidelines。不得因本计划只列前端模块而绕过跨层合同与事务要求。

## 3. 必须维持的边界

1. canonical document 是唯一持久化事实来源；DSL source、AST、diagnostics、identity baseline 属于编辑会话。
2. domain compiler/printer 不依赖 Vue、Pinia、Vue Flow、DOM、网络或全局 Store；inventory、ID factory、baseline 显式注入。
3. application 层生成完整候选、做最终校验并原子替换，一次有效 Apply 只增加一次 mutation，保存走既有 autosave/CAS。
4. error、context-required、过期结果、身份不确定与冲突不能修改 Canvas。readiness warning 允许 Apply，但显示未就绪。
5. DSL 不把名字写入 canonical 引用字段；名称按 NFC(trim(name)) 匹配，内部持久化引用仍用 UUID。
6. DSL root End 声明是对当前 Pattern 已生成边界的命名映射，不授予新增/删除/改绑 End 的权限。候选必须保留当前全部合法 End，一对一匹配既有 binding；未引用出口也保留，内部路径可以尚未连接。

语言草稿曾允许多个命名 End 选择同一出口；该写法在当前文档编辑中不能据此新增重复 End，必须以 Pattern 已有边界集合为准。Standalone 文本在 Apply 前必须绑定目标 context，不独立创建 Pattern 拓扑。此解释与用户确认的“选择父级既有出口”一致，不作为架构例外。

## 4. 会话行为

建议用判别联合表达 synced、editing、checking、invalid、ready、context-required、stale、applying 和 apply-failed。持久化 save-failed/conflict 使用已有 persistence 状态，不与语法失败混为一谈。

会话携带 agent/document key、sourceRevision、checkRequestId、baseMutationSeq、inventoryRevision、Pattern revision、Printer identity baseline。候选与这些基线绑定，不能只保存一个 JSON 然后在任意状态 Apply。

| 事件 | 行为 |
| --- | --- |
| 首次打开 DSL Edit | 从当前 document 打印，建立 identity/resource/exit 基线；不 markDirty、不触发保存 |
| 用户输入 | 标记未应用，debounce 检查；保留最后合法 Canvas |
| 检查通过 | 保存候选与 diagnostics，开放 Apply；未就绪显示 warning |
| 检查失败/资源等待 | 高亮并列出问题，禁止 Apply，草稿不丢 |
| Canvas 改变且 DSL synced | 按最新 snapshot 重印；选择变化等纯 UI 事件不重印 |
| Canvas 改变且 DSL 有草稿 | 进入 stale，不自动覆盖任一方 |
| Apply 成功 | 保持 DSL Edit 打开，更新基线；不强制重排、重印覆盖光标与手写排版 |
| Format | 仅修改 DSL 文本，未 Apply 前不修改 Canvas；不自动格式化每次击键 |
| Revert to Canvas | 有草稿时明确丢弃确认，重新打印最新文档 |
| stale replace | 展示差异/影响，基于最新 context 重编译并明确替换；不绕过 End 和 CAS 限制 |
| 关闭/切换资源面板 | 同一 Agent 会话保留草稿，不依赖面板组件存活；保留未应用标记 |
| 离开 Agent/关闭页面 | 使用未保存 guard；浏览器卸载用 beforeunload；本地持久化与跨刷新恢复后置，不承诺未应用文本已保存 |
| Pattern/资源重命名或同名替换 | 使基线过期，重新解析与审阅，不能静默换绑 |

layout 属于 Canvas 的 canonical 数据，不进入 DSL。移动、resize、viewport 变化不刷新 DSL，也不使草稿 stale。Apply 使用最新 Canvas 布局，保留已有节点位置，仅给新节点初始位置。

自发 Apply 后的 document notification 通过提交 token/基线识别，不能回环触发再次 Apply/print。保存响应不改变语义时不重置 source。关闭组件、切换 Agent 或较旧检查返回都不得污染新会话。

## 5. 分批实施与验收门槛

### Batch A — 当前合同校准与 fixtures

- [ ] 对当前 canonical 所有字段建立 capability matrix：节点、多个 Ends/bindings、Tool labels/metadata、variables、Reusable Tools、graph/layout versions。
- [ ] 对规范仍未冻结的插值类型/比较细节形成明确规则；补 source map/diagnostic 参数类型。
- [ ] 明确 identity baseline 的 rename、move/reorder、删除再新增策略；无法确定时 context-required，不靠显示名称猜测。
- [ ] 校准命名 End 作为只读边界映射的 grammar/domain 检查；补 Pattern revision 和出口 inventory port。
- [ ] 出口唯一名称 metadata 由 Pattern application 提供；当前尚无对应字段，冻结存储/迁移方案或可验证的稳定命名 adapter。不能在 compiler 里用 Agent 名称或数组下标临时命名。
- [ ] 资源名称规范化唯一性现状审计；为缺失约束列出需要的前后端增量，不自动改名历史资源。
- [ ] 将四个 `.ody` 示例和现有复杂 Canvas JSON 建为成对 fixtures，包含 Loop、多个出口、配置未被节点引用的工具。

Gate：每个现有字段都有 DSL 表达或明确阻断理由；最小单出口上下文可启动后续批次，命名出口依赖有具体交付项，不能在最终验收中跳过。

### Batch B — Parser 与结构诊断

- [ ] Lexer、带 span 的 typed AST、Parser/error recovery、diagnostic registry。
- [ ] 测试普通/多行字符串、插值、注释、CRLF/BOM、未闭合块、缺分号、重复字段、非法链式边和预算截断。
- [ ] 输入不完整时继续分析无关部分，不抛未处理异常、不构造可应用部分配置。

Gate：合法示例可解析；非法/未完成输入返回稳定 code/span，且输入不变。

### Batch C — Compiler 与 Printer 同步开发

- [ ] 名称/作用域/类型/ownership 检查、资源与出口解析、Tool 配置、graph validation、canonical emission。
- [ ] 引用已有工具时包含自有配置快照和依赖，保留当前未引用工具，禁止静默删减资源。
- [ ] 实现确定性 Printer、Formatter、语义等价比较及 ID/metadata preservation；布局始终从 Canvas 当前快照保留，不提供显式 layout 语法。
- [ ] 针对同文档 baseline 测试 `compile(print(document))`：ID、binding、配置、变量、布局保持；Standalone 重建允许新 ID，但引用/业务语义正确。
- [ ] 多 End 完整匹配 Pattern 边界；不支持的 canonical 值 fail closed，保留原 Canvas。

Gate：在接 UI 前，复杂 fixture 和四类案例双向往返；不能以 DSL→JSON 单向成功替代。

### Batch D — Session reducer 与 application transaction

- [ ] 纯 session reducer/协调器，覆盖上表所有状态及并发事件。
- [ ] `applyCompiledWorkflow` 专用 application action：先复核 source/context/mutation/Pattern 基线与 identity，最终 schema/domain/End 集合校验后一次提交。
- [ ] 抽取可复用的候选校验/原子文档更新能力；JSON Import 保留自身 mapping/remap/session reset 语义，DSL Apply 保留面板与合法 selection/Loop 状态。
- [ ] 删除或变更对象后清理失效 selection/inspector，保留仍有效 UI 状态，不直接序列化 session。
- [ ] 复用 autosave/CAS、重试和 conflict recovery，不能绕过 saving/conflict 阻断。

Gate：成功一次 mutation；失败零 mutation；Apply 后仍处于 DSL Edit，迟到任务和自发通知不产生同步循环。

### Batch E — 现有 DSL Edit 面板接入

- [ ] 在 WorkflowResourceBrowser 的 dsl-edit 分支挂载真实编辑器，不另建孤立工具页。
- [ ] 选择适合面板的 editor adapter（行号、高亮、诊断跳转、IME、键盘隔离、bundle 成本）；不让第三方 editor 类型进入 domain。
- [ ] Problems、error/warning 数量、Checking/Unapplied/Synced/Stale/Save failed 状态；Apply、Format、Revert。
- [ ] 关闭后重开保留草稿；Canvas 修改后无草稿自动刷新，有草稿 stale；离开 guard。
- [ ] 编辑文本时 Delete/Backspace/快捷键不触发 Canvas 删除；diagnostics 可键盘访问，错误不只靠颜色表示。
- [ ] 测试窄面板、Focus Mode、1024×900 与 1440×900；需要更大编辑空间时在现有模式内提供适当扩展，不另立持久化文档。

Gate：面板内完成两方向编辑，不经过文件上传/下载，保留错误期间 Canvas 与未应用文本。

### Batch F — 持久化和真实浏览器验收

- [ ] Canvas 修改 → 面板 DSL 刷新；DSL 修改 → 检查 → Apply → Canvas 更新 → autosave → 刷新一致。
- [ ] Linear、Branch、Loop、多个 End；变量/Tool/Knowledge 修改、重命名碰撞、资源加载失败与 Pattern context 失效。
- [ ] DSL 无效、stale、旧响应、关闭面板、Agent 切换、卸载、保存失败与 revision conflict 均无静默丢失。
- [ ] 完成 frontend 的 lint/typecheck/test/build 和相关 browser tests；新增 backend 合同时另跑 PostgreSQL 事务/并发/API/migration 检查。
- [ ] 提交完成报告，明确实际覆盖与剩余限制；文件导出作为附加验证，不替代面板验收。

Gate：在用户截图对应入口实际完成双向编辑与保存恢复，所有必需依赖都已落实。

## 6. 建议代码边界

```text
domain/workflow-dsl/
  ast / diagnostics / lexer / parser
  analyzer / resolver / compiler
  printer / formatter / equivalence / identityBaseline
features/workflow-editor/
  WorkflowDslEditor.vue / WorkflowDslDiagnostics.vue
  workflowDslSession.ts / editor adapter
stores/workflowEditor.ts
  application Apply orchestration / canonical mutation
repositories / shared schemas / API
  仅在名称唯一性与 Pattern exit 合同确需增量时修改
```

不在语法未稳定前拆独立 workspace package；Node/browser 公用需求明确时再调整。diagnostics 与 grammar fixture 可跨环境运行，不依赖 mounted Vue。

## 7. Definition of Done

完成必须同时证明：面板是真实入口、两方向都可用、compiler/printer 往返正确、非法输入不破坏 Canvas、stale 草稿不丢、identity/End/layout 不漂移、一次 Apply 一次事务、autosave 刷新恢复、异步/冲突测试通过。DSL 源文本暂不作为第二份后端事实来源。

本计划完成后先执行 Batch A，再进入 B/C；不把“先实现 Parser”解释为改变产品范围。实施中发现合同变化更新矩阵和计划，不退化为仅文件导入导出的交付。

当前节点语法：`类型 "名称" { ... }`，连线按双引号名称引用；不使用节点 alias 或块内 name。同图名称规范化后唯一，Loop body 独立；内部 UUID 继续由会话保留。详见语言规范的“节点名称语法决策”。
