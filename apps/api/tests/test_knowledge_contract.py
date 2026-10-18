from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from odyssey_api.knowledge.dto import (
    CompleteKnowledgeUploadRequest,
    CreateKnowledgeFolderRequest,
    CreateKnowledgeSpaceRequest,
    KnowledgeGraphOverview,
    KnowledgeGraphStatus,
    KnowledgeResourceDetail,
    KnowledgeSpaceLifecycleStatus,
    KnowledgeSpaceRevisionRequest,
    KnowledgeSpaceSummary,
    KnowledgeSpaceSummaryPage,
    ListKnowledgeSpacesQuery,
    PrepareKnowledgeUploadRequest,
    UpdateKnowledgeSpaceRequest,
)
from odyssey_api.knowledge.repository import _escape_like
from odyssey_api.main import create_app


def _summary_payload() -> dict[str, object]:
    return {
        "id": str(uuid4()),
        "name": "Space",
        "description": None,
        "category": {
            "id": str(uuid4()),
            "name": "Default",
            "colorToken": None,
            "sortOrder": 0,
            "isDefault": True,
        },
        "lifecycleStatus": "ready",
        "graphStatus": "healthy",
        "fileCount": 0,
        "knowledgeFamilyCount": 0,
        "openIssueCount": 0,
        "createdAt": "2026-08-25T12:00:00Z",
        "updatedAt": "2026-08-26T12:00:00Z",
    }


def test_knowledge_openapi_identities() -> None:
    paths = create_app().openapi()["paths"]
    assert paths["/api/v1/knowledge-spaces"]["get"]["operationId"] == "listKnowledgeSpaces"
    assert paths["/api/v1/knowledge-spaces"]["post"]["operationId"] == "createKnowledgeSpace"
    assert (
        paths["/api/v1/knowledge-spaces/{knowledge_space_id}"]["get"]["operationId"]
        == "loadKnowledgeSpace"
    )
    assert (
        paths["/api/v1/knowledge-space-categories"]["get"]["operationId"]
        == "listKnowledgeSpaceCategories"
    )
    detail_path = paths["/api/v1/knowledge-spaces/{knowledge_space_id}"]
    assert detail_path["put"]["operationId"] == "updateKnowledgeSpace"
    assert detail_path["delete"]["operationId"] == "deleteKnowledgeSpace"
    assert (
        paths["/api/v1/knowledge-spaces/{knowledge_space_id}/commands/archive"]["post"][
            "operationId"
        ]
        == "archiveKnowledgeSpace"
    )
    assert (
        paths["/api/v1/knowledge-spaces/{knowledge_space_id}/commands/unarchive"]["post"][
            "operationId"
        ]
        == "unarchiveKnowledgeSpace"
    )
    assert (
        paths["/api/v1/knowledge-spaces/{knowledge_space_id}/file-tree"]["get"]["operationId"]
        == "loadKnowledgeFileTree"
    )
    assert (
        paths["/api/v1/knowledge-spaces/{knowledge_space_id}/graph"]["get"]["operationId"]
        == "loadKnowledgeGraph"
    )
    assert (
        paths["/api/v1/knowledge-spaces/{knowledge_space_id}/graph-manifest/validate"]["post"][
            "operationId"
        ]
        == "validateKnowledgeGraphManifest"
    )
    assert (
        paths["/api/v1/knowledge-spaces/{knowledge_space_id}/graph-manifest/apply"]["post"][
            "operationId"
        ]
        == "applyKnowledgeGraphManifest"
    )
    assert (
        paths["/api/v1/knowledge-spaces/{knowledge_space_id}/folders"]["post"]["operationId"]
        == "createKnowledgeFolder"
    )
    assert (
        paths["/api/v1/knowledge-spaces/{knowledge_space_id}/uploads/prepare"]["post"][
            "operationId"
        ]
        == "prepareKnowledgeUpload"
    )
    assert (
        paths["/api/v1/knowledge-spaces/{knowledge_space_id}/uploads/complete"]["post"][
            "operationId"
        ]
        == "completeKnowledgeUpload"
    )
    assert (
        paths[
            "/api/v1/knowledge-spaces/{knowledge_space_id}/resources/{resource_id}/commands/move"
        ]["post"]["operationId"]
        == "moveKnowledgeResource"
    )
    assert (
        paths["/api/v1/knowledge-spaces/{knowledge_space_id}/resources/{resource_id}"]["get"][
            "operationId"
        ]
        == "loadKnowledgeResource"
    )
    assert (
        paths["/api/v1/knowledge-spaces/{knowledge_space_id}/resources/{resource_id}"]["delete"][
            "operationId"
        ]
        == "deleteKnowledgeResource"
    )
    assert (
        paths["/api/v1/knowledge-spaces/{knowledge_space_id}/resources/{resource_id}/content"][
            "put"
        ]["operationId"]
        == "updateKnowledgeResourceContent"
    )


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
    payload = _summary_payload()
    payload.update({"name": "  Product Research  ", "updatedAt": "2026-08-26T20:00:00+08:00"})
    page = KnowledgeSpaceSummaryPage.model_validate(
        {"items": [payload], "page": 1, "pageSize": 20, "total": 1}
    )

    assert page.items[0].name == "Product Research"
    assert page.items[0].updated_at == datetime(2026, 8, 26, 12, tzinfo=UTC)
    dumped = page.model_dump(mode="json", by_alias=True)["items"][0]
    assert dumped["updatedAt"] == "2026-08-26T12:00:00Z"
    assert dumped["category"]["name"] == "Default"


