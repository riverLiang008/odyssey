from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from odyssey_api.db.models import (
    AgentTemplateKnowledgeSpaceReference,
    GraphIssue,
    GraphIssueRelation,
    GraphIssueResource,
    KnowledgeFolder,
    KnowledgeGraphManifestImport,
    KnowledgeRelation,
    KnowledgeResource,
    KnowledgeResourceArtifact,
    KnowledgeResourceTag,
    KnowledgeSpace,
    KnowledgeSpaceCategory,
    KnowledgeTag,
    ToolTemplateKnowledgeSpaceReference,
    WorkflowKnowledgeSpaceReference,
)
from odyssey_api.knowledge.dto import (
    KnowledgeFileTree,
    KnowledgeFolderSummary,
    KnowledgeGraphEdge,
    KnowledgeGraphFamily,
    KnowledgeGraphIssue,
    KnowledgeGraphNode,
    KnowledgeGraphOverview,
    KnowledgeGraphTag,
    KnowledgeResourceSummary,
    KnowledgeSpaceCategorySummary,
    KnowledgeSpaceDetail,
    KnowledgeSpaceSummary,
)
from odyssey_api.knowledge.manifest import ManifestGraphProjection


@dataclass(frozen=True, slots=True)
class UploadCandidate:
    resource_id: UUID
    artifact_id: UUID
    status: str
    object_key: str
    declared_content_type: str
    declared_size_bytes: int
    upload_expires_at: datetime


@dataclass(frozen=True, slots=True)
class KnowledgeResourceAccessRecord:
    summary: KnowledgeResourceSummary
    description: str | None
    guide: str | None
    checksum: bytes | None
    last_indexed_at: datetime | None
    artifact_id: UUID
    object_key: str


@dataclass(frozen=True, slots=True)
class KnowledgeResourceDeleteRecord:
    resource_id: UUID
    object_keys: tuple[str, ...]


async def get_manifest_import_checksum(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
) -> bytes | None:
    return await session.scalar(
        select(KnowledgeGraphManifestImport.manifest_checksum)
        .join(KnowledgeSpace, KnowledgeSpace.id == KnowledgeGraphManifestImport.knowledge_space_id)
        .where(
            KnowledgeGraphManifestImport.knowledge_space_id == knowledge_space_id,
            KnowledgeSpace.workspace_id == workspace_id,
        )
    )


async def get_knowledge_tag_ids_by_normalized_name(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    normalized_names: set[str],
) -> dict[str, UUID]:
    if not normalized_names:
        return {}
    rows = (
        await session.execute(
            select(KnowledgeTag.normalized_name, KnowledgeTag.id)
            .join(KnowledgeSpace, KnowledgeSpace.id == KnowledgeTag.knowledge_space_id)
            .where(
                KnowledgeTag.knowledge_space_id == knowledge_space_id,
                KnowledgeSpace.workspace_id == workspace_id,
                KnowledgeTag.normalized_name.in_(normalized_names),
            )
        )
    ).all()
    return {name: tag_id for name, tag_id in rows}


async def cas_begin_manifest_apply(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    expected_revision: int,
    graph_status: str,
    applied_at: datetime,
) -> int | None:
    return await session.scalar(
        update(KnowledgeSpace)
        .where(
            KnowledgeSpace.id == knowledge_space_id,
            KnowledgeSpace.workspace_id == workspace_id,
            KnowledgeSpace.revision == expected_revision,
        )
        .values(
            revision=KnowledgeSpace.revision + 1,
            graph_status=graph_status,
            last_document_indexed_at=applied_at,
            updated_at=func.now(),
        )
        .returning(KnowledgeSpace.revision)
    )


