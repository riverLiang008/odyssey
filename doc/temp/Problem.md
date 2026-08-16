请修改 Odyssey 的 Journey Editor，使它符合以下产品设计。不要只做 CSS 或文案调整，需要先检查现有领域模型、交互状态和组件边界，再完成实现。

开始前必须完整阅读：
- doc/frontend-engineering-guidelines.md
- doc/temp/Problem.md
- doc/Pasted image 20260814223443.png
- doc/Pasted image 20260814224049.png

可以通过浏览器访问：
http://127.0.0.1:5173/journeys

进入 “Research System” Journey 后检查实际页面。当前主要问题如下。

一、重做 “Save as Template” 交互

当前行为：
选中一个已配置的 Agent Slot 后，画布底部常驻显示 “Save as Template” 表单。

目标行为：
1. 删除画布底部的常驻 “Save as Template” panel/form。
2. 在已配置 Agent Slot 的右键菜单中增加 “Save as template”。
3. 点击该菜单项后打开 modal/dialog。
4. 弹窗中填写：
   - Template name（必填）
   - Description（可选）
5. 提交时复用现有 store/repository 的 saveAsTemplate 能力。
6. 正确处理 loading、success 和 error 状态；成功后关闭弹窗并清空表单。
7. 弹窗应支持：
   - Esc 取消
   - 合理的初始焦点
   - focus trap
   - 关闭后焦点返回原 Slot
8. 空 Slot 不应出现 “Save as template” 操作。

不要在组件里直接调用 repository 或直接修改持久化状态。右键菜单事件应先转成 typed intent/state transition。

二、统一 Input Guardrail、Execution、Output Guardrail 的概念模型

设计语义：
页面中的蓝色 Pattern 区域表示“这个系统位置已经配置了一个 Pattern”。

Input Guardrail、Execution 和 Output Guardrail 并不是三种完全不同的 UI 对象。它们应使用相同的 Pattern 容器/配置机制，只是承担不同的系统角色：

- Input Guardrail
- Execution
- Output Guardrail

每一个区域都应该能够：
1. 处于未配置 Pattern 的状态；
2. 接受从 Pattern library 拖入的 Pattern；
3. 显示已配置 Pattern 的 topology；
4. 显示该 Pattern 的 Slots；
5. 允许向 Slot 中创建、拖入、替换或移除 Agent；
6. 保留其自身稳定的容器 identity、Pattern identity、Slot identity 和配置。

当前实现中，Input Guardrail 和 Output Guardrail 只是 SystemCanvas.vue 里的硬编码展示框，而 document 似乎只有一份 document.pattern。这不符合目标模型。

请先确认现有 schema/API 是否已经支持三个 Pattern 容器：

- 如果已经支持，修正 adapter、store 和 UI，使三个区域通过同一套可复用组件渲染。
- 如果尚未支持，不要用前端临时副本或三个互不关联的 component state 伪造。请明确指出 contract 缺口，并在仓库允许范围内建立正式、typed、可持久化的模型，例如通过稳定的系统角色 discriminator 区分容器。若后端/schema 变更超出本次范围，请清晰报告阻塞点和建议 contract，不要静默做 mock。

建议语义类似：

type SystemPatternRole =
  | 'input-guardrail'
  | 'execution'
  | 'output-guardrail'

但请根据现有代码和 schema 选择最合适的正式模型，不要机械照抄。

三个角色可以有不同的业务约束，但必须复用同一个 Pattern 容器抽象，不能继续把 Guardrail 写成静态 div。

三、把 Linear Pattern 的箭头排序改为拖动排序

当前行为：
Linear sequence 下方使用每个 Slot 对应的一组 ↑ / ↓ 按钮排序。这些按钮视觉上脱离 Slot，且是硬编码式操作。

