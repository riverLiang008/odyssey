# M-04 制作表：Agent 四项配置 → Knowledge Space × ToolBox

日期：2026-10-28。状态：动画成片已由用户确认 PASS；最新实现与检查见 [制作记录](./制作记录_v01.md)。下方初始状态为历史模板内容。

最新修订：用户授权后已按原稿修正 `HOW001-M4-1.srt` 的识别错误、术语与标点，5 条时间码不变，音频未改。下方“未改源字幕”为此前检查记录，以本条与分镜方案为准。

## 最新素材检查（优先于下方初始模板）

- 已收到 `HOW001-M4-1.m4a`、同名 SRT、`SK-06.svg`；音频容器约 32.128 秒。SRT 共 5 条，从 0 连续覆盖到 31.52 秒，完整覆盖 125 + 129 的五段概念；末尾约 0.608 秒未被字幕覆盖，尚未试听核验，不直接裁剪。
- `SK-06.svg` 是 3300 × 1810 的六格 UI 风格分镜，已在本机浏览器渲染查看；无外部图片引用。包含四项配置揭示、Knowledge Space / ToolBox 分别聚焦及结尾 Knowing / Doing 对照，足够作为本支画面参考，不需要另补早期草图。
- 图中 VOICEOVER 是简写 / 示意，实际录音与经确认的原稿为旁白依据，不要求再录图里的额外介绍句。Model / Goal 的单独高亮可放在开头列举的同一段中，不额外扩展旁白。
- SRT 存在多处疑似识别错误：第 1 条 `code` 应对应 `Goal`；第 2 条 `Of this form` 应对应 `Of these four`；第 3 条 `tax resources` 应为 `text resources`，`and agent needs` 应对应 `an Agent needs`，并需恢复 organizes 及列表标点；第 4 条恢复 `organizes the tools an Agent can use, and the actions it can take`；第 5 条核对 `Simply put` 是否漏识别。当前未改源字幕，也未根据字幕断定录音读错。
- 后续画面会明确展示 Knowledge / Instructions / Text resources 三类职责，与原稿保持一致，不只用图中的 Knowledge / context 缩写概括；ToolBox 保留 Tools / Actions。真实 UI 的复数标题 Knowledge Spaces 可作为 UI 标签保留，解释标题统一为原稿概念 Knowledge Space。
- 当前没有必需的设计补件；版本同一性、音频实际读法、静音及字幕对齐仍需后续检查。下方“未收到”等为初始模板记录，以本节为准。

**用户已明确：镜头 125 与 129 合并为同一支 Motion。** 沿用 M-04 编号，不另建一支动画。[人工素材清单](./设计与确认清单.md) · [完整旁白](./旁白与时间锚点.md) · [通用模板](../../../templates/motion-production-template.md)。

## A. 制作意图

| 项目 | 内容 |
| --- | --- |
| 编号 / 名称 | M-04 / Agent: Model, Goal, Knowledge Space, ToolBox |
| 所属视频 / 用途 | HOW001 的概念解释动画，视觉延续 M-01～M-03；历史脚本文件名保留 HOW002 |
| 合并范围 | 125：Model, Goal, Knowledge Space, and ToolBox；129：区分 Knowledge Space 与 ToolBox 的全部四句。SK-06 / SK-002 可用作本支引入参考 |
| 目标观众 | 已了解 Agent / Task 区别，接下来认识 Agent 配置的组织方式 |
| 核心 idea | 先展示四个并列配置，再从同一结构中突出 Knowledge Space 与 ToolBox，展开知道什么 / 能做什么的对照 |
| 结论 | Knowledge Space 组织知识、指令和文本资源；ToolBox 组织工具与可采取的行动。两者职责不同，但共同为 Agent 提供支持 |
| 必须出现 | Model、Goal、Knowledge Space、ToolBox；Knowledge / Instructions / Text resources 与 Tools / Actions；Knowing / Doing |
| 语义边界 | 四项配置是并列组成，不是四步执行链；Knowledge Space 和 ToolBox 不是互斥选项、上下游阶段或两种 Agent；Knowing / Doing 是职责概括，不表示只有 Knowledge Space 提供全部知识，或工具只能产生动作不能读取信息 |
| 默认不包含 | 121 的真人提问；139 后的文档关系问题与 M-05。需要扩大范围时另附素材，不自动合并 |
| 事实来源 | [英文分镜 V2](../../../../advertise/HOW/001/Odyssey_HOW002_EN_Voiceover_Shot_Segmentation_V2.md) 镜头 121、125、129、139；登记表 M-04 与 SK-002 |

本支不提前演示完整知识图谱、RAG / Graph Navigation 或真实 Agent 运行；配置卡片出现与高亮不代表配置完成或执行成功。

## B. 旁白与素材（人工提供）

当前仅有原稿文案，以下均为**建议文件名**，不是已交付文件。路径相对本目录，实际名字可不同。

