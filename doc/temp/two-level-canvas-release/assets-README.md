# 发布级图片

本目录存放《为什么是双层 Canvas》中英文页面共同引用的发布级图片。原始 Figma 节点导出保存在 `../../assets/`，不得被这里的加工版本覆盖。

## 处理方法

- 不使用生成式模型重绘产品 UI；
- 保留 Figma 原始像素，只叠加半透明遮罩、描边和语言中立编号；
- PNG 是正文使用的发布文件，`*-overlay.svg` 是可继续调整的标注层；
- 已按 720px 宽度缩放检查，编号与主要区域仍可辨认；
- 编号含义由各语言页面的图注解释，不在图片中烧录中文或英文长文本。

## 素材登记

| 发布文件 | Figma 节点 | 主要论点 | 编号 | 导出 / 标注日期 |
| --- | --- | --- | --- | --- |
| `journey-canvas-annotated.png` | `59:2` | Journey Canvas 在系统尺度组织结构，并用 Preview 连接 Agent Workflow | 1 System configuration；2 Agent Slot；3 Workflow Preview | 2026-10-02 / 2026-10-03 |
| `agent-workflow-canvas-annotated.png` | `62:2` | Agent Workflow Canvas 在单个 Agent 尺度组织内部执行 | 1 Node Palette；2 internal control flow；3 Available Tools | 2026-10-02 / 2026-10-03 |
| `thinking-ownership-annotated.png` | `119:2` | Thinking Ownership 表达责任归属，而不是 Canvas 层级 | 1 System；2 User-managed；3 Shared；4 Agent-managed | 2026-10-02 / 2026-10-03 |
| `thinking-ownership-across-canvas.png` | `166:2`、`62:2`、`119:2` | 同一颜色语义贯穿 Workflow 节点、Node Palette 与 Agent Variables | 左：Focus Mode；中：Node Palette；右：Agent Variables | 2026-10-03 |
| `system-pattern-selection.png` | `417:33` | OdyJourney 先从系统关系形状开始，再配置具体 Agent | Hub and Spoke、Circular Loop、Linear Sequence、Solo Component | 2026-10-03 |
| `cross-level-transition.png` | `59:2`、`62:2` | Agent Slot、只读 Workflow Preview 与完整 Agent Workflow Canvas 构成渐进式跨层路径 | 1 Agent Slot；2 Workflow Preview；3 Full Agent Workflow Canvas | 2026-10-02 / 2026-10-04 |

## Alt Text 建议

### 中文

- Journey Canvas：`Odyssey 的 Journey Canvas，编号标出 System configuration、选中的 Agent Slot 和只读 Workflow Preview。`
- Agent Workflow Canvas：`Research Agent 的 Workflow Canvas，编号标出节点面板、Agent 内部控制流和可用工具面板。`
- Thinking Ownership：`Agent Variables 面板，编号标出 System、User-managed、Shared 和 Agent-managed 四组变量。`
- 跨对象颜色：`Focus Mode 中的 Workflow 节点、节点面板与 Agent Variables 使用一致的 Thinking Ownership 颜色。`
- System Pattern：`Create OdyJourney 对话框展示四种 System Pattern 的名称、简化拓扑和适用工作。`
- 跨层路径：`从 Journey Canvas 中的 Agent Slot，经只读 Workflow Preview，进入完整 Agent Workflow Canvas。`

### English

- Journey Canvas: `Odyssey Journey Canvas with numbered emphasis on system configuration, the selected Agent Slot, and the read-only workflow preview.`
- Agent Workflow Canvas: `Research Agent Workflow Canvas with numbered emphasis on the node palette, internal control flow, and available tools.`
- Thinking Ownership: `Agent Variables panel with numbered emphasis on System, User-managed, Shared, and Agent-managed variable groups.`
- Cross-object colors: `Workflow nodes in Focus Mode, the node palette, and Agent Variables use the same Thinking Ownership colors.`
- System Pattern: `Create OdyJourney dialog showing four System Pattern options with simplified topology and intended use.`
- Cross-level transition: `The progressive transition from an Agent Slot on the Journey Canvas, through a read-only Workflow Preview, to the full Agent Workflow Canvas.`
