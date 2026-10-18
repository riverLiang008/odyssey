from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, func, select

from odyssey_api.db.models import (
    KnowledgeFolder,
    KnowledgeGraphManifestImport,
    KnowledgeRelation,
    KnowledgeResource,
    KnowledgeResourceTag,
    KnowledgeSpace,
    KnowledgeSpaceCategory,
    Workspace,
)
from odyssey_api.db.session import async_session_factory
from odyssey_api.errors import ApplicationError, ErrorCode
from odyssey_api.knowledge import repository
from odyssey_api.knowledge.manifest import (
    ApplyKnowledgeGraphManifestRequest,
    ValidateKnowledgeGraphManifestRequest,
)
from odyssey_api.knowledge.service import (
    apply_knowledge_graph_manifest,
    validate_knowledge_graph_manifest,
)


def _manifest(summary: str = "Manifest summary") -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "key": "coffee-guide",
        "documents": [
            {
                "key": "coffee-basics",
                "path": "coffee-basics.md",
                "summary": summary,
                "guide": "Start here",
                "tags": ["foundations"],
            },
            {
                "key": "espresso",
                "path": "espresso.md",
                "summary": "User-owned summary must survive",
                "tags": ["brewing"],
            },
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
                "confidence": 0.9,
            }
        ],
        "issues": [],
        "graph": {"status": "healthy"},
    }


async def _seed_manifest_space() -> tuple[UUID, UUID, UUID, UUID, UUID]:
    workspace_id = uuid4()
    category_id = uuid4()
    knowledge_space_id = uuid4()
    root_id = uuid4()
    basics_id = uuid4()
    espresso_id = uuid4()
    async with async_session_factory() as session, session.begin():
        session.add(Workspace(id=workspace_id, name="Manifest Test", description=None))
        await session.flush()
        session.add(
            KnowledgeSpaceCategory(
                id=category_id,
                workspace_id=workspace_id,
                name="Default",
                normalized_name="default",
                color_token=None,
                sort_order=0,
                is_default=True,
            )
        )
        await session.flush()
        session.add(
            KnowledgeSpace(
                id=knowledge_space_id,
                workspace_id=workspace_id,
                knowledge_space_category_id=category_id,
                name="Coffee Guide",
                normalized_name="coffee guide",
                description=None,
                lifecycle_status="ready",
                graph_status="not_indexed",
                revision=1,
            )
        )
        await session.flush()
        session.add(
            KnowledgeFolder(
                id=root_id,
                knowledge_space_id=knowledge_space_id,
                parent_folder_id=None,
                name="Coffee Guide",
                normalized_name="coffee guide",
                sort_order=0,
            )
        )
        session.add_all(
            [
                KnowledgeResource(
                    id=basics_id,
                    knowledge_space_id=knowledge_space_id,
                    folder_id=root_id,
                    name="coffee-basics.md",
                    status="indexed",
                    summary=None,
                    guide=None,
                    mime_type="text/markdown",
                    size_bytes=10,
                    checksum=b"a" * 32,
                    metadata_={},
                ),
                KnowledgeResource(
                    id=espresso_id,
                    knowledge_space_id=knowledge_space_id,
                    folder_id=root_id,
                    name="espresso.md",
                    status="indexed",
                    summary="Manual summary",
                    summary_source="user",
                    guide=None,
                    mime_type="text/markdown",
                    size_bytes=10,
                    checksum=b"b" * 32,
                    metadata_={},
                ),
            ]
        )
        await session.flush()
        session.add(
            KnowledgeRelation(
                id=uuid4(),
                knowledge_space_id=knowledge_space_id,
                source_resource_id=espresso_id,
                target_resource_id=basics_id,
                relation_kind="related_to",
                status="active",
                confidence=None,
                source="user",
                confirmed_by_user=True,
                description="Manual relation",
                metadata_={},
            )
        )
    return workspace_id, category_id, knowledge_space_id, basics_id, espresso_id


async def _validate(
    workspace_id: UUID,
    knowledge_space_id: UUID,
    revision: int,
    manifest: dict[str, object],
):
    request = ValidateKnowledgeGraphManifestRequest.model_validate(
        {"expectedRevision": revision, "manifest": manifest}
    )
    async with async_session_factory() as session:
        return await validate_knowledge_graph_manifest(
            session,
            workspace_id,
            knowledge_space_id,
            request,
            now_factory=lambda: datetime(2026, 10, 18, 1, tzinfo=UTC),
        )


