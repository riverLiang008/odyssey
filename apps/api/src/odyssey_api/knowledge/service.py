import logging
import unicodedata
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from io import BytesIO
from pathlib import PurePath
from typing import Never
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from odyssey_api.errors import ApplicationError, ErrorCode
from odyssey_api.knowledge import repository
from odyssey_api.knowledge.dto import (
    CompleteKnowledgeUploadRequest,
    CompleteKnowledgeUploadSuccess,
    CreateKnowledgeFolderRequest,
    CreateKnowledgeFolderSuccess,
    CreateKnowledgeSpaceCategoryRequest,
    CreateKnowledgeSpaceRequest,
    DeleteKnowledgeResourceSuccess,
    KnowledgeFileTree,
    KnowledgeGraphOverview,
    KnowledgeResourceDetail,
    KnowledgeSpaceCategorySummary,
    KnowledgeSpaceDetail,
    KnowledgeSpaceRevisionRequest,
    KnowledgeSpaceSummaryPage,
    ListKnowledgeSpacesQuery,
    MoveKnowledgeResourceRequest,
    MoveKnowledgeResourceSuccess,
    PrepareKnowledgeUploadRequest,
    PrepareKnowledgeUploadSuccess,
    UpdateKnowledgeResourceContentRequest,
    UpdateKnowledgeResourceContentSuccess,
    UpdateKnowledgeSpaceRequest,
)
from odyssey_api.knowledge.manifest import (
    ApplyKnowledgeGraphManifestRequest,
    ApplyKnowledgeGraphManifestResult,
    KnowledgeGraphManifest,
    ManifestValidationIssue,
    ManifestValidationIssueDto,
    ValidateKnowledgeGraphManifestRequest,
    ValidateKnowledgeGraphManifestResult,
    canonicalize_manifest_path,
    knowledge_graph_manifest_checksum,
    match_manifest_documents,
    produce_manifest_graph,
)
from odyssey_api.knowledge.manifest_token import (
    ManifestValidationTokenClaims,
    ManifestValidationTokenError,
    create_manifest_validation_token,
    verify_manifest_validation_token,
)
from odyssey_api.settings import get_settings
from odyssey_api.storage.base import ObjectNotFoundError, ObjectStorage

ALLOWED_UPLOAD_TYPES: dict[str, frozenset[str]] = {
    "text/markdown": frozenset({".md", ".markdown"}),
    "text/plain": frozenset({".txt", ".md", ".markdown"}),
    "application/pdf": frozenset({".pdf"}),
    "application/json": frozenset({".json"}),
}

logger = logging.getLogger(__name__)


def normalize_name(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


async def list_knowledge_spaces(
    session: AsyncSession, workspace_id: UUID, request: ListKnowledgeSpacesQuery
) -> KnowledgeSpaceSummaryPage:
    items, total = await repository.list_knowledge_space_summaries(
        session,
        workspace_id=workspace_id,
        query=request.query,
        page=request.page,
        page_size=request.page_size,
        include_archived=request.include_archived,
    )
    return KnowledgeSpaceSummaryPage(
        items=items, page=request.page, page_size=request.page_size, total=total
    )


async def list_categories(
    session: AsyncSession, workspace_id: UUID
) -> list[KnowledgeSpaceCategorySummary]:
    return await repository.list_knowledge_space_categories(session, workspace_id)


async def create_category(
    session: AsyncSession,
    workspace_id: UUID,
    request: CreateKnowledgeSpaceCategoryRequest,
    *,
    id_factory: Callable[[], UUID] = uuid4,
) -> KnowledgeSpaceCategorySummary:
    category_id = id_factory()
    async with session.begin():
        inserted = await repository.insert_knowledge_space_category(
            session,
            category_id=category_id,
            workspace_id=workspace_id,
            name=request.name,
            normalized_name=normalize_name(request.name),
            color_token=request.color_token,
        )
        if not inserted:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={"reason": "KNOWLEDGE_SPACE_CATEGORY_NAME_CONFLICT"},
            )
        category = await repository.get_knowledge_space_category(session, workspace_id, category_id)
        if category is None:
            raise RuntimeError("Inserted Knowledge Space Category was not visible")
        return category


