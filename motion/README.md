# Odyssey Motion

独立的 Remotion + React + TypeScript + SVG 制作工作区。业务前端仍为 Vue，不导入业务 store、Canvas、API 或持久化模型。

任务与验收清单：[Motion MVP task](../motion-assets/motion-remotion-mvp-task.md)。

## M-05 文件夹与知识关系图（2026-10-29）

M-05：`prepare:m5` 准备录音与修订字幕，`review:m5` / `render:m5` 导出带声 / 无声版。Composition 为 `Motion005Review` / `Motion005`，1920 × 1080、30 FPS、1333 帧（约44.43秒）。输出 `motion/out/motion-005-review.mp4`、`motion-005.mp4`、`motion-005.srt`。源素材位于 `motion-assets/projects/odyssey-how001/m-05/`；`public/m5/` 为忽略的可重建媒体目录。概念图保留文件夹与同名文档关系，不是产品运行录屏。

## M-04 四项配置与资源对照（2026-10-28）

M-04（合并 125 / 129）：`prepare:m4` 准备媒体，`review:m4` / `render:m4` 导出带声 / 无声版。Composition 为 `Motion004Review` / `Motion004`，1920 × 1080、30 FPS、964 帧（约 32.13 秒）。输出 `motion/out/motion-004-review.mp4`、`motion-004.mp4`、`motion-004.srt`。输入在 `motion-assets/projects/odyssey-how001/m-04/`；生成目录 `public/m4/` 被 Git 忽略。S06 按确认的 SK-06 构图使用轻量 UI 区块和框外 Knowing / Doing 标签。

## M-03 决策权对照（2026-10-28）

M-03：使用 `prepare:m3` 准备原录音及已修正字幕，`review:m3` / `render:m3` 分别导出带声与无声版。Composition 为 `Motion003Review` / `Motion003`，1920 × 1080、30 FPS、615 帧（20.5 秒）。文件位于 `motion/out/motion-003-review.mp4`、`motion-003.mp4`、`motion-003.srt`；输入来源 `motion-assets/projects/odyssey-how001/m-03/`。`public/m3/` 为忽略的可重建媒体目录。其视觉是已通过分镜的 UI 风格概念重绘，不是实际运行录屏。

## M-02 节点分类（2026-10-28）

M-02 已增加独立的 `Motion002`（无声）与 `Motion002Review`（带声）Composition，规格 1920 × 1080、30 FPS、724 帧（约 24.13 秒）。在仓库根目录执行 `pnpm --filter @odyssey/motion prepare:m2` 准备媒体，然后使用 `review:m2` / `render:m2` 导出。输出为 `motion/out/motion-002-review.mp4`、`motion-002.mp4` 和未烧录的 `motion-002.srt`。素材来自 `motion-assets/projects/odyssey-how001/m-02/`；生成的 `public/m2/` 被 Git 忽略，换机器须另行共享原音频。分镜依据为该项目的 `分镜方案_v01.md`。

## M-01 重制版（2026-10-28）

新版使用已确认的 [分镜 v02](../motion-assets/projects/odyssey-how001/m-01/分镜方案_v02.md)，1920 × 1080、30 FPS、1723 帧（约 57.43 秒）。原 `Motion001` 与默认旧版命令保留。

```bash
# 将原始图片、两段录音复制到忽略的 public/m1-v2，并生成合并 SRT
pnpm --filter @odyssey/motion prepare:m1
pnpm --filter @odyssey/motion studio
# Studio 中选择 Motion001V2Review（带声）或 Motion001V2（无声）
pnpm --filter @odyssey/motion review:m1
pnpm --filter @odyssey/motion render:m1
```

PowerShell 如拦截 `pnpm.ps1`，可使用 `pnpm.cmd`。第二段录音从第 1212 帧（40.4 秒）开始；原录音、图片与源 SRT 不被改写。合并 SRT 输出为 `motion/out/motion-001-v2.srt`，第二段字幕统一增加 40.4 秒，不烧录到视频。当前按源 SRT 段落匹配，未实现自动语音或词级对齐。

输出：`motion/out/motion-001-v2-review.mp4`（审阅用，含旁白）及 `motion/out/motion-001-v2.mp4`（剪辑用，无声）。素材准备目录被 Git 忽略；换机器需另行提供原始媒体并运行 `prepare:m1`，不能只克隆源码就假定录音已存在。

制作流程、Mermaid 图与未来旁白 / SRT 方案：[Motion 制作工作流](../motion-assets/motion-production-workflow.md)。制作表、分镜及输入素材统一放在一级目录 [motion-assets/](../motion-assets/README.md)。

## 开始

