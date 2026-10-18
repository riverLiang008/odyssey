import base64
import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from pydantic import ValidationError

from odyssey_api.errors import ApplicationError, ErrorCode
from odyssey_api.knowledge.dto import (
    KnowledgeFileTree,
    KnowledgeFolderSummary,
    KnowledgeResourceSummary,
)
from odyssey_api.knowledge.manifest import (
    ApplyKnowledgeGraphManifestRequest,
    KnowledgeGraphManifest,
    ValidateKnowledgeGraphManifestRequest,
    ValidateKnowledgeGraphManifestResult,
    canonicalize_manifest_path,
    match_manifest_documents,
    produce_manifest_graph,
    validate_manifest_references,
)
from odyssey_api.knowledge.manifest_token import (
    ManifestValidationTokenClaims,
    ManifestValidationTokenError,
    create_manifest_validation_token,
    verify_manifest_validation_token,
)
from odyssey_api.knowledge.service import validate_knowledge_graph_manifest


def _manifest_payload() -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "key": "coffee-guide",
        "documents": [
            {
                "key": "coffee-basics",
                "path": "foundations/coffee-basics.md",
                "tags": ["foundations"],
            },
            {"key": "espresso", "path": "brewing/espresso.md", "tags": ["brewing"]},
        ],
        "tags": [
            {"key": "foundations", "name": "Foundations"},
            {"key": "brewing", "name": "Brewing"},
        ],
        "relations": [
            {
                "key": "espresso-builds-on-basics",
                "source": "espresso",
                "target": "coffee-basics",
                "kind": "builds_on",
            }
        ],
        "issues": [],
        "graph": {"status": "healthy"},
    }


def test_shared_manifest_fixtures_match_backend_contract() -> None:
    fixture_path = (
        Path(__file__).parents[3]
        / "packages"
        / "schemas"
        / "fixtures"
        / "knowledge-graph-manifest.json"
    )
    fixtures = json.loads(fixture_path.read_text(encoding="utf-8"))
    for payload in fixtures["valid"]:
        manifest = KnowledgeGraphManifest.model_validate(payload)
        assert validate_manifest_references(manifest) == ()

    rejected = 0
    for payload in fixtures["invalid"]:
        try:
            manifest = KnowledgeGraphManifest.model_validate(payload)
        except ValidationError:
            rejected += 1
            continue
        if validate_manifest_references(manifest):
            rejected += 1
    assert rejected == len(fixtures["invalid"])


def test_manifest_contract_is_strict_and_supplies_defaults() -> None:
    manifest = KnowledgeGraphManifest.model_validate(_manifest_payload())
    assert manifest.documents[0].status == "indexed"
    assert manifest.relations[0].status == "active"
    assert validate_manifest_references(manifest) == ()

    with pytest.raises(ValidationError):
        KnowledgeGraphManifest.model_validate({**_manifest_payload(), "workspaceId": "forbidden"})
    with pytest.raises(ValidationError):
        KnowledgeGraphManifest.model_validate({**_manifest_payload(), "graph": {"status": "error"}})


def test_manifest_paths_are_canonical_and_safe() -> None:
    assert canonicalize_manifest_path(" foundations\\coffee.md ") == "foundations/coffee.md"
    for path in ("/absolute.md", "C:\\absolute.md", "../escape.md", "folder//file.md"):
        with pytest.raises(ValueError, match="INVALID_DOCUMENT_PATH"):
            canonicalize_manifest_path(path)


def test_manifest_reference_validation_returns_stable_paths_and_codes() -> None:
    payload = _manifest_payload()
    payload["documents"] = [
        {"key": "coffee-basics", "path": "same.md", "tags": ["missing-tag"]},
        {"key": "coffee-basics", "path": "same.md"},
    ]
    payload["relations"] = [
        {"key": "self", "source": "coffee-basics", "target": "coffee-basics", "kind": "related_to"}
    ]
    manifest = KnowledgeGraphManifest.model_validate(payload)
    issues = validate_manifest_references(manifest)
    assert (("documents", 1, "key"), "DUPLICATE_KEY") in {
        (issue.path, issue.code) for issue in issues
    }
    assert (("documents", 1, "path"), "DUPLICATE_DOCUMENT_PATH") in {
        (issue.path, issue.code) for issue in issues
    }
    assert (("relations", 0, "target"), "SELF_RELATION") in {
        (issue.path, issue.code) for issue in issues
    }
    assert (("documents", 0, "tags", 0), "TAG_NOT_FOUND") in {
        (issue.path, issue.code) for issue in issues
    }


