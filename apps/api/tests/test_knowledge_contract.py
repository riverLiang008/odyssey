from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from odyssey_api.knowledge.dto import (
    KnowledgeGraphStatus,
    KnowledgeSpaceLifecycleStatus,
    KnowledgeSpaceSummary,
    KnowledgeSpaceSummaryPage,
    ListKnowledgeSpacesQuery,
)
from odyssey_api.knowledge.repository import _escape_like
from odyssey_api.main import create_app


def test_knowledge_inventory_openapi_identity() -> None:
    operation = create_app().openapi()["paths"]["/api/v1/knowledge-spaces"]["get"]
    assert operation["operationId"] == "listKnowledgeSpaces"
    assert operation["tags"] == ["knowledge-spaces"]


def test_knowledge_inventory_query_defaults_trim_and_limits() -> None:
    query = ListKnowledgeSpacesQuery.model_validate({"query": "  Research  "})
    assert (query.query, query.page, query.page_size) == ("Research", 1, 20)
    with pytest.raises(ValidationError):
        ListKnowledgeSpacesQuery.model_validate({"page": 0})
    with pytest.raises(ValidationError):
        ListKnowledgeSpacesQuery.model_validate({"pageSize": 101})
    with pytest.raises(ValidationError):
        ListKnowledgeSpacesQuery.model_validate({"workspaceId": str(uuid4())})


def test_knowledge_inventory_response_is_strict_and_camel_case() -> None:
    page = KnowledgeSpaceSummaryPage(items=[], page=1, page_size=20, total=0)
    assert page.model_dump(mode="json", by_alias=True) == {
        "items": [],
        "page": 1,
        "pageSize": 20,
        "total": 0,
    }
    with pytest.raises(ValidationError):
        KnowledgeSpaceSummaryPage.model_validate(
            {"items": [], "page": 1, "pageSize": 20, "total": 0, "workspaceId": str(uuid4())}
        )


def test_populated_knowledge_inventory_response_has_canonical_values() -> None:
    space_id, category_id = uuid4(), uuid4()
    page = KnowledgeSpaceSummaryPage.model_validate(
        {
            "items": [
                {
                    "id": str(space_id),
                    "name": "  Product Research  ",
                    "description": None,
                    "knowledgeSpaceCategoryId": str(category_id),
                    "lifecycleStatus": "ready",
                    "graphStatus": "healthy",
                    "updatedAt": "2026-08-26T20:00:00+08:00",
                }
            ],
            "page": 1,
            "pageSize": 20,
            "total": 1,
        }
    )

    assert page.items[0].name == "Product Research"
    assert page.items[0].description is None
    assert page.items[0].updated_at == datetime(2026, 8, 26, 12, tzinfo=UTC)
    assert page.model_dump(mode="json", by_alias=True)["items"][0] == {
        "id": str(space_id),
        "name": "Product Research",
        "description": None,
        "knowledgeSpaceCategoryId": str(category_id),
        "lifecycleStatus": "ready",
        "graphStatus": "healthy",
        "updatedAt": "2026-08-26T12:00:00Z",
    }


@pytest.mark.parametrize("status", list(KnowledgeSpaceLifecycleStatus))
def test_every_knowledge_lifecycle_status_is_accepted(
    status: KnowledgeSpaceLifecycleStatus,
) -> None:
    summary = KnowledgeSpaceSummary.model_validate(
        {
            "id": str(uuid4()),
            "name": "Space",
            "description": None,
            "knowledgeSpaceCategoryId": str(uuid4()),
            "lifecycleStatus": status.value,
            "graphStatus": "not_indexed",
            "updatedAt": "2026-08-26T12:00:00Z",
        }
    )
    assert summary.lifecycle_status is status


@pytest.mark.parametrize("status", list(KnowledgeGraphStatus))
def test_every_knowledge_graph_status_is_accepted(status: KnowledgeGraphStatus) -> None:
    summary = KnowledgeSpaceSummary.model_validate(
        {
            "id": str(uuid4()),
            "name": "Space",
            "description": None,
            "knowledgeSpaceCategoryId": str(uuid4()),
            "lifecycleStatus": "initializing",
            "graphStatus": status.value,
            "updatedAt": "2026-08-26T12:00:00Z",
        }
    )
    assert summary.graph_status is status


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("id", "not-a-uuid"),
        ("knowledgeSpaceCategoryId", "not-a-uuid"),
        ("updatedAt", "not-a-timestamp"),
        ("updatedAt", "2026-08-26T12:00:00"),
        ("name", "   "),
    ],
)
def test_knowledge_summary_rejects_invalid_boundary_values(field: str, value: str) -> None:
    payload = {
        "id": str(uuid4()),
        "name": "Space",
        "description": None,
        "knowledgeSpaceCategoryId": str(uuid4()),
        "lifecycleStatus": "ready",
        "graphStatus": "healthy",
        "updatedAt": "2026-08-26T12:00:00Z",
    }
    payload[field] = value
    with pytest.raises(ValidationError):
        KnowledgeSpaceSummary.model_validate(payload)


def test_like_wildcards_are_escaped_as_literals() -> None:
    assert _escape_like(r"50%_done\path") == r"50\%\_done\\path"
