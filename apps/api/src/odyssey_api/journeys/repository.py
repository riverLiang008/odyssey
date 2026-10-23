from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from pydantic import TypeAdapter
from sqlalchemy import Select, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from odyssey_api.db.models import (
    AgentReusableTool,
    AgentVariable,
    AgentWorkflow,
    JourneyGuardrail,
    OdyJourney,
    ToolDefinition,
    WorkflowKnowledgeSpaceReference,
)
from odyssey_api.db.models import (
    AgentTemplate as AgentTemplateRow,
)
from odyssey_api.journeys.dto import (
    ActiveGuardrail,
    AgentMetadata,
    AgentSummary,
    AgentTemplate,
    AgentTemplateSnapshot,
    AgentWorkflowEditorDocument,
    CanvasLayout,
    InactiveGuardrail,
    JourneyEditorDocument,
    JourneyMetadata,
    JourneyStatus,
    JourneySummary,
    PatternConfig,
    WorkflowGraph,
)
from odyssey_api.journeys.dto import (
    AgentReusableTool as AgentReusableToolDto,
)
from odyssey_api.journeys.dto import (
    AgentVariable as AgentVariableDto,
)
from odyssey_api.journeys.guardrail_domain import GuardrailSide
from odyssey_api.journeys.workflow_domain import WorkflowKnowledgeReference

AGENT_REUSABLE_TOOL_ADAPTER = TypeAdapter(AgentReusableToolDto)


@dataclass(frozen=True)
class RoutingWorkflowRecord:
    agent_id: UUID
    revision: int
    workflow: WorkflowGraph
    layout: CanvasLayout


async def list_routing_workflows(
    session: AsyncSession,
    journey_id: UUID,
    workspace_id: UUID,
) -> list[RoutingWorkflowRecord]:
    rows = (
        (
            await session.execute(
                select(AgentWorkflow)
                .join(OdyJourney, OdyJourney.id == AgentWorkflow.ody_journey_id)
                .where(OdyJourney.id == journey_id, OdyJourney.workspace_id == workspace_id)
                .order_by(AgentWorkflow.id)
            )
        )
        .scalars()
        .all()
    )
    return [
        RoutingWorkflowRecord(
            row.id,
            row.revision,
            WorkflowGraph.model_validate(row.workflow_graph),
            CanvasLayout.model_validate(row.canvas_layout),
        )
        for row in rows
    ]


async def cas_update_routing_workflow(
    session: AsyncSession,
    *,
    journey_id: UUID,
    workspace_id: UUID,
    record: RoutingWorkflowRecord,
    workflow: WorkflowGraph,
    layout: CanvasLayout,
) -> bool:
    result = await session.execute(
        update(AgentWorkflow)
        .where(
            AgentWorkflow.id == record.agent_id,
            AgentWorkflow.ody_journey_id == journey_id,
            AgentWorkflow.revision == record.revision,
            select(OdyJourney.id)
            .where(OdyJourney.id == journey_id, OdyJourney.workspace_id == workspace_id)
            .exists(),
        )
        .values(
            workflow_graph=workflow.model_dump(mode="json", by_alias=True),
            canvas_layout=layout.model_dump(mode="json", by_alias=True),
            revision=AgentWorkflow.revision + 1,
            updated_at=func.now(),
        )
        .returning(AgentWorkflow.id)
    )
    return result.scalar_one_or_none() is not None


@dataclass(frozen=True, slots=True)
class RevisionResult:
    revision: int
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class GuardrailBindingRecord:
    side: GuardrailSide
    agent_id: UUID


def _scoped_journey_statement(journey_id: UUID, workspace_id: UUID) -> Select[tuple[OdyJourney]]:
    return select(OdyJourney).where(
        OdyJourney.id == journey_id,
        OdyJourney.workspace_id == workspace_id,
    )


async def list_journey_summaries(session: AsyncSession, workspace_id: UUID) -> list[JourneySummary]:
    statement = (
        select(OdyJourney, func.count(AgentWorkflow.id))
        .outerjoin(AgentWorkflow, AgentWorkflow.ody_journey_id == OdyJourney.id)
        .where(OdyJourney.workspace_id == workspace_id)
        .group_by(OdyJourney.id)
        .order_by(OdyJourney.updated_at.desc(), OdyJourney.id)
    )
    rows = (await session.execute(statement)).all()
    return [
        JourneySummary(
            id=journey.id,
            name=journey.name,
            description=journey.description,
            status=JourneyStatus(journey.status),
            pattern_kind=PatternConfig.model_validate(journey.pattern_config).kind,
            agent_count=agent_count,
            revision=journey.revision,
            created_at=journey.created_at,
            updated_at=journey.updated_at,
        )
        for journey, agent_count in rows
    ]


