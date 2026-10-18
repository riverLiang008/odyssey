import re
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from odyssey_api.db.session import get_session
from odyssey_api.dependencies.workspace import CurrentWorkspace, get_current_workspace
from odyssey_api.errors import ApplicationError, ErrorCode
from odyssey_api.errors.openapi import documented_responses
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
    ValidateKnowledgeGraphManifestRequest,
    ValidateKnowledgeGraphManifestResult,
)
from odyssey_api.knowledge.service import (
    apply_knowledge_graph_manifest,
    complete_knowledge_upload,
    create_category,
    create_knowledge_folder,
    create_knowledge_space,
    delete_knowledge_resource,
    delete_knowledge_space,
    list_categories,
    list_knowledge_spaces,
    load_knowledge_file_tree,
    load_knowledge_graph_overview,
    load_knowledge_resource_detail,
    load_knowledge_space,
    move_knowledge_resource,
    prepare_knowledge_upload,
    set_knowledge_space_archived,
    update_knowledge_resource_content,
    update_knowledge_space,
    validate_knowledge_graph_manifest,
)
from odyssey_api.storage.base import ObjectStorage
from odyssey_api.storage.dependencies import get_object_storage

router = APIRouter(prefix="/knowledge-spaces", tags=["knowledge-spaces"])
category_router = APIRouter(
    prefix="/knowledge-space-categories", tags=["knowledge-space-categories"]
)

SessionDependency = Annotated[AsyncSession, Depends(get_session)]
WorkspaceDependency = Annotated[CurrentWorkspace, Depends(get_current_workspace)]
StorageDependency = Annotated[ObjectStorage, Depends(get_object_storage)]


@router.get(
    "",
    response_model=KnowledgeSpaceSummaryPage,
    operation_id="listKnowledgeSpaces",
    summary="List Knowledge Spaces",
    responses=documented_responses(),
)
async def list_knowledge_spaces_route(
    request: Annotated[ListKnowledgeSpacesQuery, Query()],
    session: Annotated[AsyncSession, Depends(get_session)],
    workspace: Annotated[CurrentWorkspace, Depends(get_current_workspace)],
) -> KnowledgeSpaceSummaryPage:
    return await list_knowledge_spaces(session, workspace.id, request)


