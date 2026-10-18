import json
from pathlib import Path
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import delete

from odyssey_api.bootstrap import (
    bootstrap_builtin_tool_definitions,
    bootstrap_development_workspace,
)
from odyssey_api.db.models import ToolDefinition, Workspace
from odyssey_api.db.session import async_session_factory
from odyssey_api.journeys.dto import ToolStep
from odyssey_api.main import create_app
from odyssey_api.settings import Settings, get_settings
from odyssey_api.tools.dto import ToolDefinitionResponse
from odyssey_api.tools.repository import list_builtin_definitions
from odyssey_api.tools.service import list_tool_definitions

FIXTURES = json.loads(
    (Path(__file__).parents[3] / "packages/schemas/fixtures/system-tools.json").read_text()
)


@pytest.mark.parametrize("step", FIXTURES["valid"], ids=lambda s: s["kind"])
def test_canonical_positive_parity(step: object) -> None:
    TypeAdapter(ToolStep).validate_json(json.dumps(step))


def test_tool_step_contract_allows_an_unbound_output() -> None:
    step = {
        "id": "0195f076-b6e6-7ef0-98db-000000000100",
        "kind": "script_execution",
        "label": None,
        "failureBehavior": {"kind": "fail_task"},
        "configuration": {"language": "python", "script": "result = 1"},
        "outputMapping": None,
    }
    parsed = TypeAdapter(ToolStep).validate_python(step)
    assert parsed.output_mapping is None


@pytest.mark.parametrize("step", FIXTURES["invalid"], ids=lambda s: s["kind"])
def test_canonical_negative_parity(step: object) -> None:
    with pytest.raises(ValidationError):
        TypeAdapter(ToolStep).validate_json(json.dumps(step))


def test_inventory_dto_rejects_unknown_kind_and_extra_fields() -> None:
    payload = dict(
        id=uuid4(),
        kind="web_search",
        source="built_in",
        name="Tool",
        category="test",
        description=None,
        configurationSchema={},
        inputSchema={},
        outputSchema={},
    )
    with pytest.raises(ValidationError):
        ToolDefinitionResponse.model_validate(payload)
    payload["kind"] = "llm_call"
    payload["workspaceId"] = str(uuid4())
    with pytest.raises(ValidationError):
        ToolDefinitionResponse.model_validate(payload)


@pytest.mark.integration
async def test_inventory_repository_service_and_http_postgres() -> None:
    workspace_id = uuid4()
    settings = Settings(environment="development", development_workspace_id=workspace_id)
    created: tuple[str, ...] = ()
    try:
        async with async_session_factory() as session:
            await bootstrap_development_workspace(session, settings)
        async with async_session_factory() as session:
            result = await bootstrap_builtin_tool_definitions(session, settings)
            created = result.created_kinds
        async with async_session_factory() as session:
            items = await list_builtin_definitions(session, workspace_id)
            assert len(items) == 5
            assert [(i.category, i.name, i.kind) for i in items] == sorted(
                (i.category, i.name, i.kind) for i in items
            )
        async with async_session_factory() as session:
            assert await list_tool_definitions(session, workspace_id) == items
        async with async_session_factory() as session:
            assert await list_builtin_definitions(session, uuid4()) == []
        app = create_app()
        app.dependency_overrides[get_settings] = lambda: settings
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/tool-definitions")
            assert response.status_code == 200
            assert response.json() == [i.model_dump(mode="json", by_alias=True) for i in items]
            assert set(response.json()[0]) == {
                "id",
                "kind",
                "source",
                "name",
                "category",
                "description",
                "configurationSchema",
                "inputSchema",
                "outputSchema",
            }
            forbidden = await client.get(
                "/api/v1/tool-definitions", params={"workspaceId": str(uuid4())}
            )
            assert forbidden.status_code == 422
            assert (await client.post("/api/v1/tool-definitions", json={})).status_code == 405
    finally:
        async with async_session_factory() as session, session.begin():
            await session.execute(delete(Workspace).where(Workspace.id == workspace_id))
            if created:
                await session.execute(
                    delete(ToolDefinition).where(ToolDefinition.kind.in_(created))
                )