def test_validate_and_apply_boundary_dtos_are_strict() -> None:
    checksum = "a" * 64
    result = ValidateKnowledgeGraphManifestResult.model_validate(
        {
            "validationToken": "signed-token",
            "manifestChecksum": checksum,
            "knowledgeSpaceRevision": 7,
            "status": "valid",
            "matchedDocumentCount": 2,
            "unmatchedDocumentCount": 0,
            "summaryUpdateCount": 1,
            "guideUpdateCount": 0,
            "tagCount": 2,
            "relationCount": 1,
            "issueCount": 0,
            "resultingGraphStatus": "healthy",
            "issues": [],
        }
    )
    assert result.status == "valid"
    with pytest.raises(ValidationError):
        ApplyKnowledgeGraphManifestRequest.model_validate(
            {
                "expectedRevision": 7,
                "validationToken": "signed-token",
                "manifestChecksum": checksum,
            }
        )
    assert (
        ApplyKnowledgeGraphManifestRequest.model_validate(
            {
                "expectedRevision": 7,
                "validationToken": "signed-token",
                "manifestChecksum": checksum,
                "manifest": _manifest_payload(),
            }
        ).expected_revision
        == 7
    )


def test_manifest_validation_token_is_signed_and_contains_only_binding_claims() -> None:
    claims = ManifestValidationTokenClaims(
        workspace_id=uuid4(),
        knowledge_space_id=uuid4(),
        expected_revision=7,
        manifest_checksum="a" * 64,
        expires_at=datetime(2026, 10, 18, 2, 0, tzinfo=UTC),
    )
    token = create_manifest_validation_token(claims, "test-secret-with-enough-entropy")
    assert verify_manifest_validation_token(token, "test-secret-with-enough-entropy") == claims
    replacement = "a" if token[-1] != "a" else "b"
    with pytest.raises(ManifestValidationTokenError, match="MANIFEST_TOKEN_INVALID"):
        verify_manifest_validation_token(
            token[:-1] + replacement,
            "test-secret-with-enough-entropy",
        )


def test_manifest_graph_producer_is_deterministic_and_reuses_existing_tags() -> None:
    knowledge_space_id = uuid4()
    resource_id = uuid4()
    existing_tag_id = uuid4()
    manifest = KnowledgeGraphManifest.model_validate(
        {
            "schemaVersion": 1,
            "key": "coffee-guide",
            "documents": [
                {
                    "key": "coffee-basics",
                    "path": "coffee.md",
                    "summary": "Basics",
                    "tags": ["foundations"],
                }
            ],
            "tags": [{"key": "foundations", "name": "Foundations"}],
            "relations": [],
            "issues": [],
            "graph": {"status": "healthy"},
        }
    )
    candidate = match_manifest_documents(manifest, {"coffee.md": (resource_id,)})
    first = produce_manifest_graph(
        knowledge_space_id,
        manifest,
        candidate,
        {"foundations": existing_tag_id},
        {"foundations": "foundations"},
    )
    second = produce_manifest_graph(
        knowledge_space_id,
        manifest,
        candidate,
        {"foundations": existing_tag_id},
        {"foundations": "foundations"},
    )
    assert first == second
    assert first.tags[0].id == existing_tag_id
    assert first.resource_tags[0].tag_id == existing_tag_id