async def load_knowledge_space(
    session: AsyncSession, workspace_id: UUID, knowledge_space_id: UUID
) -> KnowledgeSpaceDetail:
    detail = await repository.get_knowledge_space_detail(session, workspace_id, knowledge_space_id)
    if detail is None:
        raise ApplicationError(ErrorCode.NOT_FOUND)
    return detail


async def load_knowledge_file_tree(
    session: AsyncSession, workspace_id: UUID, knowledge_space_id: UUID
) -> KnowledgeFileTree:
    tree = await repository.get_knowledge_file_tree(session, workspace_id, knowledge_space_id)
    if tree is None:
        raise ApplicationError(ErrorCode.NOT_FOUND)
    return tree


async def load_knowledge_graph_overview(
    session: AsyncSession, workspace_id: UUID, knowledge_space_id: UUID
) -> KnowledgeGraphOverview:
    graph = await repository.get_knowledge_graph_overview(session, workspace_id, knowledge_space_id)
    if graph is None:
        raise ApplicationError(ErrorCode.NOT_FOUND)
    return graph


def _knowledge_resource_ids_by_path(tree: KnowledgeFileTree) -> dict[str, tuple[UUID, ...]]:
    folders = {folder.id: folder for folder in tree.folders}
    paths: dict[str, list[UUID]] = {}
    for resource in tree.resources:
        segments = [resource.name]
        folder_id = resource.folder_id
        visited: set[UUID] = set()
        while folder_id != tree.root_folder_id:
            if folder_id in visited:
                raise ApplicationError(
                    ErrorCode.STATE_CONFLICT,
                    details={"reason": "KNOWLEDGE_FILE_TREE_INVALID"},
                )
            visited.add(folder_id)
            folder = folders.get(folder_id)
            if folder is None or folder.parent_folder_id is None:
                raise ApplicationError(
                    ErrorCode.STATE_CONFLICT,
                    details={"reason": "KNOWLEDGE_FILE_TREE_INVALID"},
                )
            segments.append(folder.name)
            folder_id = folder.parent_folder_id
        try:
            canonical_path = canonicalize_manifest_path("/".join(reversed(segments)))
        except ValueError as error:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={"reason": "KNOWLEDGE_FILE_TREE_INVALID"},
            ) from error
        paths.setdefault(canonical_path, []).append(resource.id)
    return {path: tuple(resource_ids) for path, resource_ids in paths.items()}


def _duplicate_manifest_tag_name_issues(
    manifest: KnowledgeGraphManifest,
) -> tuple[ManifestValidationIssue, ...]:
    seen: set[str] = set()
    issues: list[ManifestValidationIssue] = []
    for index, tag in enumerate(manifest.tags):
        normalized_name = normalize_name(tag.name)
        if normalized_name in seen:
            issues.append(
                ManifestValidationIssue(
                    ("tags", index, "name"),
                    "DUPLICATE_TAG_NAME",
                )
            )
        seen.add(normalized_name)
    return tuple(issues)