async def get_scoped_journey(
    session: AsyncSession, journey_id: UUID, workspace_id: UUID
) -> OdyJourney | None:
    result = await session.execute(_scoped_journey_statement(journey_id, workspace_id))
    return result.scalar_one_or_none()


async def get_scoped_journey_for_update(
    session: AsyncSession, journey_id: UUID, workspace_id: UUID
) -> OdyJourney | None:
    statement = _scoped_journey_statement(journey_id, workspace_id).with_for_update()
    return (await session.execute(statement)).scalar_one_or_none()


async def get_journey_document(
    session: AsyncSession, journey_id: UUID, workspace_id: UUID
) -> JourneyEditorDocument | None:
    journey = await get_scoped_journey(session, journey_id, workspace_id)
    if journey is None:
        return None
    agents: Sequence[AgentWorkflow] = (
        (
            await session.execute(
                select(AgentWorkflow)
                .where(AgentWorkflow.ody_journey_id == journey.id)
                .order_by(AgentWorkflow.created_at, AgentWorkflow.id)
            )
        )
        .scalars()
        .all()
    )
    guardrails = await list_guardrail_bindings(session, journey.id)
    guardrail_by_side = {binding.side: binding.agent_id for binding in guardrails}
    return JourneyEditorDocument(
        journey=JourneyMetadata(
            id=journey.id,
            workspace_id=journey.workspace_id,
            name=journey.name,
            description=journey.description,
            status=JourneyStatus(journey.status),
            tags=journey.tags,
            revision=journey.revision,
            created_at=journey.created_at,
            updated_at=journey.updated_at,
        ),
        pattern=PatternConfig.model_validate(journey.pattern_config),
        agents=[
            AgentSummary(
                id=agent.id,
                name=agent.name,
                description=agent.description,
                revision=agent.revision,
                updated_at=agent.updated_at,
            )
            for agent in agents
        ],
        input_guardrail=(
            ActiveGuardrail(
                state="active",
                structure="single",
                agent_id=guardrail_by_side[GuardrailSide.INPUT],
            )
            if GuardrailSide.INPUT in guardrail_by_side
            else InactiveGuardrail(state="inactive")
        ),
        output_guardrail=(
            ActiveGuardrail(
                state="active",
                structure="single",
                agent_id=guardrail_by_side[GuardrailSide.OUTPUT],
            )
            if GuardrailSide.OUTPUT in guardrail_by_side
            else InactiveGuardrail(state="inactive")
        ),
    )


async def insert_journey(
    session: AsyncSession,
    *,
    journey_id: UUID,
    workspace_id: UUID,
    name: str,
    description: str | None,
    pattern: PatternConfig,
) -> OdyJourney:
    journey = OdyJourney(
        id=journey_id,
        workspace_id=workspace_id,
        name=name,
        description=description,
        status=JourneyStatus.DRAFT.value,
        pattern_config=pattern.model_dump(mode="json", by_alias=True),
        tags=[],
        revision=1,
    )
    session.add(journey)
    await session.flush()
    await session.refresh(journey)
    return journey


async def cas_update_pattern(
    session: AsyncSession,
    *,
    journey_id: UUID,
    workspace_id: UUID,
    expected_revision: int,
    pattern: PatternConfig,
) -> RevisionResult | None:
    result = await session.execute(
        update(OdyJourney)
        .where(
            OdyJourney.id == journey_id,
            OdyJourney.workspace_id == workspace_id,
            OdyJourney.revision == expected_revision,
        )
        .values(
            pattern_config=pattern.model_dump(mode="json", by_alias=True),
            revision=OdyJourney.revision + 1,
            updated_at=func.now(),
        )
        .returning(OdyJourney.revision, OdyJourney.updated_at)
    )
    row = result.one_or_none()
    return None if row is None else RevisionResult(revision=row.revision, updated_at=row.updated_at)


async def cas_advance_journey_revision(
    session: AsyncSession,
    *,
    journey_id: UUID,
    workspace_id: UUID,
    expected_revision: int,
) -> RevisionResult | None:
    result = await session.execute(
        update(OdyJourney)
        .where(
            OdyJourney.id == journey_id,
            OdyJourney.workspace_id == workspace_id,
            OdyJourney.revision == expected_revision,
        )
        .values(revision=OdyJourney.revision + 1, updated_at=func.now())
        .returning(OdyJourney.revision, OdyJourney.updated_at)
    )
    row = result.one_or_none()
    return None if row is None else RevisionResult(revision=row.revision, updated_at=row.updated_at)