@pytest.mark.asyncio
async def test_validate_manifest_matches_canonical_paths_without_mutation(monkeypatch) -> None:
    workspace_id = uuid4()
    knowledge_space_id = uuid4()
    root_id = uuid4()
    child_id = uuid4()
    resource_id = uuid4()
    now = datetime(2026, 10, 17, 1, 0, tzinfo=UTC)
    tree = KnowledgeFileTree(
        knowledge_space_id=knowledge_space_id,
        root_folder_id=root_id,
        revision=7,
        folders=[
            KnowledgeFolderSummary(
                id=root_id,
                knowledge_space_id=knowledge_space_id,
                parent_folder_id=None,
                name="Coffee Guide",
                sort_order=0,
                created_at=now,
                updated_at=now,
            ),
            KnowledgeFolderSummary(
                id=child_id,
                knowledge_space_id=knowledge_space_id,
                parent_folder_id=root_id,
                name="foundations",
                sort_order=0,
                created_at=now,
                updated_at=now,
            ),
        ],
        resources=[
            KnowledgeResourceSummary(
                id=resource_id,
                knowledge_space_id=knowledge_space_id,
                folder_id=child_id,
                name="coffee-basics.md",
                status="indexed",
                mime_type="text/markdown",
                size_bytes=20,
                created_at=now,
                updated_at=now,
            )
        ],
    )
    calls = 0

    async def load_tree(*_args: object) -> KnowledgeFileTree:
        nonlocal calls
        calls += 1
        return tree

    monkeypatch.setattr(
        "odyssey_api.knowledge.service.repository.get_knowledge_file_tree",
        load_tree,
    )
    payload = _manifest_payload()
    payload["documents"] = [
        {
            "key": "coffee-basics",
            "path": "foundations/coffee-basics.md",
            "summary": "Basics",
        }
    ]
    payload["tags"] = []
    payload["relations"] = []
    request = ValidateKnowledgeGraphManifestRequest.model_validate(
        {"expectedRevision": 7, "manifest": payload}
    )
    result = await validate_knowledge_graph_manifest(
        object(), workspace_id, knowledge_space_id, request, now_factory=lambda: now
    )
    assert calls == 1
    assert result.status == "valid"
    assert result.matched_document_count == 1
    assert result.summary_update_count == 1
    assert result.validation_token is not None
    encoded_payload = result.validation_token.split(".", maxsplit=1)[0]
    token_payload = json.loads(
        base64.urlsafe_b64decode(encoded_payload + "=" * (-len(encoded_payload) % 4))
    )
    assert token_payload["workspaceId"] == str(workspace_id)
    assert token_payload["knowledgeSpaceId"] == str(knowledge_space_id)
    assert token_payload["expectedRevision"] == 7
    assert "manifest" not in token_payload


@pytest.mark.asyncio
async def test_validate_manifest_reports_missing_document_and_revision_conflict(
    monkeypatch,
) -> None:
    workspace_id = uuid4()
    knowledge_space_id = uuid4()
    root_id = uuid4()
    tree = KnowledgeFileTree(
        knowledge_space_id=knowledge_space_id,
        root_folder_id=root_id,
        revision=8,
        folders=[],
        resources=[],
    )

    async def load_tree(*_args: object) -> KnowledgeFileTree:
        return tree

    monkeypatch.setattr(
        "odyssey_api.knowledge.service.repository.get_knowledge_file_tree",
        load_tree,
    )
    stale_request = ValidateKnowledgeGraphManifestRequest.model_validate(
        {"expectedRevision": 7, "manifest": _manifest_payload()}
    )
    with pytest.raises(ApplicationError) as error:
        await validate_knowledge_graph_manifest(
            object(), workspace_id, knowledge_space_id, stale_request
        )
    assert error.value.code is ErrorCode.REVISION_CONFLICT

    current_request = ValidateKnowledgeGraphManifestRequest.model_validate(
        {"expectedRevision": 8, "manifest": _manifest_payload()}
    )
    result = await validate_knowledge_graph_manifest(
        object(), workspace_id, knowledge_space_id, current_request
    )
    assert result.status == "invalid"
    assert result.validation_token is None
    assert result.unmatched_document_count == 2
    assert {issue.code for issue in result.issues} == {"DOCUMENT_FILE_NOT_FOUND"}