async def validate_knowledge_graph_manifest(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    request: ValidateKnowledgeGraphManifestRequest,
    *,
    now_factory: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> ValidateKnowledgeGraphManifestResult:
    settings = get_settings()
    if settings.environment == "production" and not settings.knowledge_manifest_import_enabled:
        raise ApplicationError(ErrorCode.NOT_FOUND)
    tree = await repository.get_knowledge_file_tree(session, workspace_id, knowledge_space_id)
    if tree is None:
        raise ApplicationError(ErrorCode.NOT_FOUND)
    if tree.revision != request.expected_revision:
        raise ApplicationError(
            ErrorCode.REVISION_CONFLICT,
            details={
                "expectedRevision": request.expected_revision,
                "currentRevision": tree.revision,
            },
        )

    candidate = match_manifest_documents(
        request.manifest,
        _knowledge_resource_ids_by_path(tree),
    )
    validation_issues = (
        *candidate.issues,
        *_duplicate_manifest_tag_name_issues(request.manifest),
    )
    checksum = knowledge_graph_manifest_checksum(request.manifest)
    matched_keys = {match.document_key for match in candidate.matches}
    is_valid = not validation_issues
    token = None
    if is_valid:
        token = create_manifest_validation_token(
            ManifestValidationTokenClaims(
                workspace_id=workspace_id,
                knowledge_space_id=knowledge_space_id,
                expected_revision=request.expected_revision,
                manifest_checksum=checksum,
                expires_at=now_factory()
                + timedelta(seconds=settings.knowledge_manifest_token_ttl_seconds),
            ),
            settings.knowledge_manifest_token_secret,
        )
    return ValidateKnowledgeGraphManifestResult(
        validation_token=token,
        manifest_checksum=checksum,
        knowledge_space_revision=tree.revision,
        status="valid" if is_valid else "invalid",
        matched_document_count=len(candidate.matches),
        unmatched_document_count=len(request.manifest.documents) - len(candidate.matches),
        summary_update_count=sum(
            document.key in matched_keys and document.summary is not None
            for document in request.manifest.documents
        ),
        guide_update_count=sum(
            document.key in matched_keys and document.guide is not None
            for document in request.manifest.documents
        ),
        tag_count=len(request.manifest.tags),
        relation_count=len(request.manifest.relations),
        issue_count=len(request.manifest.issues),
        resulting_graph_status=request.manifest.graph.status if is_valid else None,
        issues=[
            ManifestValidationIssueDto(path=list(issue.path), code=issue.code)
            for issue in validation_issues
        ],
    )


def _raise_invalid_manifest_token(code: str = "MANIFEST_TOKEN_INVALID") -> Never:
    raise ApplicationError(
        ErrorCode.VALIDATION_FAILED,
        details={"issues": [{"path": ["body", "validationToken"], "code": code}]},
    )


async def apply_knowledge_graph_manifest(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    request: ApplyKnowledgeGraphManifestRequest,
    *,
    now_factory: Callable[[], datetime] = lambda: datetime.now(UTC),
    id_factory: Callable[[], UUID] = uuid4,
) -> ApplyKnowledgeGraphManifestResult:
    settings = get_settings()
    if settings.environment == "production" and not settings.knowledge_manifest_import_enabled:
        raise ApplicationError(ErrorCode.NOT_FOUND)
    now = now_factory()
    try:
        claims = verify_manifest_validation_token(
            request.validation_token,
            settings.knowledge_manifest_token_secret,
        )
    except ManifestValidationTokenError:
        _raise_invalid_manifest_token()
    checksum = knowledge_graph_manifest_checksum(request.manifest)
    if claims.workspace_id != workspace_id or claims.knowledge_space_id != knowledge_space_id:
        raise ApplicationError(ErrorCode.NOT_FOUND)
    if (
        claims.expected_revision != request.expected_revision
        or claims.manifest_checksum != request.manifest_checksum
        or checksum != request.manifest_checksum
    ):
        _raise_invalid_manifest_token()
    if claims.expires_at <= now:
        _raise_invalid_manifest_token("MANIFEST_TOKEN_EXPIRED")

    async with session.begin():
        tree = await repository.get_knowledge_file_tree(session, workspace_id, knowledge_space_id)
        if tree is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if tree.revision != request.expected_revision:
            raise ApplicationError(
                ErrorCode.REVISION_CONFLICT,
                details={
                    "expectedRevision": request.expected_revision,
                    "currentRevision": tree.revision,
                },
            )
        checksum_bytes = bytes.fromhex(checksum)
        applied_checksum = await repository.get_manifest_import_checksum(
            session, workspace_id, knowledge_space_id
        )
        if applied_checksum == checksum_bytes:
            return ApplyKnowledgeGraphManifestResult(
                status="already_up_to_date",
                manifest_checksum=checksum,
                knowledge_space_revision=tree.revision,
            )
        candidate = match_manifest_documents(
            request.manifest,
            _knowledge_resource_ids_by_path(tree),
        )
        validation_issues = (
            *candidate.issues,
            *_duplicate_manifest_tag_name_issues(request.manifest),
        )
        if validation_issues:
            raise ApplicationError(
                ErrorCode.VALIDATION_FAILED,
                details={
                    "issues": [
                        {"path": list(issue.path), "code": issue.code}
                        for issue in validation_issues
                    ]
                },
            )
        normalized_tag_names = {tag.key: normalize_name(tag.name) for tag in request.manifest.tags}
        existing_tags_by_name = await repository.get_knowledge_tag_ids_by_normalized_name(
            session,
            workspace_id,
            knowledge_space_id,
            set(normalized_tag_names.values()),
        )
        existing_tag_ids_by_key = {
            key: existing_tags_by_name[name]
            for key, name in normalized_tag_names.items()
            if name in existing_tags_by_name
        }
        projection = produce_manifest_graph(
            knowledge_space_id,
            request.manifest,
            candidate,
            existing_tag_ids_by_key,
            normalized_tag_names,
        )
        new_revision = await repository.cas_begin_manifest_apply(
            session,
            workspace_id=workspace_id,
            knowledge_space_id=knowledge_space_id,
            expected_revision=request.expected_revision,
            graph_status=projection.graph_status,
            applied_at=now,
        )
        if new_revision is None:
            await _raise_failed_cas(
                session,
                workspace_id,
                knowledge_space_id,
                request.expected_revision,
            )
        await repository.replace_manifest_graph_projection(
            session,
            knowledge_space_id=knowledge_space_id,
            projection=projection,
            manifest_checksum=checksum_bytes,
            new_revision=new_revision,
            applied_at=now,
            import_id=id_factory(),
        )
        return ApplyKnowledgeGraphManifestResult(
            status="applied",
            manifest_checksum=checksum,
            knowledge_space_revision=new_revision,
        )


async def load_knowledge_resource_detail(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    resource_id: UUID,
    storage: ObjectStorage,
    *,
    now_factory: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> KnowledgeResourceDetail:
    record = await repository.get_knowledge_resource_access_record(
        session, workspace_id, knowledge_space_id, resource_id
    )
    if record is None:
        raise ApplicationError(ErrorCode.NOT_FOUND)
    expires_in = timedelta(minutes=15)
    download_url = await storage.create_download_url(record.object_key, expires_in)
    return KnowledgeResourceDetail(
        **record.summary.model_dump(),
        summary=record.description,
        guide=record.guide,
        checksum_sha256=None if record.checksum is None else record.checksum.hex(),
        last_indexed_at=record.last_indexed_at,
        download_url=download_url,
        download_expires_at=now_factory() + expires_in,
    )


async def create_knowledge_folder(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    request: CreateKnowledgeFolderRequest,
    *,
    id_factory: Callable[[], UUID] = uuid4,
) -> CreateKnowledgeFolderSuccess:
    async with session.begin():
        if not await repository.folder_is_visible(
            session, workspace_id, knowledge_space_id, request.parent_folder_id
        ):
            raise ApplicationError(ErrorCode.NOT_FOUND)
        revision = await repository.cas_bump_knowledge_space_revision(
            session,
            workspace_id=workspace_id,
            knowledge_space_id=knowledge_space_id,
            expected_revision=request.expected_revision,
        )
        if revision is None:
            await _raise_failed_cas(
                session, workspace_id, knowledge_space_id, request.expected_revision
            )
        folder = await repository.insert_knowledge_folder(
            session,
            folder_id=id_factory(),
            knowledge_space_id=knowledge_space_id,
            parent_folder_id=request.parent_folder_id,
            name=request.name,
            normalized_name=normalize_name(request.name),
        )
        if folder is None:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={"reason": "KNOWLEDGE_FOLDER_NAME_CONFLICT"},
            )
        return CreateKnowledgeFolderSuccess(folder=folder, knowledge_space_revision=revision)


async def move_knowledge_resource(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    resource_id: UUID,
    request: MoveKnowledgeResourceRequest,
) -> MoveKnowledgeResourceSuccess:
    async with session.begin():
        resource = await repository.get_visible_knowledge_resource(
            session, workspace_id, knowledge_space_id, resource_id
        )
        if resource is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if not await repository.folder_is_visible(
            session, workspace_id, knowledge_space_id, request.target_folder_id
        ):
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if resource.folder_id == request.target_folder_id:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={"reason": "KNOWLEDGE_RESOURCE_ALREADY_IN_FOLDER"},
            )
        revision = await repository.cas_bump_knowledge_space_revision(
            session,
            workspace_id=workspace_id,
            knowledge_space_id=knowledge_space_id,
            expected_revision=request.expected_revision,
        )
        if revision is None:
            await _raise_failed_cas(
                session, workspace_id, knowledge_space_id, request.expected_revision
            )
        moved = await repository.move_knowledge_resource(
            session,
            workspace_id=workspace_id,
            knowledge_space_id=knowledge_space_id,
            resource_id=resource_id,
            target_folder_id=request.target_folder_id,
        )
        if moved is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        return MoveKnowledgeResourceSuccess(resource=moved, knowledge_space_revision=revision)


