# 《为什么是双层 Canvas》发布工作包

> Status: Active  
> Created: 2026-10-03  
> Scope: 中文样章发布级配图、中文定稿、英文同步与正式站点迁移  
> Baseline: `../why-two-level-canvas.zh.md`

## 1. 目标

将已通过方向 Review 的中文图文样章整理为可发布的内容基准，再据此生成等义英文稿并迁入正式双语文档站。

本工作包不重新讨论双层 Canvas 的核心命题，也不扩展 Research Assistant 案例。Benchmark 仍是独立的后续核验工作，不阻塞本样章定稿。

## 2. 文件结构

```text
two-level-canvas/
├── why-two-level-canvas.zh.md       # 中文内容基准
├── double-layer-canvas-sample-scope.md
├── assets/                          # Figma 原始节点导出
└── release/
    ├── README.md                    # 本 Todo 与交付记录
    └── assets/                      # 发布级图片；完成后由中英文页面共同引用
```

素材规则：

- `../assets/` 保留未经标注的 Figma 原始导出，不直接覆盖；
- `assets/` 只存放经过裁切、强调或尺寸优化的发布级图片；
- 发布级文件名保持语言中立，中英文页面复用同一张图；
- 中文或英文说明写在各自图注里，不把长段中文烧录进图片；
- 每张图保留 Figma 节点、导出日期与主要论点记录。

## 3. Todo

### A. 发布级图片

- [x] A1. 为发布图片分别冻结唯一的主要论点。
- [x] A2. Journey Canvas：强调 System configuration、Agent Slot 与右下角 Workflow Preview。
- [x] A3. Agent Workflow Canvas：强调 Node Palette、局部控制流与 Available Tools。
- [x] A4. Thinking Ownership：强调 System、User-managed、Shared、Agent-managed 四组变量。
- [x] A5. 检查标注在桌面宽屏和 720px 窄幅下是否仍可辨认。
- [x] A6. 为发布级图片补齐语言中立文件名、Alt Text 建议、Figma 节点和日期。
- [x] A6a. 补充 Focus Mode、Node Palette 与 Agent Variables 的跨对象颜色对照图。
- [x] A6b. 补充 System Pattern 选择图，并限定为双层 Canvas 所需的轻量介绍。
- [x] A6c. 补充 Agent Slot → Workflow Preview → Full Agent Workflow Canvas 的跨层组合图。
- [x] A7. River 完成图片选择与视觉重点 Review。

### B. 中文样章定稿

- [x] B1. 清理“初稿”“候选图”“待裁切”等内部编辑标记。
- [x] B2. 统一 `Journey Canvas`、`System Canvas`、`Agent Workflow Canvas`、`Thinking Ownership` 等术语。
- [x] B3. 核对图号、图注、正文引用与设计来源。
- [x] B4. 核对所有 Figma 节点和核对日期。
- [x] B5. 保留 Benchmark 的“待核验观察”边界，不提前加入产品事实。
- [x] B6. 完成内容、产品事实和视觉三类自检。
- [x] B6a. 由独立 Codex 完成冷读验收，只提交问题清单，不直接改写正文。
- [x] B7. River 完成中文最终 Review。
- [x] B8. 将中文版明确标记为内容基准。

### C. 英文同步

> 只有 B7、B8 完成后才启动。

- [x] C1. 按中文定稿生成等义英文稿。
- [x] C2. 使用冻结术语表，不自行增加产品承诺或设计结论。
- [x] C3. 保持标题层级、图号、图片、Figma 节点和来源一一对应。
- [x] C4. 对英文表达进行自然化处理，避免机械逐字翻译。
- [x] C5. 完成中英文逐节一致性检查。
- [x] C6. River 完成英文快速 Review。

英文同步记录（2026-10-04）：

- 英文稿：`../why-two-level-canvas.en.md`；
- 中英文标题层级均为 14 项，发布图片均为 6 张；
- 图 1a、图 1b、图 2、图 3、图 4、图 5，以及 Figma 节点 `119:2`、`166:2`、`59:2`、`417:33`、`62:2` 一一对应；
- 已核对 `OdyJourney`、`Journey Canvas`、`System Canvas`、`Agent Workflow Canvas`、`Agent Slot`、`Thinking Ownership`、`Execution Behavior` 与 `Single` Pattern；
- 英文稿未增加中文基线之外的设计结论、能力承诺或实现状态判断；
- River 英文快速 Review 的两条批注已解决：移除过早出现的 Color 论述，并补充跨层路径图；最终自检通过。

### D. 正式文档站迁移

- [x] D1. 确定正式的中文与英文页面路径。
- [x] D2. 将发布级图片迁入站点统一静态资源目录。
- [x] D3. 配置中英文导航与对应页面切换。
- [x] D4. 检查图片路径、内部链接、标题锚点和来源链接。
- [x] D5. 检查桌面与窄屏排版。
- [x] D6. 运行 VitePress 构建并修复阻塞问题。
- [ ] D7. River 完成正式页面发布 Review。

正式站点迁移记录（2026-10-04）：

- 英文页面：`docs/core-concepts/two-level-canvas.md`；
- 中文页面：`docs/zh/core-concepts/two-level-canvas.md`；
- 共享图片：`docs/public/images/design-decisions/two-level-canvas/`；
- VitePress locale 菜单提供中英文双向切换，英文旧路径保持不变；
- 中文导航和侧栏当前只暴露已完成的《为什么是双层 Canvas》，不为尚未迁移的页面制造占位内容；
- `pnpm docs:build` 通过；生成的中英文页面、语言链接与 6 张图片均已检查；
- 已检查桌面宽屏与 720px 窄屏布局，未发现溢出或不可读内容；
- 构建仅保留 Vite/Rollup 的既有大 chunk 警告，不阻塞本次文档迁移。

### E. 方法沉淀

- [ ] E1. 从样章提炼后续设计文章的内容模板。
- [ ] E2. 冻结概念图、Figma 图和历史图的使用规范。
- [ ] E3. 将有效的三类 Review 检查项写入统一 Review 模板。

## 4. 当前输入

| 输入 | 位置 | 状态 |
| --- | --- | --- |
| 中文样章 | `../why-two-level-canvas.zh.md` | 图文初稿已通过方向 Review |
| 命题与边界 | `../double-layer-canvas-sample-scope.md` | 已确认 |
| Journey Canvas 原图 | `../assets/journey-canvas.png` | Figma `59:2` |
| Agent Workflow 原图 | `../assets/agent-workflow-canvas.png` | Figma `62:2` |
| Thinking Ownership 原图 | `../assets/thinking-ownership.png` | Figma `119:2` |
| 术语基准 | `../../../foundations/first-release-terminology.md` | 已冻结 |
| 可见性表述 | `../../../foundations/visibility-language-guidelines.md` | 已冻结 |
| 来源与内容类型 | `../../../foundations/status-and-evidence-guidelines.md` | 已冻结 |

## 5. 完成定义

本工作包完成需要同时满足：

- 中文版获得 River 明确批准，并成为语义基准；
- 三张发布级图片各自承担清晰且不重复的主要论点；
- 英文版与中文定稿没有实质性语义差异；
- 中英文页面可从正式站点互相切换；
- 构建、链接、图片和窄屏显示检查通过；
- 后续文章可以复用本样章验证过的写作与视觉规则。

## 6. 执行顺序

```text
A 发布级图片
→ B 中文定稿
→ River 中文 Review
→ C 英文同步
→ D 正式站点迁移
→ E 方法沉淀
```
