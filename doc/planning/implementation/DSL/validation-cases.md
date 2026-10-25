# DSL V0.1 检查验收案例

> Status: Draft；人工规范案例，尚未由 parser 执行  
> Date: 2026-10-22  
> Contract: [检查规范](./odyssey-workflow-dsl-v0.1-validation-spec.md)

## 1. 基础输入与标记

基础文本 B：

```odyssey
workflow "Check" version "0.1" {
  variables {
    string user_managed topic = "Odyssey";
    string shared brief;
    number agent_managed confidence = 0;
    boolean user_managed approved = false;
  }
  nodes {
    agent_action research {
      model "gpt-5";
      goal "Research ${agent.topic}.";
    }
  }
  edges {
    start -> research;
    research -> end;
  }
}
```

默认 inventory 是显式完整快照：当前 Workspace 有唯一 Knowledge Space `Product Docs`；当前 Agent 有唯一 Reusable Tool `Product Lookup`，配置依赖该 Knowledge Space 且没有未声明变量；五种 System Tool definition 可用。每个下表变体均独立应用，不累计修改；正例 B 是 checked，无诊断，有 document。

span 写“token/引用”时，表示精确覆盖该源码范围，不含分隔符；缺 token 时是插入点零宽 span。归一化 code 排序采用检查规范，表中只列预期主诊断；无关的合法输入不得额外报 error。

## 2. 规则验收矩阵