async def replace_manifest_graph_projection(
    session: AsyncSession,
    *,
    knowledge_space_id: UUID,
    projection: ManifestGraphProjection,
    manifest_checksum: bytes,
    new_revision: int,
    applied_at: datetime,
    import_id: UUID,
) -> None:
    await session.execute(
        update(KnowledgeResource)
        .where(
            KnowledgeResource.knowledge_space_id == knowledge_space_id,
            KnowledgeResource.summary_source == "manifest",
        )
        .values(summary=None, summary_source=None, summary_source_key=None)
    )
    await session.execute(
        update(KnowledgeResource)
        .where(
            KnowledgeResource.knowledge_space_id == knowledge_space_id,
            KnowledgeResource.guide_source == "manifest",
        )
        .values(guide=None, guide_source=None, guide_source_key=None)
    )
    for document in projection.documents:
        await session.execute(
            update(KnowledgeResource)
            .where(
                KnowledgeResource.id == document.resource_id,
                KnowledgeResource.knowledge_space_id == knowledge_space_id,
            )
            .values(status=document.status, last_indexed_at=applied_at)
        )
        if document.summary is not None:
            await session.execute(
                update(KnowledgeResource)
                .where(
                    KnowledgeResource.id == document.resource_id,
                    KnowledgeResource.knowledge_space_id == knowledge_space_id,
                    KnowledgeResource.summary_source.is_(None),
                )
                .values(
                    summary=document.summary,
                    summary_source="manifest",
                    summary_source_key=document.source_key,
                )
            )
        if document.guide is not None:
            await session.execute(
                update(KnowledgeResource)
                .where(
                    KnowledgeResource.id == document.resource_id,
                    KnowledgeResource.knowledge_space_id == knowledge_space_id,
                    KnowledgeResource.guide_source.is_(None),
                )
                .values(
                    guide=document.guide,
                    guide_source="manifest",
                    guide_source_key=document.source_key,
                )
            )

    await session.execute(
        delete(KnowledgeResourceTag).where(
            KnowledgeResourceTag.source == "manifest",
            KnowledgeResourceTag.knowledge_resource_id.in_(
                select(KnowledgeResource.id).where(
                    KnowledgeResource.knowledge_space_id == knowledge_space_id
                )
            ),
        )
    )
    await session.execute(
        delete(GraphIssue).where(
            GraphIssue.knowledge_space_id == knowledge_space_id,
            GraphIssue.source == "manifest",
        )
    )
    await session.execute(
        delete(KnowledgeRelation).where(
            KnowledgeRelation.knowledge_space_id == knowledge_space_id,
            KnowledgeRelation.source == "manifest",
        )
    )

    if projection.tags:
        tag_insert = insert(KnowledgeTag).values(
            [
                {
                    "id": tag.id,
                    "knowledge_space_id": knowledge_space_id,
                    "name": tag.name,
                    "normalized_name": tag.normalized_name,
                    "color_token": tag.color_token,
                    "source": "manifest",
                    "source_key": tag.source_key,
                }
                for tag in projection.tags
            ]
        )
        await session.execute(
            tag_insert.on_conflict_do_update(
                index_elements=[
                    KnowledgeTag.knowledge_space_id,
                    KnowledgeTag.normalized_name,
                ],
                set_={
                    "name": tag_insert.excluded.name,
                    "color_token": tag_insert.excluded.color_token,
                    "source_key": tag_insert.excluded.source_key,
                    "updated_at": func.now(),
                },
                where=KnowledgeTag.source == "manifest",
            )
        )
    if projection.resource_tags:
        await session.execute(
            insert(KnowledgeResourceTag)
            .values(
                [
                    {
                        "knowledge_resource_id": item.resource_id,
                        "knowledge_tag_id": item.tag_id,
                        "source": "manifest",
                        "source_key": item.source_key,
                    }
                    for item in projection.resource_tags
                ]
            )
            .on_conflict_do_nothing()
        )
    await session.execute(
        delete(KnowledgeTag).where(
            KnowledgeTag.knowledge_space_id == knowledge_space_id,
            KnowledgeTag.source == "manifest",
            ~select(KnowledgeResourceTag.knowledge_tag_id)
            .where(KnowledgeResourceTag.knowledge_tag_id == KnowledgeTag.id)
            .exists(),
        )
    )
    if projection.relations:
        await session.execute(
            insert(KnowledgeRelation).values(
                [
                    {
                        "id": relation.id,
                        "knowledge_space_id": knowledge_space_id,
                        "source_resource_id": relation.source_resource_id,
                        "target_resource_id": relation.target_resource_id,
                        "relation_kind": relation.kind,
                        "status": relation.status,
                        "confidence": relation.confidence,
                        "source": "manifest",
                        "source_key": relation.source_key,
                        "confirmed_by_user": False,
                        "description": relation.description,
                        "metadata_": {},
                    }
                    for relation in projection.relations
                ]
            )
        )
    if projection.issues:
        await session.execute(
            insert(GraphIssue).values(
                [
                    {
                        "id": issue.id,
                        "knowledge_space_id": knowledge_space_id,
                        "issue_kind": issue.kind,
                        "severity": issue.severity,
                        "resolution_status": issue.resolution_status,
                        "source": "manifest",
                        "source_key": issue.source_key,
                        "scope": (
                            "affected_objects"
                            if issue.resource_ids or issue.relation_ids
                            else "knowledge_space"
                        ),
                        "title": issue.title,
                        "message": issue.message,
                        "metadata_": {},
                        "resolved_at": (None if issue.resolution_status == "open" else applied_at),
                    }
                    for issue in projection.issues
                ]
            )
        )
        resource_links = [
            {"graph_issue_id": issue.id, "knowledge_resource_id": resource_id}
            for issue in projection.issues
            for resource_id in issue.resource_ids
        ]
        relation_links = [
            {"graph_issue_id": issue.id, "knowledge_relation_id": relation_id}
            for issue in projection.issues
            for relation_id in issue.relation_ids
        ]
        if resource_links:
            await session.execute(insert(GraphIssueResource).values(resource_links))
        if relation_links:
            await session.execute(insert(GraphIssueRelation).values(relation_links))

    await session.execute(
        insert(KnowledgeGraphManifestImport)
        .values(
            id=import_id,
            knowledge_space_id=knowledge_space_id,
            manifest_key=projection.manifest_key,
            manifest_checksum=manifest_checksum,
            applied_revision=new_revision,
            applied_at=applied_at,
        )
        .on_conflict_do_update(
            index_elements=[KnowledgeGraphManifestImport.knowledge_space_id],
            set_={
                "manifest_key": projection.manifest_key,
                "manifest_checksum": manifest_checksum,
                "applied_revision": new_revision,
                "applied_at": applied_at,
            },
        )
    )


def _resource_summary(resource: KnowledgeResource) -> KnowledgeResourceSummary:
    if resource.folder_id is None:
        raise RuntimeError("Uploaded Knowledge Resource must belong to a folder")
    return KnowledgeResourceSummary(
        id=resource.id,
        knowledge_space_id=resource.knowledge_space_id,
        folder_id=resource.folder_id,
        name=resource.name,
        status=resource.status,
        mime_type=resource.mime_type,
        size_bytes=resource.size_bytes,
        created_at=resource.created_at,
        updated_at=resource.updated_at,
    )


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _category_summary(category: KnowledgeSpaceCategory) -> KnowledgeSpaceCategorySummary:
    return KnowledgeSpaceCategorySummary(
        id=category.id,
        name=category.name,
        color_token=category.color_token,
        sort_order=category.sort_order,
        is_default=category.is_default,
    )


