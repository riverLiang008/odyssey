from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from odyssey_api.db.session import get_session
from odyssey_api.dependencies.workspace import CurrentWorkspace, get_current_workspace
from odyssey_api.errors.openapi import documented_responses
from odyssey_api.journeys.dto import AgentTemplate
from odyssey_api.journeys.service import list_agent_templates, load_agent_template

router = APIRouter(prefix="/agent-templates", tags=["agent-templates"])
SessionDependency = Annotated[AsyncSession, Depends(get_session)]
WorkspaceDependency = Annotated[CurrentWorkspace, Depends(get_current_workspace)]


@router.get("", response_model=list[AgentTemplate], operation_id="listAgentTemplates")
async def list_agent_templates_route(
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> list[AgentTemplate]:
    return await list_agent_templates(session, workspace.id)


@router.get(
    "/{template_id}",
    response_model=AgentTemplate,
    operation_id="loadAgentTemplate",
    responses=documented_responses(not_found=True),
)
async def load_agent_template_route(
    template_id: UUID,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> AgentTemplate:
    return await load_agent_template(session, template_id, workspace.id)