@pytest.mark.parametrize("status", list(KnowledgeSpaceLifecycleStatus))
def test_every_knowledge_lifecycle_status_is_accepted(
    status: KnowledgeSpaceLifecycleStatus,
) -> None:
    payload = _summary_payload()
    payload["lifecycleStatus"] = status.value
    assert KnowledgeSpaceSummary.model_validate(payload).lifecycle_status is status


@pytest.mark.parametrize("status", list(KnowledgeGraphStatus))
def test_every_knowledge_graph_status_is_accepted(status: KnowledgeGraphStatus) -> None:
    payload = _summary_payload()
    payload["graphStatus"] = status.value
    assert KnowledgeSpaceSummary.model_validate(payload).graph_status is status


def test_not_indexed_graph_projection_is_strict_and_empty() -> None:
    knowledge_space_id = uuid4()
    graph = KnowledgeGraphOverview.model_validate(
        {
            "knowledgeSpaceId": str(knowledge_space_id),
            "status": "not_indexed",
            "generatedAt": None,
            "nodes": [],
            "edges": [],
            "families": [],
            "issues": [],
        }
    )
    assert graph.knowledge_space_id == knowledge_space_id
    with pytest.raises(ValidationError):
        KnowledgeGraphOverview.model_validate(
            {
                **graph.model_dump(mode="json", by_alias=True),
                "workflowNodes": [],
            }
        )


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("id", "not-a-uuid"),
        ("category", {"id": "not-a-uuid"}),
        ("updatedAt", "not-a-timestamp"),
        ("updatedAt", "2026-08-26T12:00:00"),
        ("name", "   "),
    ],
)
def test_knowledge_summary_rejects_invalid_boundary_values(field: str, value: object) -> None:
    payload = _summary_payload()
    payload[field] = value
    with pytest.raises(ValidationError):
        KnowledgeSpaceSummary.model_validate(payload)


def test_create_request_trims_and_rejects_extra_fields() -> None:
    category_id = uuid4()
    request = CreateKnowledgeSpaceRequest.model_validate(
        {"name": "  Research  ", "description": "   ", "categoryId": str(category_id)}
    )
    assert request.name == "Research"
    assert request.description is None
    with pytest.raises(ValidationError):
        CreateKnowledgeSpaceRequest.model_validate(
            {"name": "Research", "categoryId": str(category_id), "workspaceId": str(uuid4())}
        )


