# 《为什么是双层 Canvas》中文基准冻结记录

> Frozen: 2026-10-04  
> Decision: Approve  
> Approved by: River  
> Baseline file: `../why-two-level-canvas.zh.md`  
> SHA-256: `C6C697D991E8B3F6E34D390E9A8E099EC5339B1E1ACB2248F90B96DE86CAAC99`
> Revised: 2026-10-04（根据 River 英文快速 Review，同步修正中英文叙事顺序并增加跨层路径图）

## 冻结范围

- 中文正文、标题层级与论证顺序；
- 图 1a、图 1b、图 2、图 3、图 4、图 5 及对应图注；
- `Agent Slot`、`Journey Canvas`、`Agent Workflow Canvas`、`System Pattern`、`Workflow Preview`、`Thinking Ownership` 与 `Execution Behavior` 的公开用法；
- Guardrail、Main Execution 与 Execution Behavior 的结构描述；
- 设计限制、代价、未决问题与来源。

## 发布图片

- `assets/thinking-ownership-annotated.png`
- `assets/thinking-ownership-across-canvas.png`
- `assets/journey-canvas-annotated.png`
- `assets/system-pattern-selection.png`
- `assets/agent-workflow-canvas-annotated.png`
- `assets/cross-level-transition.png`

## Review 结果

- River 人工设计检查：Approve；
- 内容、产品事实与视觉自检：Pass；
- 独立 Codex 冷读：Approve with P2 follow-up；全部 follow-up 已解决；
- 剩余 P0 / P1 / P2：0 / 0 / 0。

## 后续同步规则

- 英文版从本基准生成，不增加、删除或改变设计结论；
- 中英文标题层级、图号、图片、Figma 节点、限制和来源保持对应；
- 中文若发生实质修改，必须更新本记录的哈希，并将英文版重新标记为待同步；
- 纯拼写、标点或不改变语义的排版修正可以直接同步记录。
