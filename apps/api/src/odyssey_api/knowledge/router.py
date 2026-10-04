from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from odyssey_api.db.session import get_session
from odyssey_api.dependencies.workspace import CurrentWorkspace, get_current_workspace
from odyssey_api.errors.openapi import documented_responses
from odyssey_api.knowledge.dto import KnowledgeSpaceSummaryPage, ListKnowledgeSpacesQuery
from odyssey_api.knowledge.service import list_knowledge_spaces

router = APIRouter(prefix="/knowledge-spaces", tags=["knowledge-spaces"])


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
