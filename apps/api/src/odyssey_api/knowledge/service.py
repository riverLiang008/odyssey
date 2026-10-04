from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from odyssey_api.knowledge.dto import KnowledgeSpaceSummaryPage, ListKnowledgeSpacesQuery
from odyssey_api.knowledge.repository import list_knowledge_space_summaries


async def list_knowledge_spaces(
    session: AsyncSession, workspace_id: UUID, request: ListKnowledgeSpacesQuery
) -> KnowledgeSpaceSummaryPage:
    items, total = await list_knowledge_space_summaries(
        session,
        workspace_id=workspace_id,
        query=request.query,
        page=request.page,
        page_size=request.page_size,
    )
    return KnowledgeSpaceSummaryPage(
        items=items, page=request.page, page_size=request.page_size, total=total
    )
