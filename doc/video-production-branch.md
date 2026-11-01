# 视频制作分支

视频制作资料统一放在 `video-production` 分支，包括：

- `advertise/`：脚本、进度表与正式素材。
- `motion/`：Remotion 制作代码与工作区配置。
- `motion-assets/`：制作资料、分镜与输入素材。

`main` 不再跟踪这三个目录，也不包含 Motion 工作区。已有历史提交保留，不改写历史。请勿把整个视频制作分支合并回 main；需要复用产品代码时，单独迁移相应改动。

继续制作视频：

```powershell
git switch video-production
pnpm install
```

本地音频、渲染缓存等仍遵循视频分支的忽略规则，未被 Git 跟踪的文件不会因推送分支而自动备份。
