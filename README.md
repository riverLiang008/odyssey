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

Copy `.env.example` to `.env`, then start local services:

```bash
docker compose -f infrastructure/compose.yaml up -d
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
uv run uvicorn odyssey_api.main:app --reload
```

The web app runs at `http://localhost:5173`; the API health endpoint is `http://localhost:8000/api/v1/health`.

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