目标行为：
1. 移除画布上的箭头排序控件。
2. 用户应直接拖动 Linear Pattern 中的 Slot 来改变顺序。
3. 拖动过程应有明确的插入位置/目标位置反馈。
4. drop 前必须执行 typed preflight；无效操作不能先 mutation 再回滚。
5. drop 成功后复用现有的 reorderSlot domain command，通过 store action 提交。
6. 排序的是 Slot identity 及其 assignment，不是交换两个 Agent；Agent 必须始终跟随所属 Slot。
7. 重排后重新派生 route 和 layout，不得直接修改像素坐标来伪造排序。
8. 非 linear Pattern 不应启用这种排序。
9. disabled/loading 状态下不可拖动。
10. Esc 或 drag cancel 后不得留下部分修改或错误 hover 状态。

现状提示：
- apps/web/src/domain/pattern/patternCommands.ts 已存在 reorderSlot。
- apps/web/src/stores/journeyEditor.ts 已有 reorder-slot 分发路径。
- apps/web/src/features/journey-editor/SystemCanvas.vue 当前只是用按钮触发 reorder。
因此底层领域能力基本存在，本次重点是增加正确的 drag intent、drop target、preflight 和视觉反馈，而不是重写排序规则。

可访问性要求：
拖动不能成为唯一操作路径。移除可见箭头后，仍需为键盘用户提供等价排序能力，例如 Slot 右键菜单中的 “Move earlier / Move later”，或另一种明确、可聚焦的无障碍操作；不要继续保留截图中那排游离的小箭头。

架构要求

严格遵守 doc/frontend-engineering-guidelines.md，尤其是：

- Domain State ≠ Canvas View Model
- Persisted State ≠ Temporary UI State
- User Event ≠ Direct State Mutation
- 所有 drag payload 必须带有明确 kind，并经过 runtime parsing
- dragover 只更新临时反馈，不得修改 document
- 只有 valid drop 才能触发 domain command
- Pattern topology/layout 必须由 strategy/adapter 派生
- 不允许 Vue Flow、DOM event 或组件临时状态泄漏进 schema/repository payload
- 不使用 any 或双重类型断言绕过边界验证
- 不把三个 Pattern 容器实现为三个重复的数据副本

建议先审计这些文件及相关测试：

- apps/web/src/views/JourneyEditorView.vue
- apps/web/src/features/journey-editor/SystemCanvas.vue
- apps/web/src/features/journey-editor/AgentSlot.vue
- apps/web/src/features/journey-editor/AgentSlotContextMenu.vue
- apps/web/src/canvas/interaction/*
- apps/web/src/canvas/system/*
- apps/web/src/domain/pattern/*
- apps/web/src/stores/journeyEditor.ts
- 对应 schema、repository 和测试文件

验收标准

1. 页面底部不再出现常驻 Save as Template 表单。
2. 右键已配置 Agent Slot 可以选择 “Save as template” 并完成弹窗保存。
3. Input Guardrail、Execution、Output Guardrail 都基于同一种 Pattern 容器组件和正式领域模型渲染。
4. 三个区域都能分别表达 empty/configured 状态。
5. Pattern 和 Agent 的拖放不会串扰不同容器或 Slot。
6. Linear Slot 可以通过直接拖动重新排序。
7. 页面中不再出现截图所示的 ↑/↓ 按钮条。
8. 键盘用户仍有等价排序路径。
9. Slot identity、Agent assignment 和 route invariants 在重排前后保持正确。
10. 增加或更新：
   - domain reorder invariant tests
   - drag/drop preflight tests
   - SystemCanvas component tests
   - Save as template context-menu/dialog tests
   - 多 Pattern 容器隔离测试
   - 至少一个真实浏览器 drag-sort 验证
11. 运行并通过项目适用的 lint、typecheck、test 和 build。
12. 最后通过浏览器重新打开 Journey 页面，报告实际验证结果，并列出仍受 schema/API 限制的内容。

实现前请先简短说明：
- 当前数据模型为什么只能/不能表达三个 Pattern 容器；
- 准备修改哪些领域、store、adapter 和 UI 边界。

完成后请报告：
- 修改文件；
- 关键模型变化；
- 自动化测试结果；
- 浏览器验证结果；
- 尚未完成或被后端 contract 阻塞的部分。