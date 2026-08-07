# Odyssey 本地开发环境启停指南

本文档面向 Windows PowerShell，说明 Odyssey Product v1 Demo 的首次初始化、日常启动、检查和停止流程。

## 1. 环境要求

- Node.js 22 或更高版本
- pnpm 11
- Python 3.12 或更高版本
- uv
- Docker Desktop（包含 Docker Compose）

检查版本：

```powershell
node --version
pnpm --version
python --version
uv --version
docker --version
docker compose version
```

## 2. 首次安装依赖

在仓库根目录执行：

```powershell
pnpm install
```

安装后端依赖：

```powershell
Set-Location apps/api
uv sync --dev
Set-Location ../..
```

这些命令通常只需在首次克隆、锁文件发生变化或虚拟环境被删除后执行。

## 3. 启动 PostgreSQL 和 MinIO

仓库的 Compose 文件位于 `infrastructure/compose.yaml`，因此需要显式指定文件：

```powershell
docker compose -f infrastructure/compose.yaml up -d
```

查看状态：

```powershell
docker compose -f infrastructure/compose.yaml ps
```

正常情况下，以下服务应显示为 `healthy`：

- PostgreSQL：`localhost:5432`
- MinIO API：`http://localhost:9000`
- MinIO Console：`http://localhost:9001`

### 本机 5432 端口已被占用

如果本机安装的 PostgreSQL 已占用 `5432`，可使用仓库中的本地覆盖文件，将 Docker PostgreSQL 映射到 `55432`：

```powershell
docker compose `
  -f infrastructure/compose.yaml `
  -f infrastructure/compose.local.yaml `
  up -d
```

使用该覆盖文件时，执行迁移和启动 API 前需要设置数据库地址：

```powershell
$env:ODYSSEY_DATABASE_URL = "postgresql+asyncpg://odyssey:odyssey@127.0.0.1:55432/odyssey"
```

该环境变量只对当前 PowerShell 会话有效。

## 4. 执行数据库迁移

确保 PostgreSQL 已健康运行，然后执行：

```powershell
Set-Location apps/api
uv run alembic upgrade head
uv run alembic current
Set-Location ../..
```

`alembic current` 应显示当前 revision，并标记为 `head`。

## 5. 启动 API

打开一个 PowerShell 窗口：

```powershell
Set-Location apps/api
uv run uvicorn odyssey_api.main:app --reload
```

API 地址：

- 健康检查：<http://localhost:8000/api/v1/health>
- OpenAPI 文档：<http://localhost:8000/docs>

如果 Docker PostgreSQL 使用 `55432`，需要先在同一个窗口设置 `ODYSSEY_DATABASE_URL`，再启动 API。

停止 API：在其终端中按 `Ctrl+C`。

## 6. 启动 Web

再打开一个 PowerShell 窗口，在仓库根目录执行：

```powershell
pnpm dev
```

Web 地址：<http://localhost:5173>

停止 Web：在其终端中按 `Ctrl+C`。

## 7. 运行全部检查

前端检查包含 lint、类型检查、测试和生产构建：

```powershell
pnpm check
```

后端检查：

```powershell
Set-Location apps/api
uv run ruff check .
uv run ruff format --check .
uv run pytest
Set-Location ../..
```

## 8. 停止基础设施

停止并删除容器和网络，但保留 PostgreSQL、MinIO 数据卷：

```powershell
docker compose -f infrastructure/compose.yaml down
```

如果使用了本地端口覆盖文件，启停时建议始终传入相同的两个 Compose 文件：

```powershell
docker compose `
  -f infrastructure/compose.yaml `
  -f infrastructure/compose.local.yaml `
  down
```

仅停止容器而不删除容器：

```powershell
docker compose -f infrastructure/compose.yaml stop
```

再次启动已停止的容器：

```powershell
docker compose -f infrastructure/compose.yaml start
```

> 不要日常使用 `down -v`。`-v` 会删除数据库和对象存储数据卷，导致本地数据丢失。

## 9. 推荐的日常启停顺序

启动：

1. 启动 Docker Desktop。
2. 执行 Compose `up -d`。
3. 确认 PostgreSQL 和 MinIO 为 `healthy`。
4. 在 `apps/api` 执行 `uv run alembic upgrade head`。
5. 启动 API。
6. 在另一个终端启动 Web。

停止：

1. 在 Web 终端按 `Ctrl+C`。
2. 在 API 终端按 `Ctrl+C`。
3. 执行 Compose `stop`；如果希望删除容器和网络，则执行 `down`。

## 10. 本机 PostgreSQL 与 Docker PostgreSQL

Odyssey 只需要 Docker 中的 PostgreSQL，本机安装的 PostgreSQL 不是项目依赖。

如果没有其他项目使用本机 PostgreSQL，建议先停止服务并将启动方式改为手动，而不是立即卸载。请在管理员 PowerShell 中执行：

```powershell
Stop-Service postgresql-x64-18
Set-Service postgresql-x64-18 -StartupType Manual
```

需要恢复时：

```powershell
Set-Service postgresql-x64-18 -StartupType Automatic
Start-Service postgresql-x64-18
```

停止本机 PostgreSQL 后，Odyssey 可以直接使用标准的 Docker `5432` 映射，不再需要 `compose.local.yaml` 和 `55432` 数据库地址覆盖。

从 `55432` 切回标准 `5432` 映射：

```powershell
docker compose `
  -f infrastructure/compose.yaml `
  -f infrastructure/compose.local.yaml `
  down

docker compose -f infrastructure/compose.yaml up -d
```

此操作不会删除命名数据卷；不要添加 `-v`。

只有确认本机 PostgreSQL 中没有其他项目的数据、服务或工具依赖后，才建议通过 Windows 的“已安装的应用”卸载 PostgreSQL。