def test_mutation_requests_are_strict_and_canonical() -> None:
    category_id = uuid4()
    update = UpdateKnowledgeSpaceRequest.model_validate(
        {
            "expectedRevision": 2,
            "name": "  Updated research  ",
            "description": "   ",
            "categoryId": str(category_id),
        }
    )
    assert update.name == "Updated research"
    assert update.description is None
    assert update.expected_revision == 2
    revision = KnowledgeSpaceRevisionRequest.model_validate({"expectedRevision": 3})
    assert revision.expected_revision == 3
    with pytest.raises(ValidationError):
        UpdateKnowledgeSpaceRequest.model_validate(
            {
                "expectedRevision": 0,
                "name": "Research",
                "description": None,
                "categoryId": str(category_id),
            }
        )
    with pytest.raises(ValidationError):
        KnowledgeSpaceRevisionRequest.model_validate(
            {"expectedRevision": 1, "workspaceId": str(uuid4())}
        )


def test_create_folder_request_trims_and_is_strict() -> None:
    parent_folder_id = uuid4()
    request = CreateKnowledgeFolderRequest.model_validate(
        {
            "expectedRevision": 2,
            "parentFolderId": str(parent_folder_id),
            "name": "  Sources  ",
        }
    )
    assert request.expected_revision == 2
    assert request.parent_folder_id == parent_folder_id
    assert request.name == "Sources"
    with pytest.raises(ValidationError):
        CreateKnowledgeFolderRequest.model_validate(
            {
                "expectedRevision": 2,
                "parentFolderId": str(parent_folder_id),
                "name": "Sources",
                "knowledgeSpaceId": str(uuid4()),
            }
        )


def test_upload_requests_are_strict_and_canonical() -> None:
    folder_id, artifact_id = uuid4(), uuid4()
    prepare = PrepareKnowledgeUploadRequest.model_validate(
        {
            "folderId": str(folder_id),
            "fileName": "  notes.md  ",
            "contentType": "  text/markdown  ",
            "sizeBytes": 12,
        }
    )
    assert prepare.folder_id == folder_id
    assert prepare.file_name == "notes.md"
    assert prepare.content_type == "text/markdown"
    complete = CompleteKnowledgeUploadRequest.model_validate(
        {"artifactId": str(artifact_id), "expectedRevision": 2}
    )
    assert complete.artifact_id == artifact_id
    assert complete.expected_revision == 2
    with pytest.raises(ValidationError):
        PrepareKnowledgeUploadRequest.model_validate(
            {
                "folderId": str(folder_id),
                "fileName": "notes.md",
                "contentType": "text/markdown",
                "sizeBytes": 0,
            }
        )
    with pytest.raises(ValidationError):
        CompleteKnowledgeUploadRequest.model_validate(
            {
                "artifactId": str(artifact_id),
                "expectedRevision": 2,
                "workspaceId": str(uuid4()),
            }
        )


def test_resource_detail_contract_is_strict() -> None:
    payload = {
        "id": str(uuid4()),
        "knowledgeSpaceId": str(uuid4()),
        "folderId": str(uuid4()),
        "name": "notes.md",
        "status": "indexing",
        "mimeType": "text/markdown",
        "sizeBytes": 12,
        "createdAt": "2026-08-25T12:00:00Z",
        "updatedAt": "2026-08-25T12:00:00Z",
        "summary": None,
        "guide": None,
        "checksumSha256": "ab" * 32,
        "lastIndexedAt": None,
        "downloadUrl": "https://objects.test/notes.md?signature=short-lived",
        "downloadExpiresAt": "2026-08-25T12:15:00Z",
    }
    detail = KnowledgeResourceDetail.model_validate(payload)
    assert detail.checksum_sha256 == "ab" * 32
    with pytest.raises(ValidationError):
        KnowledgeResourceDetail.model_validate({**payload, "objectKey": "secret/path"})


def test_like_wildcards_are_escaped_as_literals() -> None:
    assert _escape_like(r"50%_done\path") == r"50\%\_done\\path"
