from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from odyssey_api.db.models import ToolDefinition, Workspace
from odyssey_api.tools.dto import ToolDefinitionResponse


async def list_builtin_definitions(
    session: AsyncSession, workspace_id: UUID
) -> list[ToolDefinitionResponse]:
    # Definitions are global; access still requires an existing trusted Workspace.
    rows = await session.scalars(
        select(ToolDefinition)
        .where(
            ToolDefinition.source == "built_in",
            select(Workspace.id).where(Workspace.id == workspace_id).exists(),
        )
        .order_by(ToolDefinition.category, ToolDefinition.name, ToolDefinition.kind)
    )
    return [
        ToolDefinitionResponse(
            id=row.id,
            kind=row.kind,
            source=row.source,
            name=row.name,
            category=row.category,
            description=row.description,
            configuration_schema=row.configuration_schema,
            input_schema=row.input_schema,
            output_schema=row.output_schema,
        )
        for row in rows
    ]
