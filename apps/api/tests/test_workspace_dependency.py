from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from odyssey_api.dependencies.workspace import (
    CurrentWorkspaceUnavailableError,
    get_current_workspace,
)
from odyssey_api.main import create_app
from odyssey_api.settings import Settings, get_settings

WORKSPACE_ID = UUID("0195f076-b6e6-7ef0-98db-d721990f8001")


def test_development_workspace_must_be_explicit() -> None:
    with pytest.raises(CurrentWorkspaceUnavailableError):
        get_current_workspace(Settings(environment="development", development_workspace_id=None))


def test_development_workspace_is_resolved_from_server_settings() -> None:
    workspace = get_current_workspace(
        Settings(environment="development", development_workspace_id=WORKSPACE_ID)
    )
    assert workspace.id == WORKSPACE_ID


def test_production_fails_closed_even_when_development_id_is_set() -> None:
    with pytest.raises(CurrentWorkspaceUnavailableError):
        get_current_workspace(
            Settings(environment="production", development_workspace_id=WORKSPACE_ID)
        )


def test_missing_development_workspace_returns_canonical_503() -> None:
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(
        environment="development", development_workspace_id=None
    )
    response = TestClient(app).get("/api/v1/journeys")
    assert response.status_code == 503
    assert response.json() == {"error": {"code": "CURRENT_WORKSPACE_UNAVAILABLE", "details": {}}}