@pytest.mark.integration
async def test_manifest_apply_is_atomic_idempotent_and_preserves_user_annotations(
    monkeypatch,
) -> None:
    workspace_id, category_id, space_id, basics_id, espresso_id = await _seed_manifest_space()
    try:
        manifest = _manifest()
        validated = await _validate(workspace_id, space_id, 1, manifest)
        assert validated.validation_token is not None
        request = ApplyKnowledgeGraphManifestRequest.model_validate(
            {
                "expectedRevision": 1,
                "validationToken": validated.validation_token,
                "manifestChecksum": validated.manifest_checksum,
                "manifest": manifest,
            }
        )
        async with async_session_factory() as session:
            applied = await apply_knowledge_graph_manifest(
                session,
                workspace_id,
                space_id,
                request,
                now_factory=lambda: datetime(2026, 10, 18, 1, 1, tzinfo=UTC),
            )
        assert applied.status == "applied"
        assert applied.knowledge_space_revision == 2

        with pytest.raises(ApplicationError) as stale_error:
            async with async_session_factory() as session:
                await apply_knowledge_graph_manifest(
                    session,
                    workspace_id,
                    space_id,
                    request,
                    now_factory=lambda: datetime(2026, 10, 18, 1, 2, tzinfo=UTC),
                )
        assert stale_error.value.code is ErrorCode.REVISION_CONFLICT

        async with async_session_factory() as session:
            space = await session.get(KnowledgeSpace, space_id)
            basics = await session.get(KnowledgeResource, basics_id)
            espresso = await session.get(KnowledgeResource, espresso_id)
            assert space is not None and space.revision == 2 and space.graph_status == "healthy"
            assert basics is not None
            assert basics.summary == "Manifest summary"
            assert basics.summary_source == "manifest"
            assert basics.guide == "Start here"
            assert espresso is not None
            assert espresso.summary == "Manual summary"
            assert espresso.summary_source == "user"
            assert (
                await session.scalar(
                    select(func.count())
                    .select_from(KnowledgeRelation)
                    .where(KnowledgeRelation.knowledge_space_id == space_id)
                )
                == 2
            )
            assert (
                await session.scalar(
                    select(func.count())
                    .select_from(KnowledgeRelation)
                    .where(
                        KnowledgeRelation.knowledge_space_id == space_id,
                        KnowledgeRelation.source == "manifest",
                    )
                )
                == 1
            )
            assert (
                await session.scalar(
                    select(func.count())
                    .select_from(KnowledgeResourceTag)
                    .join(
                        KnowledgeResource,
                        KnowledgeResource.id == KnowledgeResourceTag.knowledge_resource_id,
                    )
                    .where(
                        KnowledgeResource.knowledge_space_id == space_id,
                        KnowledgeResourceTag.source == "manifest",
                    )
                )
                == 2
            )
            graph = await repository.get_knowledge_graph_overview(session, workspace_id, space_id)
            assert graph is not None
            assert len(graph.nodes) == 2
            assert len(graph.edges) == 2
            assert len(graph.families) == 2

        validated_again = await _validate(workspace_id, space_id, 2, manifest)
        assert validated_again.validation_token is not None
        retry = ApplyKnowledgeGraphManifestRequest.model_validate(
            {
                "expectedRevision": 2,
                "validationToken": validated_again.validation_token,
                "manifestChecksum": validated_again.manifest_checksum,
                "manifest": manifest,
            }
        )
        tampered = retry.model_copy(update={"validation_token": retry.validation_token[:-1] + "x"})
        with pytest.raises(ApplicationError) as tampered_error:
            async with async_session_factory() as session:
                await apply_knowledge_graph_manifest(session, workspace_id, space_id, tampered)
        assert tampered_error.value.code is ErrorCode.VALIDATION_FAILED

        wrong_checksum = retry.model_copy(update={"manifest_checksum": "b" * 64})
        with pytest.raises(ApplicationError) as checksum_error:
            async with async_session_factory() as session:
                await apply_knowledge_graph_manifest(
                    session, workspace_id, space_id, wrong_checksum
                )
        assert checksum_error.value.code is ErrorCode.VALIDATION_FAILED

        with pytest.raises(ApplicationError) as workspace_error:
            async with async_session_factory() as session:
                await apply_knowledge_graph_manifest(session, uuid4(), space_id, retry)
        assert workspace_error.value.code is ErrorCode.NOT_FOUND

        with pytest.raises(ApplicationError) as expiry_error:
            async with async_session_factory() as session:
                await apply_knowledge_graph_manifest(
                    session,
                    workspace_id,
                    space_id,
                    retry,
                    now_factory=lambda: datetime(2026, 10, 18, 2, tzinfo=UTC),
                )
        assert expiry_error.value.code is ErrorCode.VALIDATION_FAILED
        assert expiry_error.value.details["issues"][0]["code"] == "MANIFEST_TOKEN_EXPIRED"

        async with async_session_factory() as session:
            unchanged = await apply_knowledge_graph_manifest(session, workspace_id, space_id, retry)
        assert unchanged.status == "already_up_to_date"
        assert unchanged.knowledge_space_revision == 2

        changed_manifest = _manifest("Changed summary")
        changed_validation = await _validate(workspace_id, space_id, 2, changed_manifest)
        assert changed_validation.validation_token is not None
        changed_request = ApplyKnowledgeGraphManifestRequest.model_validate(
            {
                "expectedRevision": 2,
                "validationToken": changed_validation.validation_token,
                "manifestChecksum": changed_validation.manifest_checksum,
                "manifest": changed_manifest,
            }
        )
        original_replace = repository.replace_manifest_graph_projection

        async def fail_after_projection(*args, **kwargs) -> None:
            await original_replace(*args, **kwargs)
            raise RuntimeError("injected failure")

        monkeypatch.setattr(
            repository,
            "replace_manifest_graph_projection",
            fail_after_projection,
        )
        with pytest.raises(RuntimeError, match="injected failure"):
            async with async_session_factory() as session:
                await apply_knowledge_graph_manifest(
                    session,
                    workspace_id,
                    space_id,
                    changed_request,
                )
        async with async_session_factory() as session:
            space = await session.get(KnowledgeSpace, space_id)
            basics = await session.get(KnowledgeResource, basics_id)
            imported = await session.scalar(
                select(KnowledgeGraphManifestImport).where(
                    KnowledgeGraphManifestImport.knowledge_space_id == space_id
                )
            )
            assert space is not None and space.revision == 2
            assert basics is not None and basics.summary == "Manifest summary"
            assert imported is not None
            assert imported.manifest_checksum.hex() == validated.manifest_checksum
    finally:
        async with async_session_factory() as session, session.begin():
            await session.execute(delete(KnowledgeSpace).where(KnowledgeSpace.id == space_id))
            await session.execute(
                delete(KnowledgeSpaceCategory).where(KnowledgeSpaceCategory.id == category_id)
            )
            await session.execute(delete(Workspace).where(Workspace.id == workspace_id))
