from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from odyssey_api.bootstrap import bootstrap_development_workspace
from odyssey_api.db.models import Workspace
from odyssey_api.db.session import async_session_factory
from odyssey_api.dependencies.workspace import CurrentWorkspaceUnavailableError
from odyssey_api.main import create_app
from odyssey_api.settings import Settings, get_settings


@pytest.mark.integration
async def test_development_workspace_bootstrap_is_idempotent() -> None:
    workspace_id = uuid4()
    settings = Settings(
        environment="development",
        development_workspace_id=workspace_id,
        development_workspace_name="Bootstrap Integration",
    )
    try:
        async with async_session_factory() as session:
            first = await bootstrap_development_workspace(session, settings)
        async with async_session_factory() as session:
            second = await bootstrap_development_workspace(session, settings)
        assert first.created is True
        assert second.created is False

        async with async_session_factory() as session:
            workspace = (
                await session.execute(select(Workspace).where(Workspace.id == workspace_id))
            ).scalar_one()
            assert workspace.name == "Bootstrap Integration"
    finally:
        async with async_session_factory() as session, session.begin():
            await session.execute(delete(Workspace).where(Workspace.id == workspace_id))


async def test_development_workspace_bootstrap_fails_closed_in_production() -> None:
    settings = Settings(
        environment="production",
        development_workspace_id=uuid4(),
    )
    async with async_session_factory() as session:
        with pytest.raises(CurrentWorkspaceUnavailableError):
            await bootstrap_development_workspace(session, settings)


@pytest.mark.integration
async def test_bootstrapped_workspace_can_list_journeys_over_http() -> None:
    workspace_id = uuid4()
    settings = Settings(
        environment="development",
        development_workspace_id=workspace_id,
        development_workspace_name="HTTP Bootstrap Integration",
    )
    try:
        async with async_session_factory() as session:
            await bootstrap_development_workspace(session, settings)
        app = create_app()
        app.dependency_overrides[get_settings] = lambda: settings
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/journeys")
        assert response.status_code == 200
        assert response.json() == []
    finally:
        async with async_session_factory() as session, session.begin():
            await session.execute(delete(Workspace).where(Workspace.id == workspace_id))