def _summary_counts() -> tuple[ColumnElement[int], ColumnElement[int], ColumnElement[int]]:
    file_count = (
        select(func.count(KnowledgeResource.id))
        .where(
            KnowledgeResource.knowledge_space_id == KnowledgeSpace.id,
            KnowledgeResource.status != "pending",
        )
        .correlate(KnowledgeSpace)
        .scalar_subquery()
    )
    family_count = (
        select(func.count(func.distinct(KnowledgeResourceTag.knowledge_tag_id)))
        .join(
            KnowledgeResource,
            KnowledgeResource.id == KnowledgeResourceTag.knowledge_resource_id,
        )
        .where(KnowledgeResource.knowledge_space_id == KnowledgeSpace.id)
        .correlate(KnowledgeSpace)
        .scalar_subquery()
    )
    issue_count = (
        select(func.count(GraphIssue.id))
        .where(
            GraphIssue.knowledge_space_id == KnowledgeSpace.id,
            GraphIssue.resolution_status == "open",
        )
        .correlate(KnowledgeSpace)
        .scalar_subquery()
    )
    return file_count, family_count, issue_count


def _to_summary(
    space: KnowledgeSpace,
    category: KnowledgeSpaceCategory,
    file_count: int,
    family_count: int,
    issue_count: int,
) -> KnowledgeSpaceSummary:
    return KnowledgeSpaceSummary(
        id=space.id,
        name=space.name,
        description=space.description,
        category=_category_summary(category),
        lifecycle_status=space.lifecycle_status,
        graph_status=space.graph_status,
        file_count=file_count,
        knowledge_family_count=family_count,
        open_issue_count=issue_count,
        created_at=space.created_at,
        updated_at=space.updated_at,
    )


async def list_knowledge_space_categories(
    session: AsyncSession, workspace_id: UUID
) -> list[KnowledgeSpaceCategorySummary]:
    categories = (
        await session.scalars(
            select(KnowledgeSpaceCategory)
            .where(KnowledgeSpaceCategory.workspace_id == workspace_id)
            .order_by(KnowledgeSpaceCategory.sort_order, KnowledgeSpaceCategory.id)
        )
    ).all()
    return [_category_summary(category) for category in categories]


async def category_is_visible(session: AsyncSession, workspace_id: UUID, category_id: UUID) -> bool:
    return (
        await session.scalar(
            select(KnowledgeSpaceCategory.id).where(
                KnowledgeSpaceCategory.id == category_id,
                KnowledgeSpaceCategory.workspace_id == workspace_id,
            )
        )
    ) is not None


async def knowledge_space_name_is_available(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    normalized_name: str,
) -> bool:
    existing = await session.scalar(
        select(KnowledgeSpace.id).where(
            KnowledgeSpace.workspace_id == workspace_id,
            KnowledgeSpace.normalized_name == normalized_name,
            KnowledgeSpace.id != knowledge_space_id,
        )
    )
    return existing is None


async def insert_knowledge_space_category(
    session: AsyncSession,
    *,
    category_id: UUID,
    workspace_id: UUID,
    name: str,
    normalized_name: str,
    color_token: str | None,
) -> bool:
    inserted_id = await session.scalar(
        insert(KnowledgeSpaceCategory)
        .values(
            id=category_id,
            workspace_id=workspace_id,
            name=name,
            normalized_name=normalized_name,
            color_token=color_token,
            sort_order=0,
            is_default=False,
        )
        .on_conflict_do_nothing(
            index_elements=[
                KnowledgeSpaceCategory.workspace_id,
                KnowledgeSpaceCategory.normalized_name,
            ]
        )
        .returning(KnowledgeSpaceCategory.id)
    )
    return inserted_id is not None


async def get_knowledge_space_category(
    session: AsyncSession, workspace_id: UUID, category_id: UUID
) -> KnowledgeSpaceCategorySummary | None:
    category = await session.scalar(
        select(KnowledgeSpaceCategory).where(
            KnowledgeSpaceCategory.id == category_id,
            KnowledgeSpaceCategory.workspace_id == workspace_id,
        )
    )
    return None if category is None else _category_summary(category)