def _validate_upload_request(request: PrepareKnowledgeUploadRequest) -> None:
    settings = get_settings()
    if request.size_bytes > settings.knowledge_upload_max_bytes:
        raise ApplicationError(
            ErrorCode.VALIDATION_FAILED,
            details={"issues": [{"path": ["body", "sizeBytes"], "code": "FILE_TOO_LARGE"}]},
        )
    content_type = request.content_type.partition(";")[0].strip().lower()
    allowed_extensions = ALLOWED_UPLOAD_TYPES.get(content_type)
    suffix = PurePath(request.file_name).suffix.casefold()
    if allowed_extensions is None or suffix not in allowed_extensions:
        raise ApplicationError(
            ErrorCode.VALIDATION_FAILED,
            details={
                "issues": [{"path": ["body", "contentType"], "code": "UNSUPPORTED_FILE_TYPE"}]
            },
        )


async def prepare_knowledge_upload(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    request: PrepareKnowledgeUploadRequest,
    storage: ObjectStorage,
    *,
    id_factory: Callable[[], UUID] = uuid4,
    now_factory: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> PrepareKnowledgeUploadSuccess:
    _validate_upload_request(request)
    settings = get_settings()
    resource_id = id_factory()
    artifact_id = id_factory()
    expires_at = now_factory() + timedelta(seconds=settings.knowledge_upload_ttl_seconds)
    object_key = (
        f"workspaces/{workspace_id}/knowledge-spaces/{knowledge_space_id}/"
        f"resources/{resource_id}/artifacts/{artifact_id}"
    )
    async with session.begin():
        if not await repository.folder_is_visible(
            session, workspace_id, knowledge_space_id, request.folder_id
        ):
            raise ApplicationError(ErrorCode.NOT_FOUND)
    await storage.ensure_bucket()
    upload = await storage.create_upload_url(
        object_key,
        request.content_type,
        timedelta(seconds=settings.knowledge_upload_ttl_seconds),
    )
    async with session.begin():
        # Re-check after external I/O so an archive that races presigning cannot
        # create a new staged row in a no-longer-editable Knowledge Space.
        if not await repository.folder_is_visible(
            session, workspace_id, knowledge_space_id, request.folder_id
        ):
            raise ApplicationError(ErrorCode.NOT_FOUND)
        await repository.insert_staged_upload(
            session,
            resource_id=resource_id,
            artifact_id=artifact_id,
            knowledge_space_id=knowledge_space_id,
            folder_id=request.folder_id,
            file_name=request.file_name,
            storage_provider=storage.provider,
            storage_bucket=storage.bucket,
            object_key=object_key,
            declared_content_type=request.content_type,
            declared_size_bytes=request.size_bytes,
            upload_expires_at=expires_at,
        )
    return PrepareKnowledgeUploadSuccess(
        resource_id=resource_id,
        artifact_id=artifact_id,
        upload_url=upload.url,
        method=upload.method,
        required_headers=upload.required_headers,
        expires_at=expires_at,
    )


async def complete_knowledge_upload(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    request: CompleteKnowledgeUploadRequest,
    storage: ObjectStorage,
    *,
    now_factory: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> CompleteKnowledgeUploadSuccess:
    async with session.begin():
        candidate = await repository.get_upload_candidate(
            session,
            workspace_id=workspace_id,
            knowledge_space_id=knowledge_space_id,
            artifact_id=request.artifact_id,
        )
        if candidate is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if candidate.status == "active":
            tree = await repository.get_knowledge_file_tree(
                session, workspace_id, knowledge_space_id
            )
            if tree is None:
                raise ApplicationError(ErrorCode.NOT_FOUND)
            resource = next(item for item in tree.resources if item.id == candidate.resource_id)
            return CompleteKnowledgeUploadSuccess(
                resource=resource, knowledge_space_revision=tree.revision
            )
        if candidate.status != "staging":
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={"reason": "UPLOAD_NOT_STAGING"},
            )
    now = now_factory()
    if candidate.upload_expires_at <= now:
        raise ApplicationError(
            ErrorCode.STATE_CONFLICT,
            details={"reason": "UPLOAD_EXPIRED"},
        )
    try:
        inspected = await storage.inspect(candidate.object_key)
    except ObjectNotFoundError as error:
        raise ApplicationError(
            ErrorCode.STATE_CONFLICT,
            details={"reason": "UPLOAD_OBJECT_NOT_FOUND"},
        ) from error
    if inspected.size_bytes != candidate.declared_size_bytes:
        raise ApplicationError(
            ErrorCode.STATE_CONFLICT,
            details={"reason": "UPLOAD_SIZE_MISMATCH"},
        )
    trusted_content_type = inspected.content_type.partition(";")[0].strip().lower()
    declared_content_type = candidate.declared_content_type.partition(";")[0].strip().lower()
    if trusted_content_type != declared_content_type:
        raise ApplicationError(
            ErrorCode.STATE_CONFLICT,
            details={"reason": "UPLOAD_CONTENT_TYPE_MISMATCH"},
        )
    async with session.begin():
        activation = await repository.activate_staged_upload(
            session,
            workspace_id=workspace_id,
            knowledge_space_id=knowledge_space_id,
            artifact_id=request.artifact_id,
            content_type=trusted_content_type,
            size_bytes=inspected.size_bytes,
            checksum=inspected.sha256,
            activated_at=now,
        )
        if activation is None:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={"reason": "UPLOAD_NOT_STAGING"},
            )
        resource, activated_now = activation
        if activated_now:
            revision = await repository.cas_bump_knowledge_space_revision(
                session,
                workspace_id=workspace_id,
                knowledge_space_id=knowledge_space_id,
                expected_revision=request.expected_revision,
            )
            if revision is None:
                await _raise_failed_cas(
                    session, workspace_id, knowledge_space_id, request.expected_revision
                )
        else:
            revision = await repository.get_knowledge_space_revision(
                session, workspace_id, knowledge_space_id
            )
            if revision is None:
                raise ApplicationError(ErrorCode.NOT_FOUND)
        return CompleteKnowledgeUploadSuccess(
            resource=resource,
            knowledge_space_revision=revision,
        )


