from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from odyssey_api.routers.health import router as health_router
from odyssey_api.settings import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Connections and storage clients will be initialized here as features land.
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Odyssey API",
        version="0.1.0",
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url=None,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.cors_origins],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
