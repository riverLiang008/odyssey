# Motion 制作系统 — Remotion MVP

创建日期：2026-10-27。用途：Odyssey HOW 002 — How Odyssey Starts。

## 目标与范围

在现有仓库建立独立的 `motion/` 工作区，使用 Remotion、React、TypeScript 和 SVG，完成第一支可确定性逐帧预览和导出的 Motion，并为后续批量制作保留统一主题、视频规格与基础组件。此次不制作其他 Motion。

## 开始前检查

- [x] 检查目录、技术栈、包管理器、构建命令和已有 Remotion 依赖。
- [x] 完整阅读当前前端工程规范。
- [x] 检查现有颜色、字体、圆角、间距、SVG 和展示组件，记录复用方式。
- [x] 保留工作区已有未提交修改。

## 实施约束

Motion 与业务应用隔离，优先复用 `@odyssey/design-tokens` 和轻量视觉资源。不修改业务逻辑、Canvas 编辑器或后端，不引入执行引擎、视频管理平台或复杂交互组件。React 是独立视频工具链的要求，原 Vue 应用保持原架构。所有动画仅由帧驱动，使用 `useCurrentFrame`、`interpolate`、`spring`，不使用自动播放 CSS、定时器、随机值或真实时间。

## 交付内容

- [x] 独立工作区、严格 TypeScript 配置、Remotion 注册入口与 Composition。
- [x] 统一主题与 1920 × 1080、30 FPS 规格。
- [x] MotionNode：文字、尺寸、背景、边框、圆角、淡入和轻缩放。
- [x] MotionArrow：起终点、SVG 箭头、连线生长和可配置起始帧。
- [x] MotionBehavior：贯穿阶段的行为维度，不能作为第四个执行节点或独立执行流程。
- [x] MotionLabel：统一字体、字号、颜色和淡入。
- [x] Motion 001 配置化文字、时间和布局；时长 8～10 秒、浅色背景、无声。
- [x] Studio、MP4 和指定帧 PNG 命令；媒体与临时产物加入 gitignore。
- [x] README：结构、制作约定、命令、语义限制与验证结果。

## Motion 001 — Execution Module × Execution Behavior

旁白语义：用二维矩形结构组织配置。横向是 Execution Module，Pattern（拓扑）组织 Agent；纵向是贯穿执行的 Execution Behavior。Module / Pattern 主动推进系统状态，Behavior 不主动推进系统状态。

1. 三个模块居中横排依次淡入：Input Guardrail、Agent、Output Guardrail。
2. 两条箭头从左向右依次生长，表达简化执行顺序；明确这不是正式的多 Agent Pattern 拓扑。
3. 引入贯穿阶段的半透明 Behavior 区域。视觉方案为 MVP 待审稿，不创造新的系统机制。
4. 抽象为二维结构：横向 Execution Modules / State Progression；纵向 Execution Behaviors / Cross-cutting Behavior。纵向不添加执行箭头或运行脉冲。

## 验收

- [x] Motion TypeScript 与 bundle 构建通过。
- [x] Studio 启动，Motion 001 可预览。
- [x] MP4 导出成功；核对 1920 × 1080、30 FPS、8～10 秒、无音频。
- [x] 导出并检查关键分镜静态帧，确认布局、文字、语义。
- [x] 相同帧重复渲染一致。
- [x] Odyssey 原前端 production build 通过；按工程规范执行适用检查。
- [x] 最终列明文件、目录、命令、已完成事项和未解决问题；未执行项不标记通过。

建议产物：`motion/out/motion-001.mp4`、`motion/out/motion-001-preview.png`。

最终验收：能在 Odyssey 仓库稳定预览和导出第一支 Motion，后续可复用同一组件与流程。视觉方案待用户检查后迭代。

## 2026-10-27 实施与验证记录

- 独立 `motion/` 已加入 pnpm workspace，Remotion / CLI 固定为 4.0.502。业务前端 Vue 3 / TypeScript / Vite，pnpm 11.9.0；原先无 Remotion / React 工作区。
- 共享颜色、圆角直接引用 `@odyssey/design-tokens`；字体沿用业务 CSS 的 Inter / Segoe UI / system sans，视频字号独立缩放。现有业务 SVG 与本分镜用途不同；Guardrail / Agent Vue 组件依赖业务交互，因此使用独立轻量 SVG。
- `pnpm --filter @odyssey/motion build`：严格类型检查及 bundle 通过。
- Studio：本机 3100 端口启动，Playwright + Chrome 实际访问 `/Motion001`，SVG 文字加载成功，无 pageerror。验证脚本与截图位于忽略的 `motion/out/`。
- PNG：检查第 60、110、165、240 帧，无文字裁切，分镜分别呈现模块、箭头、Behavior 和最终二维标注。
- 相同环境第 240 帧两次导出 SHA-256 均为 `7A474D04B909D0EAFF67AEB6A813A8D4E868B8547AC594786DA56E2E779F6BA7`。
- MP4：使用 `--muted` 导出成功；ffprobe 核对 H.264、1920×1080、30/1 FPS、300 帧、10.000000 秒、仅一个 video stream，无音轨，400408 字节。
- `pnpm check`：lint、typecheck、schemas 93 tests、Web 619 tests（108 files）、production build 全通过。Vue Flow 的 jsdom 样式/尺寸提示未导致失败。
- `pnpm install --filter @odyssey/motion... --offline --frozen-lockfile`：通过，工作区依赖与锁文件一致。
- 原前端、后端、Canvas 业务文件无本任务改动；保留既有未提交工作。

## 待审与已知限制

- Behavior 覆盖区域与二维标注为首版视觉表达，待用户检查，不宣称是正式系统运行拓扑。
- 本地字体、浏览器与操作系统不同可能影响文字像素；跨机器像素一致需固定字体和浏览器。当前同环境确定性已验证。
- `pnpm peers check` 仍提示 `schema-utils@4.8.1` 期望 Webpack `^5.112.0`，Remotion 间接依赖使用 `5.105.0`。当前 typecheck、bundle、Studio、PNG、MP4 均通过。尝试单独升级 Webpack，但 npm 对其间接包连续 ECONNRESET，故撤回该未完成升级，保持已验证的锁文件。后续网络恢复可协调 Remotion 工具链升级后重新验证；未改原业务依赖来消除此声明告警。

## 文件清单

新增：`motion/README.md`、`motion/package.json`、`motion/tsconfig.json`、`motion/remotion.config.ts`、`motion/src/index.ts`、`motion/src/Root.tsx`、`motion/src/theme/index.ts`、`motion/src/components/{timing.ts,MotionNode.tsx,MotionArrow.tsx,MotionBehavior.tsx,MotionLabel.tsx}`、`motion/src/scenes/{motion001Config.ts,ExecutionDimensions.tsx}`、`motion/src/compositions/Motion001.tsx`、本任务文档。

修改：`pnpm-workspace.yaml`（加入 motion）、`pnpm-lock.yaml`（依赖锁定）、`.gitignore`（仅追加 Motion 产物规则）。目录与使用命令见 `motion/README.md`。