| 输入 | 请准备 / 说明 |
| --- | --- |
| 【必需】旁白音频 | 建议 `how001-m4-1.m4a`，完整覆盖 125 + 129；wav / mp3 也可。可一段连续录音，也可分两段提供 |
| 【必需】同版 SRT | 建议 `how001-m4-1.srt`；若分段录音，各自附对应 SRT，各段可以从 0 开始 |
| 【需说明】版本与时间基准 | 注明同版与否、音频 / 字幕各自零点；分两段时注明播放顺序及是否需要停顿。AI 负责接缝和本地字幕映射，不改源时间 |
| 【按需】早期设计 | `SK-06.png` 或 SVG / PDF，对应镜头 125 的 SK-002。希望展示原始草图时提供；若直接从规整四项配置开始，可不提供 |
| 【可选】示意图 | `M-04_分镜示意_v01.png` 或 SVG；四至六格 / 一张最终结构均可，也可直接交 AI 设计 |
| 【可选】真实 UI 参考 | Agent 配置图、Knowledge Space / ToolBox 界面；仅在希望复用真实设计时提供，可指定 M-03 卡片作样式参考 |
| 语言 | 英文旁白与英文标签，中文制作说明；原文见旁白文档 |

实际音频 / SRT 路径及版本：待提供。是否同版、选段、零点、删句 / 变速 / 偏移：待核验。完整旁白包括最后一句 Knowing / Doing，不要漏录。

## C. 画面与交付建议

| 项目 | 默认提案 |
| --- | --- |
| 视觉 | 延续前几支浅色背景、蓝色强调、UI 风格卡片；同一 Agent 容器内四项并列 |
| 连贯变化 | 四项依次揭示 → 聚焦 Knowledge Space / ToolBox → 分别展开职责 → 最终同屏对照；Model / Goal 缩成背景上下文，不消失为“不需要” |
| 表达方式 | 分组框、并列卡片、强调区域；不用串行箭头把四项连成流程 |
| 规格与时长 | 建议 1920 × 1080、30 FPS；随真实录音决定，不预设时长 |
| 字幕 / 真人 | 不烧录字幕，底部预留约 160px；默认全屏动画，无真人小窗 |
| 交付 | 带声审阅版、无声剪辑版、对应 / 合并 SRT、关键帧及制作记录 |
| AI 可自行处理 | 排版、间距、字号、强调、过渡、停留、帧计算；不改原旁白或增加产品事实 |

## D. 制作方式

本轮只生成资料。沿用前几支流程：收到素材 → 检查 → 分镜与关键画面 → 用户通过 → 动画实现与导出 → 成片验收。

125、129 合并已确认，不再重复询问。需要人工补充的只有：是否用 SK-06 开头；由 AI 设计还是你提供示意；是否附加真实 UI 镜头。无特别偏好可直接写“AI 设计，规整卡片开头”。

## E. 材料检查（AI 后续）

已读取原稿相关段落与通用模板；当前本目录为新建资料目录，未收到音频 / SRT / 图片，不声称时长、版本或同步已核验。后续逐项检查实际文件、字幕漏句、术语、分段顺序、接缝、零点、阅读时间及安全区。

## F. 分镜草案（供准备素材参考，未确认）

| 镜头 | 旁白锚点 | 建议画面与动作 | 本地时间 / 帧 |
| --- | --- | --- | --- |
| S00 可选 | 125 / SK-06 | 原始草图出现后淡化进规整结构；没有草图则直接进入 S01 | 待素材 |
| S01 | A01 / 四项配置 | 同一 Agent 容器内依次显示 Model、Goal、Knowledge Space、ToolBox；并列不连执行箭头 | 待素材 |
| S02 | A02 / especially wanted to separate | Knowledge Space 与 ToolBox 成为焦点，Model / Goal 作为上下文保留 | 待素材 |
| S03 | A03 / Knowledge Space | 展开 Knowledge、Instructions、Text resources；右侧保留低对比度 | 待素材 |
| S04 | A04 / ToolBox | 展开 Tools、Actions；不把工具例子当作固定系统功能清单 | 待素材 |
| S05 | A05 / knowing and doing | 同屏总结 Knowing / Doing，并保留属于同一 Agent 的关系 | 待素材 |

收到真实字幕后记录版本、条目、源起止时间及摘录；不虚构 SRT 编号或时长。30 FPS 或明确修改的 FPS，区间 `[startFrame, endFrameExclusive)`；分段素材先映射本地时间再计算帧，音频 / SRT 更新后重新对齐。

## G. 实现与验收（AI 后续）

Composition、配置 / Scene、总帧数、命令、输出视频与关键帧：未实施。类型检查、bundle、确定性、整段播放、视频规格、音轨、同步、安全区与人工终审：未执行。

验收重点：四项关系清楚，两个职责区分准确，125 → 129 连贯；Knowing / Doing 不被误读为互斥或先后；不把概念动画当作运行能力证明。

登记处理：目前不修改素材完成状态。成片验收后 M-04 记录覆盖 125 / 129；若 SK-06 已用于同一成片，可在 SK-002 备注整合关系，避免后期重复剪入，但不提前宣称草图已交付或完成。
