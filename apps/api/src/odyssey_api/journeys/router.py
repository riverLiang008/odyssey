import re
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from odyssey_api.db.session import get_session
from odyssey_api.dependencies.workspace import CurrentWorkspace, get_current_workspace
from odyssey_api.errors import ApplicationError, ErrorCode
from odyssey_api.errors.openapi import documented_responses
from odyssey_api.journeys.dto import (
    AddGuardrailRequest,
    AddGuardrailResponse,
    AgentTemplate,
    AgentWorkflowEditorDocument,
    CreateJourneyRequest,
    CreateMinimumAgentRequest,
    CreateMinimumAgentResponse,
    InstantiateAgentTemplateRequest,
    InstantiateAgentTemplateResponse,
    JourneyEditorDocument,
    JourneySummary,
    RemoveGuardrailRequest,
    RemoveOccupiedSlotRequest,
    RemoveOccupiedSlotResponse,
    SaveAgentAsTemplateRequest,
    SaveAgentWorkflowRequest,
    SaveJourneyRequest,
)
from odyssey_api.journeys.guardrail_domain import GuardrailSide
from odyssey_api.journeys.service import (
    add_guardrail,
    create_journey,
    create_minimum_agent_and_assign,
    delete_journey,
    instantiate_agent_template,
    list_journeys,
    load_agent_workflow,
    load_journey,
    remove_guardrail,
    remove_occupied_slot,
    save_agent_as_template,
    save_agent_workflow,
    save_journey_pattern,
)

router = APIRouter(prefix="/journeys", tags=["journeys"])

SessionDependency = Annotated[AsyncSession, Depends(get_session)]
WorkspaceDependency = Annotated[CurrentWorkspace, Depends(get_current_workspace)]


