# R-012 制作表：Workflow 之外的系统全貌

首版进展：用户通过分镜并授权制作，R012 / R012Review已导出，类型检查、bundle、规格及完整解码通过。交付字幕为校正副本，源SRT与录音不变；待用户审阅实际听感与节奏。输出见 [制作记录](./制作记录_v01.md)，下方“未制作动画”为历史状态。

最新进展：已生成 [静态分镜总览](./review-v01/R-012_分镜总览_v01.png) 和5张独立1920×1080关键画面，待用户审阅。原音频和SRT未修改；尚未制作动画。

状态：音频与字幕已收到，已检查容器信息和字幕文本；当前为分镜提案阶段，未制作动画。编号保留R-012，制作形式改为Motion，不新增M编号。

[分镜方案](./分镜方案_v01.md) · [通用模板](../../../templates/motion-production-template.md)

## A. 制作意图

对应HOW001镜头067，来源为 [英文分镜V2](../../../../advertise/HOW/001/Odyssey_HOW002_EN_Voiceover_Shot_Segmentation_V2.md)。观众应理解：Workflow说明执行步骤，而完整Agent系统还有设置、防护规则与Agent协作；这些信息分散时难以看清全局。

范围包含两段旁白，完整保留最后“信息分散导致难以看清全貌”的句子。071的SK-01和073起的二维布局属于下一支M-01，不在这里提前展开。新规则下本支完成后可覆盖同镜头GFX-003；目前尚未交付，不提前勾选完成。

## B. 已有素材

| 项目 | 检查事实 |
| --- | --- |
| 录音 | HOW001-R012.m4a，AAC / 48kHz / 双声道，容器28.074667秒 |
| SRT | HOW001-R012.srt，5条，0～27.200秒；时间连续、无重叠或逆序 |
| 尾部 | 字幕后约0.875秒音频保留，不直接按字幕终点截断 |
| 版本与零点 | 同名文件已收到；尚未试听验证同版性、实际读音及零点，暂按同零点提出分镜 |
| 图片 / 草图 | 未提供；本支概念可直接由AI设计，不需要再补截图才能开始 |

字幕与原稿差异：第1条 `decide on agent workflow` 对应 `design an Agent Workflow`，`four-agent` 对应 `full Agent`；第3条 `gareals` 对应 `Guardrails`，`a different agent` 对应 `different Agents`；第4条 `it is` 与原稿 `it's` 有差异。当前只记录，不改源SRT，不将原稿视为实际录音逐字转写。

原稿全文：

> When we design an Agent Workflow, we usually focus on the steps it runs. But a full Agent system has much more than a Workflow. It also has Settings, Guardrails, and ways for different Agents to work together.
>
> If all this information is spread across different pages and settings, it's hard to see the whole system clearly.

## C. 视觉与交付

浅色底、蓝色强调，沿用既有Odyssey风格。默认1920×1080、30 FPS；时长依录音，暂定843帧（28.1秒），非最终同步验收结果。输出带声审阅MP4、无声剪辑MP4、独立SRT、关键帧及制作记录；底部约160px留字幕。

只画结构与信息分布，不模拟系统执行。Workflow连接表示步骤；Settings / Guardrails用并列卡片或外围标识，不能画成Workflow的后续执行节点。Agent协作不固定数量或拓扑，不误读为“必须四个Agent”。最后分散的信息仍存在，不以删除配置表现简化。

## D. 制作方式

先交分镜与关键画面，审阅后制作动画。用户无需再准备完整UI或额外录音；下一步先按原稿和实际录音校核字幕，再确定动作时间。当前原音频、SRT均未修改。

## E～G. 当前判断与后续验收

素材足够进入视觉分镜。语义分镜见独立方案；尚未实现Composition、代码、视频或关键帧，尚未执行音频完整解码、试听、音画同步、构建、确定性及视频规格检查。验收重点是步骤与系统配置层次清楚、配置分散的因果关系清楚、与M-01不重复讲二维方案。