async def delete_knowledge_resource(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    resource_id: UUID,
    expected_revision: int,
    storage: ObjectStorage,
) -> DeleteKnowledgeResourceSuccess:
    async with session.begin():
        record = await repository.get_knowledge_resource_delete_record(
            session, workspace_id, knowledge_space_id, resource_id
        )
        if record is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        revision = await repository.cas_bump_knowledge_space_revision(
            session,
            workspace_id=workspace_id,
            knowledge_space_id=knowledge_space_id,
            expected_revision=expected_revision,
        )
        if revision is None:
            await _raise_failed_cas(session, workspace_id, knowledge_space_id, expected_revision)
        deleted = await repository.delete_knowledge_resource(
            session,
            workspace_id=workspace_id,
            knowledge_space_id=knowledge_space_id,
            resource_id=resource_id,
        )
        if not deleted:
            raise ApplicationError(ErrorCode.NOT_FOUND)

    for object_key in record.object_keys:
        try:
            await storage.delete(object_key)
        except Exception:
            logger.warning(
                "Knowledge resource metadata deleted but object cleanup failed",
                extra={
                    "knowledge_space_id": str(knowledge_space_id),
                    "resource_id": str(resource_id),
                },
                exc_info=True,
            )
    return DeleteKnowledgeResourceSuccess(
        resource_id=resource_id,
        knowledge_space_revision=revision,
    )