在仓库根目录使用 Node >= 22、pnpm 11.9.0：

```bash
pnpm install
pnpm --filter @odyssey/motion studio
```

打开 `http://localhost:3100/Motion001`，在 Studio 拖动时间轴或播放。业务开发命令不变。Studio 是本地制作工具，不需要后端服务。

## 构建与导出

以下命令均在仓库根目录执行：

```bash
# 严格类型检查与独立 bundle
pnpm --filter @odyssey/motion build
# 1920 × 1080 / 30 FPS / 300 frames / 10 s / H.264 / 无声
pnpm --filter @odyssey/motion render
# 最终阶段，frame 240
pnpm --filter @odyssey/motion preview
# 任意指定帧（从 0 开始，合法范围 0～299）
pnpm --filter @odyssey/motion still out/frame-090.png --frame=90
```

默认输出：`motion/out/motion-001.mp4`、`motion/out/motion-001-preview.png`。`out/`、`build/`、`.cache/` 均已忽略。

Windows 默认复用已安装的 Chrome。也可设置 `REMOTION_BROWSER_EXECUTABLE` 为本地浏览器路径；其他系统默认使用 Remotion 管理的浏览器，首次可能需要下载。CLI 的 build、Studio、render、still 用法见 [Remotion 官方文档](https://www.remotion.dev/docs/cli)。

## 目录

```text
motion/
├── package.json
├── tsconfig.json
├── remotion.config.ts
├── README.md
└── src/
    ├── index.ts
    ├── Root.tsx
    ├── theme/index.ts
    ├── components/
    │   ├── timing.ts
    │   ├── MotionNode.tsx
    │   ├── MotionArrow.tsx
    │   ├── MotionBehavior.tsx
    │   └── MotionLabel.tsx
    ├── scenes/
    │   ├── motion001Config.ts
    │   └── ExecutionDimensions.tsx
    └── compositions/Motion001.tsx
```

## 制作约定

- `theme/index.ts` 直接引用 `@odyssey/design-tokens` 的颜色与圆角，集中维护视频规格、排版和间距。字体栈与业务 UI 一致，使用本地 Inter / Segoe UI / system sans，不请求远程字体。跨机器像素完全一致需要额外固定同一字体与浏览器版本；同一环境同一帧确定性渲染。
- 现有 `GuardrailModule.vue` / `AgentSlot.vue` 绑定业务交互与状态，不复用。现有 SVG 为聚焦与工具输出图标，与本分镜无关，箭头使用简单 SVG path。
- 文案、时间点与核心布局集中在 `scenes/motion001Config.ts`。Node 的 `radius=0` 可显示直角矩形，fill/stroke/尺寸可配置；Arrow 可配置起终点、时长、起始帧；Label 可配置文字、字号、颜色与淡入帧。
- 所有视觉由当前帧纯派生，禁止 CSS 自动播放动画、计时器、随机值和实时网络资源。
- 新 Motion 新增独立 scene/config/composition，在 Root 注册；复用组件与统一视频规格，不提前建立额外平台。

## Motion 001 分镜

| 帧 | 画面 |
| --- | --- |
| 12 / 30 / 48 | Input Guardrail、Agent、Output Guardrail 依次淡入与轻缩放 |
| 75 / 96 | 两条执行箭头依次生长 |
| 126～150 | 横跨三个阶段的 Behavior 浅色区域及无箭头括线出现 |
| 192～228 | 横向状态推进标注、纵向行为维度标注出现 |
| 228～299 | 最终二维概念结构停留 |

箭头只表达简化顺序，不代表正式的多 Agent Pattern 拓扑。Behavior 区域无执行箭头、节点编号或运行脉冲，不代表第四个节点，也不代表独立流程。纵向是组织维度，区域高度不编码数量或执行次数。此视觉方案为待用户评审的 MVP。

## 验证记录

2026-10-27：Motion 类型检查、bundle、Studio 浏览器预览（无 pageerror）、关键帧 PNG、MP4 导出均通过。ffprobe 确认 1920×1080、30 FPS、300 帧、10 秒、H.264、无音轨。同环境第 240 帧两次 PNG 的 SHA-256 一致。原仓库 `pnpm check` 全通过（93 schemas + 619 Web tests）。锁文件离线 frozen 安装通过。

已知依赖告警：`schema-utils@4.8.1` 声明需要 Webpack `^5.112.0`，Remotion 使用 `5.105.0`。实际构建与全部媒体导出通过；单独升级所需 npm 下载连续失败，未保留未完成的升级。视觉方案待用户审阅；跨机器精确字形需固定字体。详细证据与文件清单见任务文档。