| case | 基于 B 的变体或独立场景 | 预期主诊断与定位 | 候选 |
| --- | --- | --- | --- |
| V001 | B 原样 | 无 | 有 |
| V002 | 在 research 后声明一个前向引用目标并连线 | 无 unknown 错误 | 有 |
| V003 | 增加 knowledge ["Product Docs"]; toolbox ["Product Lookup"]; | 名称解析成功，输出含工具快照 | 有 |
| V004 | 换成 CRLF；header 前 BOM；注释含 -> | 规则不变，offset 按原文计算 | 有 |
| L001 | goal 字符串含非法转义 \q | ODSL003，覆盖 \q | 无 |
| L002 | goal 普通字符串在行尾未闭合，下一行仍有合法字段 | ODSL002；不吞下一字段 | 无 |
| L003 | 文件结尾为未闭合 /* | ODSL004，注释起始至 EOF | 无 |
| L004 | raw-string 未闭合，正文含 } nodes { | ODSL002 至 EOF；不按伪结构恢复 | 无 |
| L005 | 将变量默认值换成 1e999 | ODSL005，整个数字 | 无 |
| L006 | goal 使用 ${agent.topic + 1} | ODSL006，插值体；不再报 unknown topic | 无 |
| S001 | 删去 model 行末 ; | ODSL101，在 goal 起始前零宽；继续检查 goal | 无 |
| S002 | 文件最后缺 } | ODSL101，EOF 零宽 | 无 |
| S003 | 重复 variables 分区 | ODSL103，第二个分区；related 第一处分区 | 无 |
| S004 | research 缺 model，块闭合 | ODSL104，research 块末尾；参数为 model | 无 |
| S005 | start -> research -> end; | ODSL106，第二个 ->；坏边不参与 readiness | 无 |
| S006 | 加入 resources {}、@id 或 source_template | ODSL102，各自首个非法 token | 无 |
| S007 | 空文件 | ODSL101，EOF；缺 workflow，不返回空 workflow | 无 |
| S008 | 两个 workflow | ODSL102，第二个 workflow | 无 |
| N001 | 节点名称在同一 nodes 中规范化后重复 | ODSL201，第二处名称，related 第一处 | 无 |
| N002 | goal 引用 agent.missing | ODSL202，仅 missing 引用；不补类型错误 | 无 |
| N003 | Agent Action goal 引用 task.cached | ODSL203，整个非法作用域引用 | 无 |
| N004 | 外部连线指向 Loop body 的已有节点名称 | ODSL203；不误当合法跨图连线 | 无 |
| N005 | knowledge 中两次 Product Docs | ODSL204，第二处，related 第一处 | 无 |
| N006 | 不同 Task 各定义 task.cached | 不报重复；各按本 Task 解析 | 有 |
| T001 | topic 默认值改成 5 | ODSL301，数字 | 无 |
| T002 | set_variable 写 confidence | ODSL302，targetVariableId 的引用 | 无 |
| T003 | set_variable 写 read_only shared 变量 | ODSL302，目标引用 | 无 |
| T004 | set_variable toggle 携带 value | ODSL307，value；不重复 ODSL303 | 无 |
| T005 | number 变量执行 toggle | ODSL307，operation | 无 |
| T006 | api_request method = PATCH | ODSL303，PATCH | 无 |
| T007 | api_request 缺 body | ODSL104，config 块末尾 | 无 |
| T008 | llm_call output "result" -> agent.brief | ODSL304，"result" | 无 |
| T009 | on_failure retry 3 | ODSL305，3 | 无 |
| T010 | API headers 含 Accept 和 accept | ODSL308，第二项 name；related 第一项 | 无 |
| T011 | literal JSON object 的值写 agent.topic | ODSL309，动态引用；与 API form entry ValueSource 区分 | 无 |
| T012 | 比较 number > "high" | ODSL306，比较符 | 无 |
| T013 | 主图或 Loop 内声明 layout 分区 | ODSL102，对应分区 | 无 |
| G001 | research -> research | ODSL401，该边 | 无 |
| G002 | 两个节点互相连线形成环 | ODSL404，确定性选定环边，related 其余环边 | 无 |
| G003 | research -> start | ODSL403，边；不重复 readiness | 无 |
| G004 | 普通 research 写 research.approved -> end | ODSL402，approved | 无 |
| G005 | 同一 Branch case 指向两个目标 | ODSL402，第二条边；related 第一条 | 无 |
| G006 | Loop body 包含 loop | ODSL405，内层 loop 声明 | 无 |
| G007 | max_turns 0 | ODSL406，0 | 无 |
| R001 | knowledge ["Missing"]; 完整 inventory | ODSL501，名称字符串 | 无 |
| R002 | Product Docs 在同 Workspace 有两个不同 UUID 候选 | ODSL502，引用；不选择第一条 | 无 |
| R003 | 新 reusable tool name 与保留的旧工具重名 | ODSL503，新 name；related 有源码时指旧声明 | 无 |
| R004 | inventory 加载中且文本引用 Product Docs | ODSL504，context-required，不报 ODSL501 | 无 |
| R005 | 基线 Product Docs→A，现同名→B | ODSL505，引用，stale；不绑定 B | 无 |
| R006 | 基线 A 改名，旧名称已不存在 | ODSL505，优先 stale，不仅当作拼写错误 | 无 |
| R007 | 其他 Workspace 有同名项，但本地没有 | ODSL501，不泄漏其他 Workspace | 无 |
| R008 | 引用 Reusable Tool 的保留配置依赖已删变量 | ODSL506，在 tool 引用处，提供依赖类别 | 无 |
| C001 | version "9.0" | ODSL601，版本字符串 | 无 |
| C002 | Printer 输入有无法反解的 binding 或多个 unbound End | ODSL602，保留原 Canvas；不生成截断 DSL | 无 |
| C003 | 注入 emitter 缺陷，最终 schema 不通过 | ODSL603，映射 AST；不抛未处理异常 | 无 |
| C004 | 内部 identity 基线无法区分 rename 与新建 | ODSL507，context-required | 无 |

T002–T013 的 Tool/Branch/布局场景须先构建字段齐全、连线结构合法的 owner 再做单点变体；不得用缺 config 的残缺片段“证明”类型检查。检测到语法歧义需要恢复时，仍优先执行规则特定诊断，避免把所有错误退化为 ODSL102。

## 3. Readiness 策略验收（2026-10-22 已确认）

| case | 场景 | 预期 |
| --- | --- | --- |
| W001 | 删除 research -> end | ODSL453 等确定性 reachability warnings；checked、有候选，但标记未就绪 |
| W002 | 加入无连接的完整 Task | ODSL452/453，Task owner span；不报结构 error |
| W003 | 合法 Branch default 未连线 | ODSL451，default 声明；checked、有候选，标记未就绪 |
| W004 | 普通节点连到两个后继 | ODSL454；不隐式解释为并行 |
| W005 | 结构有环且也存在孤立节点 | 只在该图报结构错误，抑制该图 readiness |
| W006 | Loop body 缺连线 | 在 body 精确定位 warnings，不只报外层 INVALID_LOOP_BODY |

## 4. 精确位置、恢复与副作用验收

2026-10-22 新增已确认决策验收：

| case | 场景 | 预期 |
| --- | --- | --- |
| E001 | 命名 accepted/rejected End，分别引用父级 Accepted/Rejected，Branch 正确连接 | checked；graph 1.1.0，binding 与 inventory 一致，无额外隐式 end |
| E002 | exit 名称缺失、父级 inventory 已完整 | ODSL501，无候选 |
| E003 | 两个父级出口规范化同名 | ODSL502，无候选 |
| E004 | 命名出口 context 尚未实现/加载 | ODSL504，context-required |
| E005 | 命名 End 缺 exit，或和裸 end 混用 | ODSL408，无候选 |
| E006 | Loop body 声明命名 End 或 exit | ODSL408，无候选 |
| E007 | 单隐式 End，父级有多个合法出口且未选择 | ODSL408，要求显式选择，无候选 |
| E008 | 父级出口同名替换 binding | ODSL505，stale，不静默换绑 |
| E009 | 同一出口引用多个 End | 允许；不同 End 身份保留 |
| E010 | 到达命名 End | 只绑定指定既有出口，不生成 Pattern routes |
| U001 | 引用前后带空白的 Product Docs | 匹配规范化名称 Product Docs |
| U002 | 目录有 Product Docs 和 product docs | 两个不同名称，按大小写各自解析 |
| U003 | 目录有 NFC 等价的组合/分解名称 | 被引用时 ODSL502；创建/重命名拒绝冲突 |
| U004 | 新工具名称仅空白 | ODSL508，无候选 |
| U005 | 名称中间一个空格与两个空格 | 保持区别，不合并 |
| U006 | 同名分属知识库和工具 | 允许，按配置位置分类解析 |


- 空文本缺 token：span offset `0..0`，line/column `1:1`。
- `abc\r\nx` 中 x 的原始 offset 为 5，位置为 2:1；`\r\n` 在此说明文本中表示实际换行。
- 中文、emoji、tab 前后定位：offset 与 UTF-16 substring 一致；字符高亮不截断 surrogate pair。
- 注释/字符串中出现 `{ } -> ;` 不影响括号深度；模板位置按原字符串 offset 映射，不能按解码后字符串长度直接偏移。
- 缺分号恢复后第二个独立未知引用仍可诊断；重复 alias 后不继续假定第一条有效。
- 构造超过 200 条诊断的输入：末尾有 ODSL604，结果非完整、无可提交候选。预算重试与中断不能改变输入对象。
- 同一 source/context 连续检查得到相同诊断 code/span/related/order；formatter 重新打印的内容语义等价，原 source span 不复用于新文本。
- 对 source/context/current document 深冻结后检查；无 mutation、无 console 正文、无工具/网络/Store 调用。
- 三个完整语言示例成为正向 fixtures；未准备好资源时验证 context-required，准备后验证 checked。脚本输出等动态类型不得谎称已执行验证。

## 5. 会话验收

- 文本 A 检查晚于文本 B 返回：A 结果不能覆盖 B。
- 同文本、旧 inventory 结果晚返回：仍不可覆盖新 inventory 检查结果。
- checked 后 Canvas mutation：候选 stale，禁止 Apply，保留 DSL 草稿。
- checked 后资源删除/重命名/同名替换：重新检查，不静默绑定新 ID。
- Apply 前最新编译失败：原 Canvas 完全不变；成功只提交一次原子替换。
- 页面销毁后的检查完成不更新 session；save conflict/failure 不伪装成语法错误。

这些会话行为是后续 UI/application 的验收要求，本阶段不创建测试代码，也不宣称已经通过。


布局回归：Printer 不输出主图或 Loop 布局；仅移动/缩放不改变 DSL 草稿或检查状态；Apply 保留最新 placements、尺寸与 viewport，新增节点获得初始位置。

当前节点语法：`类型 "名称" { ... }`，连线按双引号名称引用；不使用节点 alias 或块内 name。同图名称规范化后唯一，Loop body 独立；内部 UUID 继续由会话保留。详见语言规范的“节点名称语法决策”。

边界简写验收：默认 start/end/loop_start/loop_end 输出分号；简写与旧空块编译等价；自定义名称和多个 End 不折叠；重复声明、名称加分号、跨作用域边界与多 End 的 end; 均阻断。

Branch 名称验收：Case 仅用字符串名称声明，连线 ."名称"；重复 NFC(trim(name)) 报 ODSL201，UI 阻断 Apply 并在 Case 内提示；旧 alias 写法拒绝；."default" 与 .default 独立解析；改名保留唯一可识别 Case 的 UUID、conditions 和出边；不同 Branch 可重名。

## 下一版直接绑定验收（2026-10-25，待实现）

| 场景 | 预期 |
| --- | --- |
| knowledge 混合固定 Playbook 和 $sys.target_knowledge_space$ | 触发输入合同已知时通过类型检查 |
| 工具 knowledgeSpaceId 引用同一系统 key | 与 Agent Knowledge 解析到同一次运行的同一 KS |
| $agent.question$ 用作 query | 保留普通值类型，非字符串拼接 |
| "$sys.target_knowledge_space$" | 字面名称/文本，不自动展开 |
| string 变量作为 knowledgeSpaceId | 类型错误，即使值看起来像有效 ID |
| 缺少闭合 $、未知 namespace/key | 源位置诊断；不生成可应用候选 |
| 向 $sys.target_knowledge_space$ 写入 | 拒绝，只读系统输入 |
| 事件目录已知但没有运行实例 | 不因未知具体 KS 拒绝合法动态配置 |
| 运行事件文档不属于 KS 或权限不足 | 运行拒绝，不回退其他 KS |
| Canvas/JSON/DSL 往返动态资源 | 保留系统引用，不能冻结为样例 UUID/名称 |
| 相同 Workflow 连续处理 KS A、KS B | 配置不变，各次运行绑定独立，不沿用上次目标 |
| ${agent.question} 在字符串中 | 保持文本插值；不与整值绑定混淆 |

这些是下一版合同验收，不是当前 parser 已通过的测试。版本/迁移与完整规则见 [直接变量绑定设计](./runtime-variable-binding-design.md)。