async def update_knowledge_resource_content(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    resource_id: UUID,
    request: UpdateKnowledgeResourceContentRequest,
    storage: ObjectStorage,
    *,
    id_factory: Callable[[], UUID] = uuid4,
    now_factory: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> UpdateKnowledgeResourceContentSuccess:
    async with session.begin():
        original = await repository.get_knowledge_resource_access_record(
            session, workspace_id, knowledge_space_id, resource_id
        )
        if original is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if original.summary.mime_type not in {"text/markdown", "text/plain"} or PurePath(
            original.summary.name
        ).suffix.casefold() not in {".md", ".markdown"}:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={"reason": "KNOWLEDGE_RESOURCE_NOT_EDITABLE_MARKDOWN"},
            )

    content = request.content.encode("utf-8")
    if len(content) > 2_000_000:
        raise ApplicationError(
            ErrorCode.VALIDATION_FAILED,
            details={"issues": [{"path": ["body", "content"], "code": "TOO_LARGE"}]},
        )
    replacement_id = id_factory()
    replacement_key = (
        f"workspaces/{workspace_id}/knowledge-spaces/{knowledge_space_id}/"
        f"resources/{resource_id}/artifacts/{replacement_id}"
    )
    await storage.ensure_bucket()
    stored = await storage.upload(replacement_key, BytesIO(content), "text/markdown")
    checksum = sha256(content).digest()
    now = now_factory()
    try:
        async with session.begin():
            current = await repository.get_knowledge_resource_access_record(
                session, workspace_id, knowledge_space_id, resource_id
            )
            if current is None:
                raise ApplicationError(ErrorCode.NOT_FOUND)
            revision = await repository.cas_bump_knowledge_space_revision(
                session,
                workspace_id=workspace_id,
                knowledge_space_id=knowledge_space_id,
                expected_revision=request.expected_revision,
            )
            if revision is None:
                await _raise_failed_cas(
                    session, workspace_id, knowledge_space_id, request.expected_revision
                )
            resource = await repository.replace_knowledge_resource_content(
                session,
                workspace_id=workspace_id,
                knowledge_space_id=knowledge_space_id,
                resource_id=resource_id,
                artifact_id=current.artifact_id,
                object_key=replacement_key,
                content_type="text/markdown",
                size_bytes=stored.size_bytes,
                checksum=checksum,
                updated_at=now,
            )
            if resource is None:
                raise ApplicationError(ErrorCode.NOT_FOUND)
    except BaseException:
        try:
            await storage.delete(replacement_key)
        except Exception:
            logger.warning(
                "Knowledge resource replacement cleanup failed",
                extra={
                    "knowledge_space_id": str(knowledge_space_id),
                    "resource_id": str(resource_id),
                },
                exc_info=True,
            )
        raise

    if original.object_key != replacement_key:
        try:
            await storage.delete(original.object_key)
        except Exception:
            logger.warning(
                "Knowledge resource old object cleanup failed",
                extra={
                    "knowledge_space_id": str(knowledge_space_id),
                    "resource_id": str(resource_id),
                },
                exc_info=True,
            )
    return UpdateKnowledgeResourceContentSuccess(
        resource=resource,
        knowledge_space_revision=revision,
    )


