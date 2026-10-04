from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from odyssey_api.db.models import KnowledgeSpace
from odyssey_api.knowledge.dto import KnowledgeSpaceSummary


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def list_knowledge_space_summaries(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    query: str,
    page: int,
    page_size: int,
) -> tuple[list[KnowledgeSpaceSummary], int]:
    filters = [KnowledgeSpace.workspace_id == workspace_id]
    if query:
        pattern = f"%{_escape_like(query)}%"
        filters.append(
            or_(
                KnowledgeSpace.name.ilike(pattern, escape="\\"),
                KnowledgeSpace.description.ilike(pattern, escape="\\"),
            )
        )
    total = await session.scalar(select(func.count()).select_from(KnowledgeSpace).where(*filters))
    rows = (
        await session.execute(
            select(KnowledgeSpace)
            .where(*filters)
            .order_by(KnowledgeSpace.updated_at.desc(), KnowledgeSpace.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars()
    return (
        [
            KnowledgeSpaceSummary(
                id=row.id,
                name=row.name,
                description=row.description,
                knowledge_space_category_id=row.knowledge_space_category_id,
                lifecycle_status=row.lifecycle_status,
                graph_status=row.graph_status,
                updated_at=row.updated_at,
            )
            for row in rows
        ],
        total or 0,
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