@router.post(
    "",
    response_model=JourneyEditorDocument,
    status_code=status.HTTP_201_CREATED,
    summary="Create a Journey",
    description="Create a draft Journey from a built-in Pattern template.",
    operation_id="createJourney",
    responses=documented_responses(),
)
async def create_journey_route(
    request: CreateJourneyRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> JourneyEditorDocument:
    return await create_journey(session, workspace.id, request)


@router.get(
    "",
    response_model=list[JourneySummary],
    summary="List Journeys",
    description="List Journeys visible in the current Workspace in stable update order.",
    operation_id="listJourneys",
    responses=documented_responses(),
)
async def list_journeys_route(
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> list[JourneySummary]:
    return await list_journeys(session, workspace.id)


@router.get(
    "/{journey_id}",
    response_model=JourneyEditorDocument,
    summary="Load a Journey",
    description="Load the canonical Journey editor document for the current Workspace.",
    operation_id="loadJourney",
    responses=documented_responses(not_found=True),
)
async def load_journey_route(
    journey_id: UUID,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> JourneyEditorDocument:
    return await load_journey(session, journey_id, workspace.id)


@router.put(
    "/{journey_id}",
    response_model=JourneyEditorDocument,
    summary="Save a Journey Pattern",
    description=(
        "Replace the Journey Pattern using optimistic concurrency. "
        "`expectedRevision` must match the persisted Journey revision."
    ),
    operation_id="saveJourneyPattern",
    responses=documented_responses(not_found=True, conflict=True),
)
async def save_journey_route(
    journey_id: UUID,
    request: SaveJourneyRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> JourneyEditorDocument:
    return await save_journey_pattern(session, journey_id, workspace.id, request)


def parse_revision_etag(value: str) -> int:
    match = re.fullmatch(r'"([1-9][0-9]*)"', value)
    if match is None:
        raise ApplicationError(
            ErrorCode.VALIDATION_FAILED,
            details={"issues": [{"path": ["header", "If-Match"], "code": "INVALID_ETAG"}]},
        )
    return int(match.group(1))


@router.get(
    "/{journey_id}/agents/{agent_id}",
    response_model=AgentWorkflowEditorDocument,
    summary="Load an Agent workflow",
    description="Load an Agent workflow that belongs to the selected Journey and Workspace.",
    operation_id="loadAgentWorkflow",
    responses=documented_responses(not_found=True),
)
async def load_agent_workflow_route(
    journey_id: UUID,
    agent_id: UUID,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> AgentWorkflowEditorDocument:
    return await load_agent_workflow(session, journey_id, agent_id, workspace.id)


@router.put(
    "/{journey_id}/agents/{agent_id}",
    response_model=AgentWorkflowEditorDocument,
    summary="Save an Agent workflow",
    operation_id="saveAgentWorkflow",
    responses=documented_responses(not_found=True, conflict=True),
)
async def save_agent_workflow_route(
    journey_id: UUID,
    agent_id: UUID,
    request: SaveAgentWorkflowRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> AgentWorkflowEditorDocument:
    return await save_agent_workflow(session, journey_id, agent_id, workspace.id, request)


@router.post(
    "/{journey_id}/agents/{agent_id}/commands/save-as-template",
    response_model=AgentTemplate,
    status_code=status.HTTP_201_CREATED,
    summary="Save an Agent as a Template",
    operation_id="saveAgentAsTemplate",
    responses=documented_responses(not_found=True),
)
async def save_agent_as_template_route(
    journey_id: UUID,
    agent_id: UUID,
    request: SaveAgentAsTemplateRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> AgentTemplate:
    return await save_agent_as_template(session, journey_id, agent_id, workspace.id, request)


@router.post(
    "/{journey_id}/slots/{slot_id}/agent",
    response_model=CreateMinimumAgentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create and assign a minimal Agent",
    description=(
        "Atomically create a minimal Agent workflow, assign it to an empty Pattern slot, "
        "and advance the Journey revision."
    ),
    operation_id="createMinimumAgent",
    responses=documented_responses(not_found=True, conflict=True),
)
async def create_minimum_agent_route(
    journey_id: UUID,
    slot_id: UUID,
    request: CreateMinimumAgentRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> CreateMinimumAgentResponse:
    return await create_minimum_agent_and_assign(
        session,
        journey_id=journey_id,
        slot_id=slot_id,
        workspace_id=workspace.id,
        expected_revision=request.expected_revision,
    )


@router.post(
    "/{journey_id}/guardrails/{side}/commands/add",
    response_model=AddGuardrailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an optional Guardrail",
    description=(
        "Atomically create a fixed single-Agent Guardrail and minimal workflow, bind it to "
        "the requested side, and advance the Journey revision."
    ),
    operation_id="addGuardrail",
    responses=documented_responses(not_found=True, conflict=True),
)
async def add_guardrail_route(
    journey_id: UUID,
    side: GuardrailSide,
    request: AddGuardrailRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> AddGuardrailResponse:
    return await add_guardrail(
        session,
        journey_id=journey_id,
        side=side,
        workspace_id=workspace.id,
        expected_revision=request.expected_revision,
    )


@router.post(
    "/{journey_id}/guardrails/{side}/commands/remove",
    response_model=JourneyEditorDocument,
    summary="Remove an optional Guardrail",
    description=(
        "Atomically remove a Guardrail binding, permanently delete its owned Agent workflow, "
        "and advance the Journey revision."
    ),
    operation_id="removeGuardrail",
    responses=documented_responses(not_found=True, conflict=True),
)
async def remove_guardrail_route(
    journey_id: UUID,
    side: GuardrailSide,
    request: RemoveGuardrailRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> JourneyEditorDocument:
    return await remove_guardrail(
        session,
        journey_id=journey_id,
        side=side,
        workspace_id=workspace.id,
        expected_revision=request.expected_revision,
        expected_agent_id=request.expected_agent_id,
    )


@router.post(
    "/{journey_id}/slots/{slot_id}/agent-template/{template_id}",
    response_model=InstantiateAgentTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Instantiate an Agent Template into a Slot",
    operation_id="instantiateAgentTemplate",
    responses=documented_responses(not_found=True, conflict=True),
)
async def instantiate_agent_template_route(
    journey_id: UUID,
    slot_id: UUID,
    template_id: UUID,
    request: InstantiateAgentTemplateRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> InstantiateAgentTemplateResponse:
    return await instantiate_agent_template(
        session,
        template_id=template_id,
        journey_id=journey_id,
        slot_id=slot_id,
        workspace_id=workspace.id,
        expected_revision=request.expected_revision,
        end_assignments=request.end_assignments,
    )


@router.post(
    "/{journey_id}/slots/{slot_id}/commands/remove",
    response_model=RemoveOccupiedSlotResponse,
    summary="Remove an occupied Slot atomically",
    operation_id="removeOccupiedSlot",
    responses=documented_responses(not_found=True, conflict=True),
)
async def remove_occupied_slot_route(
    journey_id: UUID,
    slot_id: UUID,
    request: RemoveOccupiedSlotRequest,
    session: SessionDependency,
    workspace: WorkspaceDependency,
) -> RemoveOccupiedSlotResponse:
    return await remove_occupied_slot(
        session,
        journey_id=journey_id,
        slot_id=slot_id,
        workspace_id=workspace.id,
        request=request,
    )


@router.delete(
    "/{journey_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a Journey",
    description=(
        'Delete a Journey using a strong `If-Match` ETag such as `"3"`. '
        "The operation is scoped to the current Workspace."
    ),
    operation_id="deleteJourney",
    responses=documented_responses(not_found=True, conflict=True),
)
async def delete_journey_route(
    journey_id: UUID,
    session: SessionDependency,
    workspace: WorkspaceDependency,
    if_match: Annotated[str, Header(alias="If-Match")],
) -> Response:
    await delete_journey(session, journey_id, workspace.id, parse_revision_etag(if_match))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