async def create_knowledge_space(
    session: AsyncSession,
    workspace_id: UUID,
    request: CreateKnowledgeSpaceRequest,
    *,
    id_factory: Callable[[], UUID] = uuid4,
) -> KnowledgeSpaceDetail:
    knowledge_space_id = id_factory()
    root_folder_id = id_factory()
    async with session.begin():
        if not await repository.category_is_visible(session, workspace_id, request.category_id):
            raise ApplicationError(ErrorCode.NOT_FOUND)
        inserted = await repository.insert_knowledge_space_with_root(
            session,
            knowledge_space_id=knowledge_space_id,
            root_folder_id=root_folder_id,
            workspace_id=workspace_id,
            category_id=request.category_id,
            name=request.name,
            normalized_name=normalize_name(request.name),
            description=request.description,
        )
        if not inserted:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={"reason": "KNOWLEDGE_SPACE_NAME_CONFLICT"},
            )
        detail = await repository.get_knowledge_space_detail(
            session, workspace_id, knowledge_space_id
        )
        if detail is None:
            raise RuntimeError("Inserted Knowledge Space was not visible in its transaction")
        return detail


def _revision_error(expected_revision: int, current_revision: int) -> ApplicationError:
    return ApplicationError(
        ErrorCode.REVISION_CONFLICT,
        details={
            "expectedRevision": expected_revision,
            "currentRevision": current_revision,
        },
    )


