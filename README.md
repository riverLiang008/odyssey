# Odyssey

Odyssey is a visual environment for composing agent journeys, knowledge spaces, and reusable tools. This repository currently provides the production-oriented foundation for the Product v1 demo; it intentionally does not include an execution engine.

## Technology

- Web: Node.js 22, pnpm, Vue 3, TypeScript, Vite, Naive UI, Pinia, Vue Router, Vue Flow
- API: Python 3.12, uv, FastAPI, SQLAlchemy 2, Alembic
- Infrastructure: PostgreSQL and MinIO through Docker Compose

## Repository layout

```text
apps/
  web/                  Vue application
  api/                  FastAPI application
  docs/                 future user documentation site
packages/
  schemas/              shared domain contracts
  design-tokens/        framework-neutral design primitives
infrastructure/
  docker/               container definitions
  compose.yaml          local PostgreSQL and MinIO
seed/                   exported deployment seed packages
doc/                    product and architecture source documents
```

## Prerequisites

- Node.js 22 or newer
- pnpm 11.9.0 or a compatible pnpm 11 release
- Python 3.12 or newer
- uv 0.8 or newer
- Docker with Docker Compose (for PostgreSQL and MinIO)

## Local development

The repository-root `.env` is the only automatically loaded local configuration file.
Create it once, regardless of which directory is used to start the API:

```powershell
Copy-Item .env.example .env
```

Then start PostgreSQL (MinIO is optional for the Journey persistence slice):

```bash
docker compose -f infrastructure/compose.yaml up -d postgres
```

Install and run the web app:

```bash
pnpm install
pnpm dev
```

Install and run the API in another terminal:

```bash
cd apps/api
uv sync --dev
uv run alembic upgrade head
uv run python -m odyssey_api.bootstrap
uv run uvicorn odyssey_api.main:app --host 127.0.0.1 --port 8000
```

The bootstrap command explicitly creates the configured development Workspace and is safe
to repeat. It never runs in production and never chooses or generates a Workspace ID.

For routine development, add `--reload` only after confirming no existing process owns port
8000. On Windows, identify the listener and its command line before stopping anything:

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen |
  Select-Object LocalAddress,LocalPort,OwningProcess
Get-CimInstance Win32_Process -Filter "ProcessId = <PID>" |
  Select-Object ProcessId,Name,CommandLine
Stop-Process -Id <PID>
```

Only run `Stop-Process` after the command line confirms that the PID is the stale Odyssey
Uvicorn process. Do not kill processes merely because they use Python.

The web app may run at `http://localhost:5173` or `http://127.0.0.1:5173`. The API base URL is
`http://127.0.0.1:8000/api/v1`, and its health endpoint is
`http://127.0.0.1:8000/api/v1/health`.

Alternatively, the root lifecycle commands manage the complete stack as a singleton:

```powershell
pnpm.cmd dev:all
# From another terminal:
pnpm.cmd dev:down
```

`dev:all` starts infrastructure, runs migrations and the Workspace bootstrap, then starts one
non-reload API process and one Web process. It refuses to start when a managed instance or an
unmanaged process already owns port 8000/5173. `dev:down` securely contacts the matching
orchestrator through its local tokenized control channel, stops Web and API, runs Compose
down, and removes its runtime state. The state lives under ignored `.odyssey-dev/`.

## Checks

```bash
pnpm check
cd apps/api
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

## Architectural boundaries

- `WorkflowGraph` contains semantic nodes and edges only.
- `CanvasLayout` separately contains node positions and viewport state.
- Reusable tools are scoped to an Agent Workflow.
- Persisted variable ownership is limited to `user_managed`, `shared`, and `agent_managed`.
- System variables are runtime-provided and are not persisted.
- PostgreSQL stores knowledge metadata; object storage stores binary content.
- Demo journeys must be created through normal product APIs before export to `seed/`.

See [`doc/planning/project/odyssey-project-initialization-v2.md`](doc/planning/project/odyssey-project-initialization-v2.md) for the initialization plan.