async def list_guardrail_bindings(
    session: AsyncSession, journey_id: UUID
) -> list[GuardrailBindingRecord]:
    rows = (
        await session.execute(
            select(JourneyGuardrail.side, JourneyGuardrail.agent_workflow_id)
            .where(JourneyGuardrail.ody_journey_id == journey_id)
            .order_by(JourneyGuardrail.side)
        )
    ).all()
    return [
        GuardrailBindingRecord(side=GuardrailSide(row.side), agent_id=row.agent_workflow_id)
        for row in rows
    ]


async def insert_guardrail_binding(
    session: AsyncSession,
    *,
    journey_id: UUID,
    side: GuardrailSide,
    agent_id: UUID,
) -> None:
    session.add(
        JourneyGuardrail(
            ody_journey_id=journey_id,
            side=side.value,
            agent_workflow_id=agent_id,
            structure="single",
        )
    )
    await session.flush()


async def delete_guardrail_binding(
    session: AsyncSession,
    *,
    journey_id: UUID,
    side: GuardrailSide,
    expected_agent_id: UUID,
) -> bool:
    result = await session.execute(
        delete(JourneyGuardrail)
        .where(
            JourneyGuardrail.ody_journey_id == journey_id,
            JourneyGuardrail.side == side.value,
            JourneyGuardrail.agent_workflow_id == expected_agent_id,
        )
        .returning(JourneyGuardrail.agent_workflow_id)
    )
    return result.scalar_one_or_none() is not None


async def cas_delete_journey(
    session: AsyncSession,
    *,
    journey_id: UUID,
    workspace_id: UUID,
    expected_revision: int,
) -> bool:
    result = await session.execute(
        delete(OdyJourney)
        .where(
            OdyJourney.id == journey_id,
            OdyJourney.workspace_id == workspace_id,
            OdyJourney.revision == expected_revision,
        )
        .returning(OdyJourney.id)
    )
    return result.scalar_one_or_none() is not None


async def get_current_revision(
    session: AsyncSession, journey_id: UUID, workspace_id: UUID
) -> int | None:
    return (
        await session.execute(
            select(OdyJourney.revision).where(
                OdyJourney.id == journey_id,
                OdyJourney.workspace_id == workspace_id,
            )
        )
    ).scalar_one_or_none()


async def list_agent_names(session: AsyncSession, journey_id: UUID) -> list[str]:
    return list(
        (
            await session.execute(
                select(AgentWorkflow.name)
                .where(AgentWorkflow.ody_journey_id == journey_id)
                .order_by(AgentWorkflow.name)
            )
        ).scalars()
    )


async def insert_agent_workflow(
    session: AsyncSession,
    *,
    agent_id: UUID,
    journey_id: UUID,
    name: str,
    normalized_name: str,
    workflow: WorkflowGraph,
    layout: CanvasLayout,
) -> AgentWorkflow:
    agent = AgentWorkflow(
        id=agent_id,
        ody_journey_id=journey_id,
        name=name,
        normalized_name=normalized_name,
        description=None,
        workflow_graph=workflow.model_dump(mode="json", by_alias=True),
        canvas_layout=layout.model_dump(mode="json", by_alias=True),
        revision=1,
    )
    session.add(agent)
    await session.flush()
    await session.refresh(agent)
    return agent


async def insert_agent_children(
    session: AsyncSession,
    *,
    agent_id: UUID,
    variables: list[AgentVariableDto],
    reusable_tools: list[AgentReusableToolDto],
) -> None:
    session.add_all(
        [
            AgentVariable(
                id=item.id,
                agent_workflow_id=agent_id,
                key=item.key,
                display_name=item.display_name,
                description=item.description,
                data_type=item.data_type,
                ownership=item.ownership,
                default_value=item.default_value,
                read_only=item.read_only,
            )
            for item in variables
        ]
        + [
            AgentReusableTool(
                id=item.id,
                agent_workflow_id=agent_id,
                source_template_id=item.source_template_id,
                kind=item.kind,
                label=item.name,
                configuration=item.configuration.model_dump(mode="json", by_alias=True),
                input_bindings=[
                    binding.model_dump(mode="json", by_alias=True)
                    for binding in item.input_bindings
                ],
                output_mapping=(
                    item.output_binding.model_dump(mode="json", by_alias=True)
                    if item.output_binding is not None
                    else None
                ),
                failure_behavior={},
            )
            for item in reusable_tools
        ]
    )
    await session.flush()