async def _raise_failed_cas(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    expected_revision: int,
) -> None:
    current_revision = await repository.get_knowledge_space_revision(
        session, workspace_id, knowledge_space_id
    )
    if current_revision is None:
        raise ApplicationError(ErrorCode.NOT_FOUND)
    raise _revision_error(expected_revision, current_revision)


async def update_knowledge_space(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    request: UpdateKnowledgeSpaceRequest,
) -> KnowledgeSpaceDetail:
    async with session.begin():
        if not await repository.category_is_visible(session, workspace_id, request.category_id):
            raise ApplicationError(ErrorCode.NOT_FOUND)
        normalized_name = normalize_name(request.name)
        if not await repository.knowledge_space_name_is_available(
            session,
            workspace_id=workspace_id,
            knowledge_space_id=knowledge_space_id,
            normalized_name=normalized_name,
        ):
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={"reason": "KNOWLEDGE_SPACE_NAME_CONFLICT"},
            )
        updated = await repository.cas_update_knowledge_space(
            session,
            workspace_id=workspace_id,
            knowledge_space_id=knowledge_space_id,
            expected_revision=request.expected_revision,
            name=request.name,
            normalized_name=normalized_name,
            description=request.description,
            category_id=request.category_id,
        )
        if not updated:
            await _raise_failed_cas(
                session, workspace_id, knowledge_space_id, request.expected_revision
            )
        detail = await repository.get_knowledge_space_detail(
            session, workspace_id, knowledge_space_id
        )
        if detail is None:
            raise RuntimeError("Updated Knowledge Space was not visible in its transaction")
        return detail


async def set_knowledge_space_archived(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    request: KnowledgeSpaceRevisionRequest,
    *,
    archived: bool,
) -> KnowledgeSpaceDetail:
    async with session.begin():
        updated = await repository.cas_set_knowledge_space_lifecycle(
            session,
            workspace_id=workspace_id,
            knowledge_space_id=knowledge_space_id,
            expected_revision=request.expected_revision,
            lifecycle_status="archived" if archived else "ready",
        )
        if not updated:
            await _raise_failed_cas(
                session, workspace_id, knowledge_space_id, request.expected_revision
            )
        detail = await repository.get_knowledge_space_detail(
            session, workspace_id, knowledge_space_id
        )
        if detail is None:
            raise RuntimeError("Archived Knowledge Space was not visible in its transaction")
        return detail


async def delete_knowledge_space(
    session: AsyncSession,
    workspace_id: UUID,
    knowledge_space_id: UUID,
    expected_revision: int,
) -> None:
    async with session.begin():
        blocker = await repository.knowledge_space_delete_blocker(
            session, workspace_id, knowledge_space_id
        )
        if blocker == "NOT_FOUND":
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if blocker is not None:
            raise ApplicationError(ErrorCode.STATE_CONFLICT, details={"reason": blocker})
        deleted = await repository.cas_delete_knowledge_space(
            session,
            workspace_id=workspace_id,
            knowledge_space_id=knowledge_space_id,
            expected_revision=expected_revision,
        )
        if not deleted:
            await _raise_failed_cas(session, workspace_id, knowledge_space_id, expected_revision)
