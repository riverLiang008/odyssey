from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from odyssey_api.db.session import get_session
from odyssey_api.dependencies.workspace import CurrentWorkspace, get_current_workspace
from odyssey_api.errors.openapi import documented_responses
from odyssey_api.tools.dto import ListToolDefinitionsQuery, ToolDefinitionResponse
from odyssey_api.tools.service import list_tool_definitions

router = APIRouter(prefix="/tool-definitions", tags=["tool-definitions"])


@router.get(
    "", response_model=list[ToolDefinitionResponse], responses=documented_responses(),
    operation_id="listToolDefinitions",
)
async def list_tool_definitions_route(
    query: Annotated[ListToolDefinitionsQuery, Query()],
    session: Annotated[AsyncSession, Depends(get_session)],
    workspace: Annotated[CurrentWorkspace, Depends(get_current_workspace)],
) -> list[ToolDefinitionResponse]:
    return await list_tool_definitions(session, workspace.id)