async def list_knowledge_space_summaries(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    query: str,
    page: int,
    page_size: int,
    include_archived: bool = False,
) -> tuple[list[KnowledgeSpaceSummary], int]:
    filters = [KnowledgeSpace.workspace_id == workspace_id]
    if not include_archived:
        filters.append(KnowledgeSpace.lifecycle_status != "archived")
    if query:
        pattern = f"%{_escape_like(query)}%"
        filters.append(
            or_(
                KnowledgeSpace.name.ilike(pattern, escape="\\"),
                KnowledgeSpace.description.ilike(pattern, escape="\\"),
            )
        )
    total = await session.scalar(select(func.count()).select_from(KnowledgeSpace).where(*filters))
    file_count, family_count, issue_count = _summary_counts()
    rows = (
        await session.execute(
            select(
                KnowledgeSpace,
                KnowledgeSpaceCategory,
                file_count,
                family_count,
                issue_count,
            )
            .join(
                KnowledgeSpaceCategory,
                KnowledgeSpaceCategory.id == KnowledgeSpace.knowledge_space_category_id,
            )
            .where(*filters)
            .order_by(KnowledgeSpace.updated_at.desc(), KnowledgeSpace.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return (
        [
            _to_summary(space, category, files, families, issues)
            for space, category, files, families, issues in rows
        ],
        total or 0,
    )


async def insert_knowledge_space_with_root(
    session: AsyncSession,
    *,
    knowledge_space_id: UUID,
    root_folder_id: UUID,
    workspace_id: UUID,
    category_id: UUID,
    name: str,
    normalized_name: str,
    description: str | None,
) -> bool:
    inserted_id = await session.scalar(
        insert(KnowledgeSpace)
        .values(
            id=knowledge_space_id,
            workspace_id=workspace_id,
            knowledge_space_category_id=category_id,
            name=name,
            normalized_name=normalized_name,
            description=description,
            lifecycle_status="ready",
            graph_status="not_indexed",
            revision=1,
        )
        .on_conflict_do_nothing(
            index_elements=[KnowledgeSpace.workspace_id, KnowledgeSpace.normalized_name]
        )
        .returning(KnowledgeSpace.id)
    )
    if inserted_id is None:
        return False
    session.add(
        KnowledgeFolder(
            id=root_folder_id,
            knowledge_space_id=knowledge_space_id,
            parent_folder_id=None,
            name=name,
            normalized_name=normalized_name,
            sort_order=0,
        )
    )
    await session.flush()
    return True


async def get_knowledge_space_detail(
    session: AsyncSession, workspace_id: UUID, knowledge_space_id: UUID
) -> KnowledgeSpaceDetail | None:
    file_count, family_count, issue_count = _summary_counts()
    row = (
        await session.execute(
            select(
                KnowledgeSpace,
                KnowledgeSpaceCategory,
                KnowledgeFolder.id,
                file_count,
                family_count,
                issue_count,
            )
            .join(
                KnowledgeSpaceCategory,
                KnowledgeSpaceCategory.id == KnowledgeSpace.knowledge_space_category_id,
            )
            .join(
                KnowledgeFolder,
                (KnowledgeFolder.knowledge_space_id == KnowledgeSpace.id)
                & (KnowledgeFolder.parent_folder_id.is_(None)),
            )
            .where(
                KnowledgeSpace.id == knowledge_space_id,
                KnowledgeSpace.workspace_id == workspace_id,
            )
            .order_by(KnowledgeFolder.id)
            .limit(1)
        )
    ).one_or_none()
    if row is None:
        return None
    space, category, root_folder_id, files, families, issues = row
    summary = _to_summary(space, category, files, families, issues)
    return KnowledgeSpaceDetail(
        **summary.model_dump(),
        root_folder_id=root_folder_id,
        revision=space.revision,
        last_document_indexed_at=space.last_document_indexed_at,
        last_steward_run_at=space.last_steward_run_at,
    )


async def get_visible_knowledge_space_ids(
    session: AsyncSession, workspace_id: UUID, knowledge_space_ids: set[UUID]
) -> set[UUID]:
    if not knowledge_space_ids:
        return set()
    return set(
        (
            await session.scalars(
                select(KnowledgeSpace.id).where(
                    KnowledgeSpace.workspace_id == workspace_id,
                    KnowledgeSpace.id.in_(knowledge_space_ids),
                )
            )
        ).all()
    )


async def get_referenceable_knowledge_space_ids(
    session: AsyncSession, workspace_id: UUID, knowledge_space_ids: set[UUID]
) -> set[UUID]:
    if not knowledge_space_ids:
        return set()
    return set(
        (
            await session.scalars(
                select(KnowledgeSpace.id).where(
                    KnowledgeSpace.workspace_id == workspace_id,
                    KnowledgeSpace.id.in_(knowledge_space_ids),
                    KnowledgeSpace.lifecycle_status.in_(("ready", "syncing")),
                    KnowledgeSpace.graph_status.in_(("healthy", "needs_review")),
                )
            )
        ).all()
    )


async def cas_update_knowledge_space(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    expected_revision: int,
    name: str,
    normalized_name: str,
    description: str | None,
    category_id: UUID,
) -> bool:
    row = (
        await session.execute(
            update(KnowledgeSpace)
            .where(
                KnowledgeSpace.id == knowledge_space_id,
                KnowledgeSpace.workspace_id == workspace_id,
                KnowledgeSpace.revision == expected_revision,
            )
            .values(
                name=name,
                normalized_name=normalized_name,
                description=description,
                knowledge_space_category_id=category_id,
                revision=KnowledgeSpace.revision + 1,
                updated_at=func.now(),
            )
            .returning(KnowledgeSpace.id)
        )
    ).scalar_one_or_none()
    return row is not None


async def cas_set_knowledge_space_lifecycle(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    expected_revision: int,
    lifecycle_status: str,
) -> bool:
    row = (
        await session.execute(
            update(KnowledgeSpace)
            .where(
                KnowledgeSpace.id == knowledge_space_id,
                KnowledgeSpace.workspace_id == workspace_id,
                KnowledgeSpace.revision == expected_revision,
            )
            .values(
                lifecycle_status=lifecycle_status,
                revision=KnowledgeSpace.revision + 1,
                updated_at=func.now(),
            )
            .returning(KnowledgeSpace.id)
        )
    ).scalar_one_or_none()
    return row is not None


async def get_knowledge_space_revision(
    session: AsyncSession, workspace_id: UUID, knowledge_space_id: UUID
) -> int | None:
    return await session.scalar(
        select(KnowledgeSpace.revision).where(
            KnowledgeSpace.id == knowledge_space_id,
            KnowledgeSpace.workspace_id == workspace_id,
        )
    )


async def get_knowledge_file_tree(
    session: AsyncSession, workspace_id: UUID, knowledge_space_id: UUID
) -> KnowledgeFileTree | None:
    space = (
        await session.execute(
            select(KnowledgeSpace.id, KnowledgeSpace.revision, KnowledgeFolder.id)
            .join(
                KnowledgeFolder,
                (KnowledgeFolder.knowledge_space_id == KnowledgeSpace.id)
                & (KnowledgeFolder.parent_folder_id.is_(None)),
            )
            .where(
                KnowledgeSpace.id == knowledge_space_id,
                KnowledgeSpace.workspace_id == workspace_id,
            )
            .limit(1)
        )
    ).one_or_none()
    if space is None:
        return None
    folders = (
        await session.scalars(
            select(KnowledgeFolder)
            .where(KnowledgeFolder.knowledge_space_id == knowledge_space_id)
            .order_by(
                KnowledgeFolder.parent_folder_id.nullsfirst(),
                KnowledgeFolder.sort_order,
                KnowledgeFolder.id,
            )
        )
    ).all()
    resources = (
        await session.scalars(
            select(KnowledgeResource)
            .where(
                KnowledgeResource.knowledge_space_id == knowledge_space_id,
                KnowledgeResource.status != "pending",
            )
            .order_by(KnowledgeResource.folder_id, KnowledgeResource.name, KnowledgeResource.id)
        )
    ).all()
    return KnowledgeFileTree(
        knowledge_space_id=space[0],
        root_folder_id=space[2],
        revision=space[1],
        folders=[
            KnowledgeFolderSummary(
                id=folder.id,
                knowledge_space_id=folder.knowledge_space_id,
                parent_folder_id=folder.parent_folder_id,
                name=folder.name,
                sort_order=folder.sort_order,
                created_at=folder.created_at,
                updated_at=folder.updated_at,
            )
            for folder in folders
        ],
        resources=[_resource_summary(resource) for resource in resources],
    )


async def get_knowledge_graph_overview(
    session: AsyncSession, workspace_id: UUID, knowledge_space_id: UUID
) -> KnowledgeGraphOverview | None:
    space = await session.scalar(
        select(KnowledgeSpace).where(
            KnowledgeSpace.id == knowledge_space_id,
            KnowledgeSpace.workspace_id == workspace_id,
        )
    )
    if space is None:
        return None
    if space.graph_status == "not_indexed":
        return KnowledgeGraphOverview(
            knowledge_space_id=space.id,
            status=space.graph_status,
            generated_at=None,
            nodes=[],
            edges=[],
            families=[],
            issues=[],
        )

    resources = (
        await session.scalars(
            select(KnowledgeResource)
            .where(
                KnowledgeResource.knowledge_space_id == knowledge_space_id,
                KnowledgeResource.status.in_(("indexed", "needs_review")),
            )
            .order_by(KnowledgeResource.name, KnowledgeResource.id)
        )
    ).all()
    resource_ids = [resource.id for resource in resources]

    tag_rows = (
        (
            await session.execute(
                select(KnowledgeResourceTag.knowledge_resource_id, KnowledgeTag)
                .join(KnowledgeTag, KnowledgeTag.id == KnowledgeResourceTag.knowledge_tag_id)
                .where(
                    KnowledgeTag.knowledge_space_id == knowledge_space_id,
                    KnowledgeResourceTag.knowledge_resource_id.in_(resource_ids),
                )
                .order_by(KnowledgeTag.name, KnowledgeTag.id)
            )
        ).all()
        if resource_ids
        else []
    )
    tags_by_resource: dict[UUID, list[KnowledgeGraphTag]] = {
        resource_id: [] for resource_id in resource_ids
    }
    family_members: dict[UUID, list[UUID]] = {}
    family_tags: dict[UUID, KnowledgeTag] = {}
    for resource_id, tag in tag_rows:
        tags_by_resource[resource_id].append(
            KnowledgeGraphTag(id=tag.id, name=tag.name, color_token=tag.color_token)
        )
        family_tags[tag.id] = tag
        family_members.setdefault(tag.id, []).append(resource_id)

    relations = (
        (
            await session.scalars(
                select(KnowledgeRelation)
                .where(
                    KnowledgeRelation.knowledge_space_id == knowledge_space_id,
                    KnowledgeRelation.source_resource_id.in_(resource_ids),
                    KnowledgeRelation.target_resource_id.in_(resource_ids),
                )
                .order_by(KnowledgeRelation.id)
            )
        ).all()
        if resource_ids
        else []
    )

    issues = (
        await session.scalars(
            select(GraphIssue)
            .where(GraphIssue.knowledge_space_id == knowledge_space_id)
            .order_by(GraphIssue.created_at, GraphIssue.id)
        )
    ).all()
    issue_ids = [issue.id for issue in issues]
    issue_resource_rows = (
        (
            await session.execute(
                select(GraphIssueResource.graph_issue_id, GraphIssueResource.knowledge_resource_id)
                .where(GraphIssueResource.graph_issue_id.in_(issue_ids))
                .order_by(
                    GraphIssueResource.graph_issue_id, GraphIssueResource.knowledge_resource_id
                )
            )
        ).all()
        if issue_ids
        else []
    )
    issue_relation_rows = (
        (
            await session.execute(
                select(GraphIssueRelation.graph_issue_id, GraphIssueRelation.knowledge_relation_id)
                .where(GraphIssueRelation.graph_issue_id.in_(issue_ids))
                .order_by(
                    GraphIssueRelation.graph_issue_id, GraphIssueRelation.knowledge_relation_id
                )
            )
        ).all()
        if issue_ids
        else []
    )
    resources_by_issue: dict[UUID, list[UUID]] = {issue_id: [] for issue_id in issue_ids}
    relations_by_issue: dict[UUID, list[UUID]] = {issue_id: [] for issue_id in issue_ids}
    issues_by_resource: dict[UUID, list[UUID]] = {resource_id: [] for resource_id in resource_ids}
    for issue_id, resource_id in issue_resource_rows:
        resources_by_issue[issue_id].append(resource_id)
        if resource_id in issues_by_resource:
            issues_by_resource[resource_id].append(issue_id)
    for issue_id, relation_id in issue_relation_rows:
        relations_by_issue[issue_id].append(relation_id)

    return KnowledgeGraphOverview(
        knowledge_space_id=space.id,
        status=space.graph_status,
        generated_at=space.last_document_indexed_at,
        nodes=[
            KnowledgeGraphNode(
                id=resource.id,
                name=resource.name,
                status=resource.status,
                summary=resource.summary,
                guide=resource.guide,
                tags=tags_by_resource[resource.id],
                issue_ids=issues_by_resource[resource.id],
            )
            for resource in resources
        ],
        edges=[
            KnowledgeGraphEdge(
                id=relation.id,
                source_resource_id=relation.source_resource_id,
                target_resource_id=relation.target_resource_id,
                kind=relation.relation_kind,
                status=relation.status,
                confidence=relation.confidence,
                description=relation.description,
            )
            for relation in relations
        ],
        families=[
            KnowledgeGraphFamily(
                id=tag_id,
                name=family_tags[tag_id].name,
                color_token=family_tags[tag_id].color_token,
                resource_ids=members,
            )
            for tag_id, members in sorted(
                family_members.items(), key=lambda item: (family_tags[item[0]].name, item[0])
            )
        ],
        issues=[
            KnowledgeGraphIssue(
                id=issue.id,
                kind=issue.issue_kind,
                severity=issue.severity,
                resolution_status=issue.resolution_status,
                title=issue.title,
                message=issue.message,
                resource_ids=resources_by_issue[issue.id],
                relation_ids=relations_by_issue[issue.id],
            )
            for issue in issues
        ],
    )


async def folder_is_visible(
    session: AsyncSession, workspace_id: UUID, knowledge_space_id: UUID, folder_id: UUID
) -> bool:
    return (
        await session.scalar(
            select(KnowledgeFolder.id)
            .join(KnowledgeSpace, KnowledgeSpace.id == KnowledgeFolder.knowledge_space_id)
            .where(
                KnowledgeFolder.id == folder_id,
                KnowledgeFolder.knowledge_space_id == knowledge_space_id,
                KnowledgeSpace.workspace_id == workspace_id,
                KnowledgeSpace.lifecycle_status != "archived",
            )
        )
    ) is not None


async def get_visible_knowledge_resource(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    resource_id: UUID,
) -> KnowledgeResourceSummary | None:
    resource = await session.scalar(
        select(KnowledgeResource)
        .join(KnowledgeSpace, KnowledgeSpace.id == KnowledgeResource.knowledge_space_id)
        .where(
            KnowledgeResource.id == resource_id,
            KnowledgeResource.knowledge_space_id == knowledge_space_id,
            KnowledgeResource.status != "pending",
            KnowledgeSpace.workspace_id == workspace_id,
            KnowledgeSpace.lifecycle_status != "archived",
        )
    )
    return None if resource is None else _resource_summary(resource)


async def get_knowledge_resource_access_record(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    resource_id: UUID,
) -> KnowledgeResourceAccessRecord | None:
    row = (
        await session.execute(
            select(
                KnowledgeResource,
                KnowledgeResourceArtifact.id,
                KnowledgeResourceArtifact.object_key,
            )
            .join(KnowledgeSpace, KnowledgeSpace.id == KnowledgeResource.knowledge_space_id)
            .join(
                KnowledgeResourceArtifact,
                (KnowledgeResourceArtifact.knowledge_resource_id == KnowledgeResource.id)
                & (KnowledgeResourceArtifact.artifact_kind == "original")
                & (KnowledgeResourceArtifact.status == "active"),
            )
            .where(
                KnowledgeResource.id == resource_id,
                KnowledgeResource.knowledge_space_id == knowledge_space_id,
                KnowledgeResource.status != "pending",
                KnowledgeSpace.workspace_id == workspace_id,
            )
            .limit(1)
        )
    ).one_or_none()
    if row is None:
        return None
    resource, artifact_id, object_key = row
    return KnowledgeResourceAccessRecord(
        summary=_resource_summary(resource),
        description=resource.summary,
        guide=resource.guide,
        checksum=resource.checksum,
        last_indexed_at=resource.last_indexed_at,
        artifact_id=artifact_id,
        object_key=object_key,
    )


async def replace_knowledge_resource_content(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    resource_id: UUID,
    artifact_id: UUID,
    object_key: str,
    content_type: str,
    size_bytes: int,
    checksum: bytes,
    updated_at: datetime,
) -> KnowledgeResourceSummary | None:
    artifact_updated = await session.scalar(
        update(KnowledgeResourceArtifact)
        .where(
            KnowledgeResourceArtifact.id == artifact_id,
            KnowledgeResourceArtifact.knowledge_resource_id == resource_id,
            select(KnowledgeSpace.id)
            .join(KnowledgeResource, KnowledgeResource.knowledge_space_id == KnowledgeSpace.id)
            .where(
                KnowledgeSpace.id == knowledge_space_id,
                KnowledgeSpace.workspace_id == workspace_id,
                KnowledgeSpace.lifecycle_status != "archived",
                KnowledgeResource.id == resource_id,
            )
            .exists(),
        )
        .values(
            object_key=object_key,
            declared_content_type=content_type,
            declared_size_bytes=size_bytes,
            content_type=content_type,
            size_bytes=size_bytes,
            checksum=checksum,
            activated_at=updated_at,
        )
        .returning(KnowledgeResourceArtifact.id)
    )
    if artifact_updated is None:
        return None
    resource_updated = await session.scalar(
        update(KnowledgeResource)
        .where(
            KnowledgeResource.id == resource_id,
            KnowledgeResource.knowledge_space_id == knowledge_space_id,
        )
        .values(
            status="indexing",
            mime_type=content_type,
            size_bytes=size_bytes,
            checksum=checksum,
            last_indexed_at=None,
            updated_at=updated_at,
        )
        .returning(KnowledgeResource.id)
    )
    if resource_updated is None:
        return None
    resource = await session.get(KnowledgeResource, resource_updated)
    return None if resource is None else _resource_summary(resource)


async def get_knowledge_resource_delete_record(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    resource_id: UUID,
) -> KnowledgeResourceDeleteRecord | None:
    rows = (
        await session.execute(
            select(KnowledgeResource.id, KnowledgeResourceArtifact.object_key)
            .join(KnowledgeSpace, KnowledgeSpace.id == KnowledgeResource.knowledge_space_id)
            .outerjoin(
                KnowledgeResourceArtifact,
                KnowledgeResourceArtifact.knowledge_resource_id == KnowledgeResource.id,
            )
            .where(
                KnowledgeResource.id == resource_id,
                KnowledgeResource.knowledge_space_id == knowledge_space_id,
                KnowledgeResource.status != "pending",
                KnowledgeSpace.workspace_id == workspace_id,
                KnowledgeSpace.lifecycle_status != "archived",
            )
        )
    ).all()
    if not rows:
        return None
    return KnowledgeResourceDeleteRecord(
        resource_id=rows[0].id,
        object_keys=tuple(row.object_key for row in rows if row.object_key is not None),
    )


async def delete_knowledge_resource(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    resource_id: UUID,
) -> bool:
    deleted_id = await session.scalar(
        delete(KnowledgeResource)
        .where(
            KnowledgeResource.id == resource_id,
            KnowledgeResource.knowledge_space_id == knowledge_space_id,
            KnowledgeResource.status != "pending",
            select(KnowledgeSpace.id)
            .where(
                KnowledgeSpace.id == KnowledgeResource.knowledge_space_id,
                KnowledgeSpace.workspace_id == workspace_id,
                KnowledgeSpace.lifecycle_status != "archived",
            )
            .exists(),
        )
        .returning(KnowledgeResource.id)
    )
    return deleted_id is not None


async def move_knowledge_resource(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    resource_id: UUID,
    target_folder_id: UUID,
) -> KnowledgeResourceSummary | None:
    moved_id = await session.scalar(
        update(KnowledgeResource)
        .where(
            KnowledgeResource.id == resource_id,
            KnowledgeResource.knowledge_space_id == knowledge_space_id,
            KnowledgeResource.status != "pending",
            select(KnowledgeSpace.id)
            .where(
                KnowledgeSpace.id == KnowledgeResource.knowledge_space_id,
                KnowledgeSpace.workspace_id == workspace_id,
                KnowledgeSpace.lifecycle_status != "archived",
            )
            .exists(),
        )
        .values(folder_id=target_folder_id, updated_at=func.now())
        .returning(KnowledgeResource.id)
    )
    if moved_id is None:
        return None
    resource = await session.get(KnowledgeResource, moved_id)
    if resource is None:
        raise RuntimeError("Moved Knowledge Resource was not visible")
    return _resource_summary(resource)


async def cas_bump_knowledge_space_revision(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    expected_revision: int,
) -> int | None:
    return await session.scalar(
        update(KnowledgeSpace)
        .where(
            KnowledgeSpace.id == knowledge_space_id,
            KnowledgeSpace.workspace_id == workspace_id,
            KnowledgeSpace.lifecycle_status != "archived",
            KnowledgeSpace.revision == expected_revision,
        )
        .values(revision=KnowledgeSpace.revision + 1, updated_at=func.now())
        .returning(KnowledgeSpace.revision)
    )


async def insert_knowledge_folder(
    session: AsyncSession,
    *,
    folder_id: UUID,
    knowledge_space_id: UUID,
    parent_folder_id: UUID,
    name: str,
    normalized_name: str,
) -> KnowledgeFolderSummary | None:
    inserted_id = await session.scalar(
        insert(KnowledgeFolder)
        .values(
            id=folder_id,
            knowledge_space_id=knowledge_space_id,
            parent_folder_id=parent_folder_id,
            name=name,
            normalized_name=normalized_name,
            sort_order=0,
        )
        .on_conflict_do_nothing()
        .returning(KnowledgeFolder.id)
    )
    if inserted_id is None:
        return None
    folder = await session.get(KnowledgeFolder, inserted_id)
    if folder is None:
        raise RuntimeError("Inserted Knowledge Folder was not visible")
    return KnowledgeFolderSummary(
        id=folder.id,
        knowledge_space_id=folder.knowledge_space_id,
        parent_folder_id=folder.parent_folder_id,
        name=folder.name,
        sort_order=folder.sort_order,
        created_at=folder.created_at,
        updated_at=folder.updated_at,
    )


async def insert_staged_upload(
    session: AsyncSession,
    *,
    resource_id: UUID,
    artifact_id: UUID,
    knowledge_space_id: UUID,
    folder_id: UUID,
    file_name: str,
    storage_provider: str,
    storage_bucket: str,
    object_key: str,
    declared_content_type: str,
    declared_size_bytes: int,
    upload_expires_at: datetime,
) -> None:
    session.add(
        KnowledgeResource(
            id=resource_id,
            knowledge_space_id=knowledge_space_id,
            folder_id=folder_id,
            name=file_name,
            resource_type="file",
            status="pending",
            summary=None,
            guide=None,
            mime_type=None,
            size_bytes=None,
            checksum=None,
            metadata_={},
            last_indexed_at=None,
        )
    )
    session.add(
        KnowledgeResourceArtifact(
            id=artifact_id,
            knowledge_resource_id=resource_id,
            artifact_kind="original",
            status="staging",
            storage_provider=storage_provider,
            storage_bucket=storage_bucket,
            object_key=object_key,
            storage_version_id=None,
            declared_content_type=declared_content_type,
            declared_size_bytes=declared_size_bytes,
            upload_expires_at=upload_expires_at,
            content_type=None,
            size_bytes=None,
            checksum_algorithm="sha256",
            checksum=None,
            activated_at=None,
            failed_at=None,
            failure_reason=None,
        )
    )
    await session.flush()


async def get_upload_candidate(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    artifact_id: UUID,
) -> UploadCandidate | None:
    row = (
        await session.execute(
            select(KnowledgeResourceArtifact, KnowledgeResource)
            .join(
                KnowledgeResource,
                KnowledgeResource.id == KnowledgeResourceArtifact.knowledge_resource_id,
            )
            .join(KnowledgeSpace, KnowledgeSpace.id == KnowledgeResource.knowledge_space_id)
            .where(
                KnowledgeResourceArtifact.id == artifact_id,
                KnowledgeResource.knowledge_space_id == knowledge_space_id,
                KnowledgeSpace.workspace_id == workspace_id,
                KnowledgeSpace.lifecycle_status != "archived",
            )
        )
    ).one_or_none()
    if row is None:
        return None
    artifact, resource = row
    return UploadCandidate(
        resource_id=resource.id,
        artifact_id=artifact.id,
        status=artifact.status,
        object_key=artifact.object_key,
        declared_content_type=artifact.declared_content_type,
        declared_size_bytes=artifact.declared_size_bytes,
        upload_expires_at=artifact.upload_expires_at,
    )


async def activate_staged_upload(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    artifact_id: UUID,
    content_type: str,
    size_bytes: int,
    checksum: bytes,
    activated_at: datetime,
) -> tuple[KnowledgeResourceSummary, bool] | None:
    row = (
        await session.execute(
            select(KnowledgeResourceArtifact, KnowledgeResource)
            .join(
                KnowledgeResource,
                KnowledgeResource.id == KnowledgeResourceArtifact.knowledge_resource_id,
            )
            .join(KnowledgeSpace, KnowledgeSpace.id == KnowledgeResource.knowledge_space_id)
            .where(
                KnowledgeResourceArtifact.id == artifact_id,
                KnowledgeResource.knowledge_space_id == knowledge_space_id,
                KnowledgeSpace.workspace_id == workspace_id,
                KnowledgeSpace.lifecycle_status != "archived",
            )
            .with_for_update(of=(KnowledgeResourceArtifact, KnowledgeResource))
        )
    ).one_or_none()
    if row is None:
        return None
    artifact, resource = row
    if artifact.status == "active":
        return _resource_summary(resource), False
    if artifact.status != "staging":
        return None
    artifact.status = "active"
    artifact.content_type = content_type
    artifact.size_bytes = size_bytes
    artifact.checksum = checksum
    artifact.activated_at = activated_at
    resource.status = "indexing"
    resource.mime_type = content_type
    resource.size_bytes = size_bytes
    resource.checksum = checksum
    resource.updated_at = activated_at
    await session.flush()
    return _resource_summary(resource), True


async def knowledge_space_delete_blocker(
    session: AsyncSession, workspace_id: UUID, knowledge_space_id: UUID
) -> str | None:
    lifecycle_status = await session.scalar(
        select(KnowledgeSpace.lifecycle_status).where(
            KnowledgeSpace.id == knowledge_space_id,
            KnowledgeSpace.workspace_id == workspace_id,
        )
    )
    if lifecycle_status is None:
        return "NOT_FOUND"
    if lifecycle_status != "archived":
        return "KNOWLEDGE_SPACE_MUST_BE_ARCHIVED"
    checks = (
        (KnowledgeResource, KnowledgeResource.knowledge_space_id, "KNOWLEDGE_SPACE_HAS_DOCUMENTS"),
        (
            WorkflowKnowledgeSpaceReference,
            WorkflowKnowledgeSpaceReference.knowledge_space_id,
            "KNOWLEDGE_SPACE_IS_REFERENCED",
        ),
        (
            AgentTemplateKnowledgeSpaceReference,
            AgentTemplateKnowledgeSpaceReference.knowledge_space_id,
            "KNOWLEDGE_SPACE_IS_REFERENCED",
        ),
        (
            ToolTemplateKnowledgeSpaceReference,
            ToolTemplateKnowledgeSpaceReference.knowledge_space_id,
            "KNOWLEDGE_SPACE_IS_REFERENCED",
        ),
    )
    for model, column, reason in checks:
        count = await session.scalar(
            select(func.count()).select_from(model).where(column == knowledge_space_id)
        )
        if count:
            return reason
    return None


async def cas_delete_knowledge_space(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    expected_revision: int,
) -> bool:
    deleted = await session.scalar(
        delete(KnowledgeSpace)
        .where(
            KnowledgeSpace.id == knowledge_space_id,
            KnowledgeSpace.workspace_id == workspace_id,
            KnowledgeSpace.revision == expected_revision,
        )
        .returning(KnowledgeSpace.id)
    )
    return deleted is not None
