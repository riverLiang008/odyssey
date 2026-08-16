from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from odyssey_api.errors.handlers import register_error_handlers
from odyssey_api.journeys.router import router as journeys_router
from odyssey_api.journeys.template_router import router as agent_templates_router
from odyssey_api.routers.health import router as health_router
from odyssey_api.settings import get_settings

OPENAPI_TAGS = [
    {
        "name": "system",
        "description": "Service availability and operational endpoints.",
    },
    {
        "name": "journeys",
        "description": (
            "Workspace-scoped Journey, Pattern, slot assignment, and Agent workflow operations. "
            "Mutations use optimistic revisions and return the canonical editor contract."
        ),
    },
    {"name": "agent-templates", "description": "Visible reusable Agent Templates."},
]


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Connections and storage clients will be initialized here as features land.
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    expose_docs = settings.environment != "production"
    app = FastAPI(
        title="Odyssey API",
        summary="Workspace-scoped Journey configuration API",
        description=(
            "Odyssey's HTTP contract for Journey Patterns and Agent workflows.\n\n"
            "All business resources are scoped to the server-resolved current Workspace. "
            "Mutation endpoints use optimistic concurrency; a `409` response means clients "
            "must reload the latest aggregate before retrying. Errors always use the canonical "
            "`{error: {code, details}}` envelope."
        ),
        version="0.1.0",
        openapi_url="/openapi.json" if expose_docs else None,
        docs_url="/docs" if expose_docs else None,
        redoc_url=None,
        openapi_tags=OPENAPI_TAGS,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.normalized_cors_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "If-Match"],
    )
    register_error_handlers(app)
    app.include_router(health_router, prefix=settings.api_v1_prefix)
    app.include_router(journeys_router, prefix=settings.api_v1_prefix)
    app.include_router(agent_templates_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
