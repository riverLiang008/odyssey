FROM python:3.12-slim AS runtime

COPY --from=ghcr.io/astral-sh/uv:0.8.13 /uv /uvx /bin/
WORKDIR /app

COPY apps/api/pyproject.toml apps/api/uv.lock* ./
RUN uv sync --frozen --no-dev

COPY apps/api/src ./src
COPY apps/api/alembic.ini ./alembic.ini
COPY apps/api/migrations ./migrations

ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uvicorn", "odyssey_api.main:app", "--host", "0.0.0.0", "--port", "8000"]