@router.post(
    "",
    response_model=KnowledgeSpaceDetail,
    status_code=status.HTTP_201_CREATED,
    operation_id="createKnowledgeSpace",
    summary="Create a Knowledge Space",
    responses=documented_responses(not_found=True, conflict=True),
)
async def create_knowledge_space_route(
    request: CreateKnowledgeSpaceRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> KnowledgeSpaceDetail:
    return await create_knowledge_space(session, workspace.id, request)


@router.get(
    "/{knowledge_space_id}",
    response_model=KnowledgeSpaceDetail,
    operation_id="loadKnowledgeSpace",
    summary="Load a Knowledge Space",
    responses=documented_responses(not_found=True),
)
async def load_knowledge_space_route(
    knowledge_space_id: UUID,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> KnowledgeSpaceDetail:
    return await load_knowledge_space(session, workspace.id, knowledge_space_id)


@router.get(
    "/{knowledge_space_id}/file-tree",
    response_model=KnowledgeFileTree,
    operation_id="loadKnowledgeFileTree",
    summary="Load a Knowledge Space file tree",
    responses=documented_responses(not_found=True),
)
async def load_knowledge_file_tree_route(
    knowledge_space_id: UUID,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> KnowledgeFileTree:
    return await load_knowledge_file_tree(session, workspace.id, knowledge_space_id)


@router.get(
    "/{knowledge_space_id}/graph",
    response_model=KnowledgeGraphOverview,
    operation_id="loadKnowledgeGraph",
    summary="Load a Knowledge Space graph projection",
    responses=documented_responses(not_found=True),
)
async def load_knowledge_graph_route(
    knowledge_space_id: UUID,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> KnowledgeGraphOverview:
    return await load_knowledge_graph_overview(session, workspace.id, knowledge_space_id)


@router.post(
    "/{knowledge_space_id}/graph-manifest/validate",
    response_model=ValidateKnowledgeGraphManifestResult,
    operation_id="validateKnowledgeGraphManifest",
    summary="Validate a Knowledge Graph Manifest without mutation",
    responses=documented_responses(not_found=True, conflict=True),
)
async def validate_knowledge_graph_manifest_route(
    knowledge_space_id: UUID,
    request: ValidateKnowledgeGraphManifestRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> ValidateKnowledgeGraphManifestResult:
    return await validate_knowledge_graph_manifest(
        session,
        workspace.id,
        knowledge_space_id,
        request,
    )


@router.post(
    "/{knowledge_space_id}/graph-manifest/apply",
    response_model=ApplyKnowledgeGraphManifestResult,
    operation_id="applyKnowledgeGraphManifest",
    summary="Apply a previously validated Knowledge Graph Manifest",
    responses=documented_responses(not_found=True, conflict=True),
)
async def apply_knowledge_graph_manifest_route(
    knowledge_space_id: UUID,
    request: ApplyKnowledgeGraphManifestRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> ApplyKnowledgeGraphManifestResult:
    return await apply_knowledge_graph_manifest(
        session,
        workspace.id,
        knowledge_space_id,
        request,
    )


@router.get(
    "/{knowledge_space_id}/resources/{resource_id}",
    response_model=KnowledgeResourceDetail,
    operation_id="loadKnowledgeResource",
    summary="Load Knowledge Space resource metadata and temporary content access",
    responses=documented_responses(not_found=True),
)
async def load_knowledge_resource_route(
    knowledge_space_id: UUID,
    resource_id: UUID,
    session: SessionDependency,
    workspace: WorkspaceDependency,
    storage: StorageDependency,
) -> KnowledgeResourceDetail:
    return await load_knowledge_resource_detail(
        session, workspace.id, knowledge_space_id, resource_id, storage
    )


@router.put(
    "/{knowledge_space_id}/resources/{resource_id}/content",
    response_model=UpdateKnowledgeResourceContentSuccess,
    operation_id="updateKnowledgeResourceContent",
    summary="Replace editable Markdown resource content",
    responses=documented_responses(not_found=True, conflict=True),
)
async def update_knowledge_resource_content_route(
    knowledge_space_id: UUID,
    resource_id: UUID,
    request: UpdateKnowledgeResourceContentRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
    storage: StorageDependency,
) -> UpdateKnowledgeResourceContentSuccess:
    return await update_knowledge_resource_content(
        session, workspace.id, knowledge_space_id, resource_id, request, storage
    )


@router.post(
    "/{knowledge_space_id}/folders",
    response_model=CreateKnowledgeFolderSuccess,
    status_code=status.HTTP_201_CREATED,
    operation_id="createKnowledgeFolder",
    summary="Create a Knowledge Space folder",
    responses=documented_responses(not_found=True, conflict=True),
)
async def create_knowledge_folder_route(
    knowledge_space_id: UUID,
    request: CreateKnowledgeFolderRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> CreateKnowledgeFolderSuccess:
    return await create_knowledge_folder(session, workspace.id, knowledge_space_id, request)


@router.post(
    "/{knowledge_space_id}/resources/{resource_id}/commands/move",
    response_model=MoveKnowledgeResourceSuccess,
    operation_id="moveKnowledgeResource",
    summary="Move a Knowledge Space resource to another folder",
    responses=documented_responses(not_found=True, conflict=True),
)
async def move_knowledge_resource_route(
    knowledge_space_id: UUID,
    resource_id: UUID,
    request: MoveKnowledgeResourceRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> MoveKnowledgeResourceSuccess:
    return await move_knowledge_resource(
        session, workspace.id, knowledge_space_id, resource_id, request
    )


@router.delete(
    "/{knowledge_space_id}/resources/{resource_id}",
    response_model=DeleteKnowledgeResourceSuccess,
    operation_id="deleteKnowledgeResource",
    summary="Delete a Knowledge Space resource",
    responses=documented_responses(not_found=True, conflict=True),
)
async def delete_knowledge_resource_route(
    knowledge_space_id: UUID,
    resource_id: UUID,
    if_match: Annotated[str, Header(alias="If-Match")],
    session: SessionDependency,
    workspace: WorkspaceDependency,
    storage: StorageDependency,
) -> DeleteKnowledgeResourceSuccess:
    return await delete_knowledge_resource(
        session,
        workspace.id,
        knowledge_space_id,
        resource_id,
        _parse_revision_etag(if_match),
        storage,
    )


@router.post(
    "/{knowledge_space_id}/uploads/prepare",
    response_model=PrepareKnowledgeUploadSuccess,
    status_code=status.HTTP_201_CREATED,
    operation_id="prepareKnowledgeUpload",
    summary="Prepare a staged Knowledge Space upload",
    responses=documented_responses(not_found=True, conflict=True),
)
async def prepare_knowledge_upload_route(
    knowledge_space_id: UUID,
    request: PrepareKnowledgeUploadRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
    storage: StorageDependency,
) -> PrepareKnowledgeUploadSuccess:
    return await prepare_knowledge_upload(
        session, workspace.id, knowledge_space_id, request, storage
    )


@router.post(
    "/{knowledge_space_id}/uploads/complete",
    response_model=CompleteKnowledgeUploadSuccess,
    operation_id="completeKnowledgeUpload",
    summary="Validate and activate a staged Knowledge Space upload",
    responses=documented_responses(not_found=True, conflict=True),
)
async def complete_knowledge_upload_route(
    knowledge_space_id: UUID,
    request: CompleteKnowledgeUploadRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
    storage: StorageDependency,
) -> CompleteKnowledgeUploadSuccess:
    return await complete_knowledge_upload(
        session, workspace.id, knowledge_space_id, request, storage
    )


@router.put(
    "/{knowledge_space_id}",
    response_model=KnowledgeSpaceDetail,
    operation_id="updateKnowledgeSpace",
    summary="Update Knowledge Space metadata",
    responses=documented_responses(not_found=True, conflict=True),
)
async def update_knowledge_space_route(
    knowledge_space_id: UUID,
    request: UpdateKnowledgeSpaceRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> KnowledgeSpaceDetail:
    return await update_knowledge_space(session, workspace.id, knowledge_space_id, request)


@router.post(
    "/{knowledge_space_id}/commands/archive",
    response_model=KnowledgeSpaceDetail,
    operation_id="archiveKnowledgeSpace",
    summary="Archive a Knowledge Space",
    responses=documented_responses(not_found=True, conflict=True),
)
async def archive_knowledge_space_route(
    knowledge_space_id: UUID,
    request: KnowledgeSpaceRevisionRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> KnowledgeSpaceDetail:
    return await set_knowledge_space_archived(
        session, workspace.id, knowledge_space_id, request, archived=True
    )


@router.post(
    "/{knowledge_space_id}/commands/unarchive",
    response_model=KnowledgeSpaceDetail,
    operation_id="unarchiveKnowledgeSpace",
    summary="Restore an archived Knowledge Space",
    responses=documented_responses(not_found=True, conflict=True),
)
async def unarchive_knowledge_space_route(
    knowledge_space_id: UUID,
    request: KnowledgeSpaceRevisionRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> KnowledgeSpaceDetail:
    return await set_knowledge_space_archived(
        session, workspace.id, knowledge_space_id, request, archived=False
    )


def _parse_revision_etag(value: str) -> int:
    match = re.fullmatch(r'"([1-9][0-9]*)"', value)
    if match is None:
        raise ApplicationError(
            ErrorCode.VALIDATION_FAILED,
            details={"issues": [{"path": ["header", "If-Match"], "code": "INVALID_ETAG"}]},
        )
    return int(match.group(1))


@router.delete(
    "/{knowledge_space_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteKnowledgeSpace",
    summary="Delete an unused Knowledge Space",
    responses=documented_responses(not_found=True, conflict=True),
)
async def delete_knowledge_space_route(
    knowledge_space_id: UUID,
    if_match: Annotated[str, Header(alias="If-Match")],
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> Response:
    await delete_knowledge_space(
        session,
        workspace.id,
        knowledge_space_id,
        _parse_revision_etag(if_match),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@category_router.get(
    "",
    response_model=list[KnowledgeSpaceCategorySummary],
    operation_id="listKnowledgeSpaceCategories",
    summary="List Knowledge Space Categories",
    responses=documented_responses(),
)
async def list_categories_route(
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> list[KnowledgeSpaceCategorySummary]:
    return await list_categories(session, workspace.id)


@category_router.post(
    "",
    response_model=KnowledgeSpaceCategorySummary,
    status_code=status.HTTP_201_CREATED,
    operation_id="createKnowledgeSpaceCategory",
    summary="Create a Knowledge Space Category",
    responses=documented_responses(conflict=True),
)
async def create_category_route(
    request: CreateKnowledgeSpaceCategoryRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> KnowledgeSpaceCategorySummary:
    return await create_category(session, workspace.id, request)