async def get_agent_workflow_document(
    session: AsyncSession,
    *,
    journey_id: UUID,
    agent_id: UUID,
    workspace_id: UUID,
) -> AgentWorkflowEditorDocument | None:
    agent = (
        await session.execute(
            select(AgentWorkflow)
            .join(OdyJourney, OdyJourney.id == AgentWorkflow.ody_journey_id)
            .where(
                AgentWorkflow.id == agent_id,
                AgentWorkflow.ody_journey_id == journey_id,
                OdyJourney.workspace_id == workspace_id,
            )
        )
    ).scalar_one_or_none()
    if agent is None:
        return None
    variables = list(
        (
            await session.execute(
                select(AgentVariable)
                .where(AgentVariable.agent_workflow_id == agent.id)
                .order_by(AgentVariable.created_at, AgentVariable.id)
            )
        ).scalars()
    )
    reusable_tools = list(
        (
            await session.execute(
                select(AgentReusableTool)
                .where(AgentReusableTool.agent_workflow_id == agent.id)
                .order_by(AgentReusableTool.created_at, AgentReusableTool.id)
            )
        ).scalars()
    )
    return AgentWorkflowEditorDocument(
        agent=AgentMetadata(
            id=agent.id,
            journey_id=agent.ody_journey_id,
            name=agent.name,
            description=agent.description,
            revision=agent.revision,
            created_at=agent.created_at,
            updated_at=agent.updated_at,
        ),
        workflow=WorkflowGraph.model_validate(agent.workflow_graph),
        layout=CanvasLayout.model_validate(agent.canvas_layout),
        variables=[
            AgentVariableDto(
                id=variable.id,
                key=variable.key,
                display_name=variable.display_name,
                description=variable.description,
                data_type=variable.data_type,
                ownership=variable.ownership,
                default_value=variable.default_value,
                read_only=variable.read_only,
            )
            for variable in variables
        ],
        reusable_tools=[
            AGENT_REUSABLE_TOOL_ADAPTER.validate_python(
                {
                    "id": tool.id,
                    "name": tool.label or tool.kind,
                    "sourceTemplateId": tool.source_template_id,
                    "kind": tool.kind,
                    "configuration": tool.configuration,
                    "inputBindings": tool.input_bindings,
                    "outputBinding": tool.output_mapping,
                }
            )
            for tool in reusable_tools
        ],
    )


async def cas_save_agent_workflow(
    session: AsyncSession,
    *,
    journey_id: UUID,
    agent_id: UUID,
    workspace_id: UUID,
    expected_revision: int,
    workflow: WorkflowGraph,
    layout: CanvasLayout,
    variables: list[AgentVariableDto],
    reusable_tools: list[AgentReusableToolDto],
) -> RevisionResult | None:
    result = await session.execute(
        update(AgentWorkflow)
        .where(
            AgentWorkflow.id == agent_id,
            AgentWorkflow.ody_journey_id == journey_id,
            AgentWorkflow.revision == expected_revision,
            select(OdyJourney.id)
            .where(
                OdyJourney.id == journey_id,
                OdyJourney.workspace_id == workspace_id,
            )
            .exists(),
        )
        .values(
            workflow_graph=workflow.model_dump(mode="json", by_alias=True),
            canvas_layout=layout.model_dump(mode="json", by_alias=True),
            revision=AgentWorkflow.revision + 1,
            updated_at=func.now(),
        )
        .returning(AgentWorkflow.revision, AgentWorkflow.updated_at)
    )
    row = result.one_or_none()
    if row is None:
        return None
    await session.execute(delete(AgentVariable).where(AgentVariable.agent_workflow_id == agent_id))
    await session.execute(
        delete(AgentReusableTool).where(AgentReusableTool.agent_workflow_id == agent_id)
    )
    session.add_all(
        [
            AgentVariable(
                id=item.id,
                agent_workflow_id=agent_id,
                key=item.key,
                display_name=item.display_name,
                description=item.description,
                data_type=item.data_type,
                ownership=item.ownership,
                default_value=item.default_value,
                read_only=item.read_only,
            )
            for item in variables
        ]
        + [
            AgentReusableTool(
                id=item.id,
                agent_workflow_id=agent_id,
                source_template_id=item.source_template_id,
                kind=item.kind,
                label=item.name,
                configuration=item.configuration.model_dump(mode="json", by_alias=True),
                input_bindings=[
                    binding.model_dump(mode="json", by_alias=True)
                    for binding in item.input_bindings
                ],
                output_mapping=(
                    item.output_binding.model_dump(mode="json", by_alias=True)
                    if item.output_binding is not None
                    else None
                ),
                failure_behavior={},
            )
            for item in reusable_tools
        ]
    )
    await session.flush()
    return RevisionResult(revision=row.revision, updated_at=row.updated_at)


