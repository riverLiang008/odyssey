from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from odyssey_api.tools.dto import ToolDefinitionResponse
from odyssey_api.tools.repository import list_builtin_definitions


async def list_tool_definitions(
    session: AsyncSession, workspace_id: UUID
) -> list[ToolDefinitionResponse]:
    return await list_builtin_definitions(session, workspace_id)
