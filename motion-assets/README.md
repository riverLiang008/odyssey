# Motion 制作资料与素材

此一级目录统一存放 Odyssey Motion 的制作表、分镜、任务记录和素材。制作代码位于相邻的 `motion/` 工作区。

- [制作表模板：人填 A～D，AI 补分镜与验收](./templates/motion-production-template.md)
- [Motion 001 填写示例](./examples/motion-001-brief-sample.md)
- [HOW001 / M-01 重制制作表与人工设计清单](./projects/odyssey-how001/m-01/brief.md)
- [HOW001 / M-02 节点分类制作表与人工素材清单](./projects/odyssey-how001/m-02/brief.md)
- [HOW001 / M-03 决策权对照制作表与人工素材清单](./projects/odyssey-how001/m-03/brief.md)
- [HOW001 / M-04 四项配置与知识 / 工具对照（合并 125、129）](./projects/odyssey-how001/m-04/brief.md)
- [HOW001 / M-05 文件夹存储与知识关系图](./projects/odyssey-how001/m-05/brief.md)
- [HOW001 / M-06 检索与知识图谱导航：制作表与人工素材清单](./projects/odyssey-how001/m-06/brief.md)
- [HOW001 / M-07 四个核心概念：制作表与分镜](./projects/odyssey-how001/m-07/brief.md)
- [HOW001 / M-09 从任意结构到预设Pattern：制作表与分镜](./projects/odyssey-how001/m-09/brief.md)
- [HOW001 / FIG-002 LLM Call作为Tool：Motion制作表与分镜](./projects/odyssey-how001/fig-002/brief.md)
- [Motion 制作工作流（含 Mermaid 与未来旁白 / SRT 协作方式）](./motion-production-workflow.md)
- [Remotion MVP 与 Motion 001 — Execution Module × Execution Behavior](./motion-remotion-mvp-task.md)
- [Motion 工作区使用说明](../motion/README.md)

## 目录约定

```text
motion-assets/
├── README.md
├── motion-production-workflow.md
├── motion-remotion-mvp-task.md
├── templates/                     # 可复制的空白制作表
├── examples/                      # 填写示例
└── projects/                      # 后续每支 Motion 的资料与素材
    └── <video-name>/<motion-id>/
        ├── brief.md               # 人填写 A～D，AI 补 E～G
        ├── narration/             # 旁白音频与对应文稿
        ├── subtitles/             # 对应版本的 SRT
        └── references/            # 参考图、logo 与其他输入素材
```

`projects/` 下的示意子目录在实际制作时创建。新任务将模板复制为对应项目的 `brief.md`，集中引用该目录内的音频、SRT 与参考素材；相对路径以制作表所在目录为基准并明确标注。现有 MVP 文档保留在本目录，作为基础环境的历史记录。

Markdown、SRT 与旁白文稿可提交；本目录内的大体积音频、视频及临时产物已加入 `.gitignore`，通过约定的文件交付或共享位置传递，并在制作表记录文件引用和版本。不要将本地素材被 Git 忽略误认为已随仓库共享。最终渲染结果仍输出到 `motion/out/`。