async def synchronize_workflow_knowledge_references(
    session: AsyncSession,
    *,
    agent_workflow_id: UUID,
    references: list[WorkflowKnowledgeReference],
) -> None:
    await session.execute(
        delete(WorkflowKnowledgeSpaceReference).where(
            WorkflowKnowledgeSpaceReference.agent_workflow_id == agent_workflow_id
        )
    )
    session.add_all(
        [
            WorkflowKnowledgeSpaceReference(
                agent_workflow_id=agent_workflow_id,
                knowledge_space_id=reference.knowledge_space_id,
                owner_kind=reference.owner_kind.value,
                owner_id=reference.owner_id,
            )
            for reference in references
        ]
    )
    await session.flush()


async def get_agent_revision(
    session: AsyncSession, journey_id: UUID, agent_id: UUID, workspace_id: UUID
) -> int | None:
    return (
        await session.execute(
            select(AgentWorkflow.revision)
            .join(OdyJourney, OdyJourney.id == AgentWorkflow.ody_journey_id)
            .where(
                AgentWorkflow.id == agent_id,
                AgentWorkflow.ody_journey_id == journey_id,
                OdyJourney.workspace_id == workspace_id,
            )
        )
    ).scalar_one_or_none()


async def get_available_tool_definition_kinds(
    session: AsyncSession, requested_kinds: set[str]
) -> set[str]:
    if not requested_kinds:
        return set()
    return set(
        (
            await session.scalars(
                select(ToolDefinition.kind).where(ToolDefinition.kind.in_(requested_kinds))
            )
        ).all()
    )


def _template_document(row: AgentTemplateRow) -> AgentTemplate:
    return AgentTemplate(
        schema_version="1.0.0",
        id=row.id,
        name=row.name,
        description=row.description,
        source=row.source,
        owner_workspace_id=row.workspace_id,
        source_template_id=row.source_template_id,
        visibility=row.visibility,
        publication_status=row.publication_status,
        dependencies=row.dependencies,
        snapshot=AgentTemplateSnapshot.model_validate(row.snapshot),
        published_at=row.published_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def list_agent_templates(session: AsyncSession, workspace_id: UUID) -> list[AgentTemplate]:
    rows = list(
        (
            await session.execute(
                select(AgentTemplateRow)
                .where(
                    (AgentTemplateRow.workspace_id == workspace_id)
                    | (
                        (AgentTemplateRow.visibility == "public")
                        & (AgentTemplateRow.publication_status == "published")
                    )
                )
                .order_by(AgentTemplateRow.updated_at.desc(), AgentTemplateRow.id)
            )
        ).scalars()
    )
    return [_template_document(row) for row in rows]


async def get_visible_agent_template(
    session: AsyncSession, template_id: UUID, workspace_id: UUID
) -> AgentTemplate | None:
    row = (
        await session.execute(
            select(AgentTemplateRow).where(
                AgentTemplateRow.id == template_id,
                (AgentTemplateRow.workspace_id == workspace_id)
                | (
                    (AgentTemplateRow.visibility == "public")
                    & (AgentTemplateRow.publication_status == "published")
                ),
            )
        )
    ).scalar_one_or_none()
    return None if row is None else _template_document(row)


async def insert_agent_template(
    session: AsyncSession,
    *,
    template_id: UUID,
    workspace_id: UUID,
    name: str,
    description: str | None,
    snapshot: AgentTemplateSnapshot,
) -> AgentTemplate:
    row = AgentTemplateRow(
        id=template_id,
        workspace_id=workspace_id,
        template_key=None,
        source="user",
        visibility="private",
        publication_status="draft",
        name=name,
        description=description,
        dependencies=[],
        tags=[],
        revision=1,
        published_at=None,
        source_template_id=None,
        snapshot=snapshot.model_dump(mode="json", by_alias=True),
    )
    session.add(row)
    await session.flush()
    await session.refresh(row)
    return _template_document(row)


async def delete_agent_workflow(session: AsyncSession, agent_id: UUID) -> None:
    await session.execute(delete(AgentWorkflow).where(AgentWorkflow.id == agent_id))
