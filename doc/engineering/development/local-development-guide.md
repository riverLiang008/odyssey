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

## 3. 一条命令启动全部服务（推荐）

首次依赖安装完成后，在仓库根目录执行：

```powershell
pnpm dev:all
```

该命令会依次：

1. 启动 PostgreSQL 和 MinIO，并等待健康检查通过。
2. 执行 `alembic upgrade head`。
3. 并行启动 FastAPI 和 Vite 开发服务器。

如果存在 `infrastructure/compose.local.yaml`，命令会自动使用该覆盖文件，并通过 `55432` 连接 PostgreSQL；否则使用标准的 `5432` 端口。

按 `Ctrl+C` 会停止 Web 和 API。PostgreSQL 与 MinIO 会继续运行，方便下一次快速启动。

需要停止并删除基础设施容器和网络时执行：

```powershell
pnpm dev:down
```

命名数据卷会被保留，本地数据库和 MinIO 数据不会被删除。

## 4. 手动启动 PostgreSQL 和 MinIO

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

## 5. 手动执行数据库迁移

配置只从仓库根目录 `.env` 自动加载；先在仓库根目录执行：

```powershell
Copy-Item .env.example .env
```

不要在 `apps/api` 创建另一份 `.env`。确保 PostgreSQL 已健康运行，然后执行迁移与显式、
幂等的 development Workspace bootstrap：

```powershell
Set-Location apps/api
uv run alembic upgrade head
uv run alembic current
uv run python -m odyssey_api.bootstrap
Set-Location ../..
```

`alembic current` 应显示当前 revision，并标记为 `head`。

## 6. 手动启动 API

打开一个 PowerShell 窗口：

```powershell
Set-Location apps/api
uv run uvicorn odyssey_api.main:app --host 127.0.0.1 --port 8000
```

API 地址：

- 健康检查：<http://localhost:8000/api/v1/health>
- Swagger API 文档：<http://localhost:8000/docs>
- OpenAPI 3.1 JSON：<http://localhost:8000/openapi.json>

Swagger 文档由 FastAPI 路由和 Pydantic DTO 自动生成，包含请求/响应 schema、错误 envelope、
示例与可直接发起请求的 **Try it out**。生产环境默认同时关闭 Swagger UI 和 OpenAPI JSON；
如需向外部分发合同，请在受控构建流程中导出 development/test 环境的 OpenAPI JSON，而不是
在生产服务上开放文档入口。

需要 `--reload` 时，先确认 8000 端口没有残留监听进程。Windows 上必须先识别 PID 与命令行：

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen |
  Select-Object LocalAddress,LocalPort,OwningProcess
Get-CimInstance Win32_Process -Filter "ProcessId = <PID>" |
  Select-Object ProcessId,Name,CommandLine
```

只有确认命令行属于已失效的 Odyssey Uvicorn 后，才执行 `Stop-Process -Id <PID>`；不得按
Python 进程名批量停止。随后可选择以 `--reload` 启动。

如果 Docker PostgreSQL 使用 `55432`，需要先在同一个窗口设置 `ODYSSEY_DATABASE_URL`，再启动 API。

停止 API：在其终端中按 `Ctrl+C`。

## 7. 手动启动 Web

再打开一个 PowerShell 窗口，在仓库根目录执行：

```powershell
pnpm dev
```

Web 地址：<http://localhost:5173>

停止 Web：在其终端中按 `Ctrl+C`。

## 8. 运行全部检查

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

## 9. 手动停止基础设施

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

## 10. 手动启停顺序

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

## 11. 本机 PostgreSQL 与 Docker PostgreSQL

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
