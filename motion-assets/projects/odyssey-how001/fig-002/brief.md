# FIG-002 制作表：LLM Call 也可以是 Tool

状态：静态分镜已获用户 PASS；Motion v01 已导出带声审阅版、无声剪辑版和校正字幕副本，等待成片审阅。保留 FIG-002 编号。详见 [制作记录](./制作记录_v01.md)。

[分镜方案](./分镜方案_v01.md) · [静态总览](./review-v01/FIG-002_分镜总览_v01.png)

## A. 范围与语义

HOW001镜头115。原稿虽以UI-08 Workflow / Focus Mode为画面标记，实际两句旁白解释的是LLM不必总作为独立顶层节点，以及单次模型调用可以作为另一个节点使用的工具。本轮用用户给定LLM Call工具面板表达，不自行补做Focus Mode界面或声称该SVG就是UI-08。

> This also means an LLM doesn't always need to be a separate top-level Node.
>
> If we only want to call a language model once, we can treat it as a Tool used by another node.

前接M-03 Agent / Task职责对照，后接121真人引出Agent四项配置。只解释单次调用的组织方式，不把LLM Tool等同拥有自主决策权的Agent，也不宣称顶层模型节点永远不允许。

## B. 已有素材

| 文件 | 检查结果 |
| --- | --- |
| HOW001-FIG002.m4a | 容器17.301333秒；尚未试听核验实际读音及同步 |
| HOW001-FIG002.srt | 2条，0～8秒、8～17秒；时间连续；尾部约0.301秒保留 |
| LLM Call.svg | 原始384×716；面板可见Model、System Prompt、Prompt、Output Mapping、Failure Behavior、Save Tool等配置 |

SRT差异：LMM对应LLM；language more than once对应language model once；cheat it对应treat it。后两处会改变语义，应按原稿和实际声音核验。当前只记录，源音频、SRT与SVG不改。

SVG中示例包括GPT-4o、task.source_records及response.text → task.research_brief，保留其设计稿原文；不把这些显示值当作实际运行输入、模型可用性证明或真实输出结果。面板是设计素材，不是已执行的证据。

## C. 画面与交付建议

浅色蓝白风格，先显示“LLM不一定是顶层节点”的概念，再将LLM Call作为另一个节点容器内的Tool展示，最后对照原工具配置SVG。概念图用Task示例，因面板使用task变量；这只是一个示例，不声称该工具只可挂到Task。图形不模拟调用运行、成功日志、生成结果或自动点击。

1920×1080、30 FPS，暂定520帧（17.333333秒）覆盖声音尾部。独立字幕不烧录，底部约160px预留。先审阅关键画面，再实现带声审阅版、无声剪辑版与校正字幕副本。

## 当前验收边界

类型检查、打包、关键帧检查、视频完整解码及字幕时间码校验均已通过。视频轨 520 帧、17.333333 秒，1080p / 30 FPS。源文件未修改；字幕副本按原稿校正识别错误。尚未人工完整播放或试听，句内动作时机和实际读音需成片审阅；总进度表暂不标记最终完成。画面表达组织方式，不作模型调用成本的性能结论。
