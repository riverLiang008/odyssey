import copy
import unicodedata
from collections.abc import Callable, Sequence
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from odyssey_api.errors import ApplicationError, ErrorCode
from odyssey_api.journeys import repository
from odyssey_api.journeys.dto import (
    AddGuardrailResponse,
    AgentTemplate,
    AgentTemplateSnapshot,
    AgentWorkflowEditorDocument,
    ApiRequestConfiguration,
    ApiRequestToolStep,
    BranchNode,
    CreateJourneyRequest,
    CreateMinimumAgentResponse,
    EndNode,
    FormDataApiRequestBody,
    InstantiateAgentTemplateResponse,
    JourneyEditorDocument,
    JourneySummary,
    LoopBodyNode,
    LoopNode,
    PatternConfig,
    RemoveOccupiedSlotRequest,
    RemoveOccupiedSlotResponse,
    ReusableApiTool,
    RoutingConfirmation,
    RoutingImpact,
    SaveAgentAsTemplateRequest,
    SaveAgentWorkflowRequest,
    SaveJourneyRequest,
    TaskNode,
    TemplateEndAssignment,
    WorkflowNode,
)
from odyssey_api.journeys.end_routing import (
    EndRoutingResult,
    bind_template_exits,
    reconcile_workflow_ends,
)
from odyssey_api.journeys.guardrail_domain import GuardrailSide
from odyssey_api.journeys.pattern_domain import instantiate_pattern, remove_slot, validate_pattern
from odyssey_api.journeys.workflow_domain import (
    create_minimum_workflow,
    extract_knowledge_space_references,
)
from odyssey_api.knowledge.repository import (
    get_referenceable_knowledge_space_ids,
    get_visible_knowledge_space_ids,
)


def _validation_error(codes: list[str]) -> ApplicationError:
    return ApplicationError(
        ErrorCode.VALIDATION_FAILED,
        details={"issues": [{"path": ["pattern"], "code": code} for code in codes]},
    )


def _revision_error(expected_revision: int, current_revision: int) -> ApplicationError:
    return ApplicationError(
        ErrorCode.REVISION_CONFLICT,
        details={
            "expectedRevision": expected_revision,
            "currentRevision": current_revision,
        },
    )


async def list_journeys(session: AsyncSession, workspace_id: UUID) -> list[JourneySummary]:
    return await repository.list_journey_summaries(session, workspace_id)


async def load_journey(
    session: AsyncSession, journey_id: UUID, workspace_id: UUID
) -> JourneyEditorDocument:
    document = await repository.get_journey_document(session, journey_id, workspace_id)
    if document is None:
        raise ApplicationError(ErrorCode.NOT_FOUND)
    return document


async def create_journey(
    session: AsyncSession,
    workspace_id: UUID,
    request: CreateJourneyRequest,
    *,
    id_factory: Callable[[], UUID] = uuid4,
) -> JourneyEditorDocument:
    journey_id = id_factory()
    pattern = instantiate_pattern(request.pattern_template_key, id_factory)
    async with session.begin():
        await repository.insert_journey(
            session,
            journey_id=journey_id,
            workspace_id=workspace_id,
            name=request.name.strip(),
            description=request.description,
            pattern=pattern,
        )
        document = await repository.get_journey_document(session, journey_id, workspace_id)
        if document is None:
            raise RuntimeError("Inserted Journey was not visible in its transaction")
        return document


def _validate_transition(current: PatternConfig, candidate: PatternConfig) -> None:
    if (
        current.id != candidate.id
        or current.kind is not candidate.kind
        or current.template_key is not candidate.template_key
    ):
        raise ApplicationError(
            ErrorCode.STATE_CONFLICT,
            details={"reason": "PATTERN_IMMUTABLE"},
        )
    issues = validate_pattern(candidate)
    if issues:
        raise _validation_error([issue.code.value for issue in issues])
    candidate_slots = {slot.id: slot for slot in candidate.slots}
    removed_occupied = [
        slot.id
        for slot in current.slots
        if slot.agent_id is not None and slot.id not in candidate_slots
    ]
    if removed_occupied:
        raise ApplicationError(
            ErrorCode.STATE_CONFLICT,
            details={
                "reason": "OCCUPIED_SLOT_REMOVAL_REQUIRES_COMMAND",
                "slotIds": [str(slot_id) for slot_id in removed_occupied],
            },
        )


async def _synchronize_pattern_ends(
    session: AsyncSession,
    journey_id: UUID,
    workspace_id: UUID,
    pattern: PatternConfig,
    confirmation: list[RoutingConfirmation] | None,
) -> None:
    records = await repository.list_routing_workflows(session, journey_id, workspace_id)
    assignments = {slot.agent_id: slot for slot in pattern.slots if slot.agent_id is not None}
    candidates: list[tuple[repository.RoutingWorkflowRecord, EndRoutingResult]] = []
    impact: list[RoutingImpact] = []
    for record in records:
        slot = assignments.get(record.agent_id)
        if slot is None:
            # Guardrails/unassigned Agents have no Main Execution Pattern boundary.
            continue
        result = reconcile_workflow_ends(record.workflow, record.layout, pattern, slot.id, uuid4)
        if not result.changed:
            continue
        candidates.append((record, result))
        legacy = any(
            isinstance(node, EndNode) and node.configuration.binding is None
            for node in record.workflow.nodes
        )
        if result.removed_edge_ids:
            impact.append(
                RoutingImpact(
                    agent_id=record.agent_id,
                    revision=record.revision,
                    removed_end_ids=list(result.removed_end_ids),
                    removed_edge_ids=list(result.removed_edge_ids),
                    legacy=legacy,
                )
            )
    expected = {
        (
            str(item.agent_id),
            item.revision,
            tuple(sorted(str(value) for value in item.removed_end_ids)),
            tuple(sorted(str(value) for value in item.removed_edge_ids)),
        )
        for item in impact
    }
    confirmed = {
        (
            str(item.agent_id),
            item.revision,
            tuple(sorted(str(value) for value in item.removed_end_ids)),
            tuple(sorted(str(value) for value in item.removed_edge_ids)),
        )
        for item in confirmation or []
    }
    if impact and expected != confirmed:
        raise ApplicationError(
            ErrorCode.STATE_CONFLICT,
            details={
                "reason": "END_ROUTING_CONFIRMATION_REQUIRED",
                "routingImpact": [item.model_dump(mode="json", by_alias=True) for item in impact],
            },
        )
    for record, result in candidates:
        updated = await repository.cas_update_routing_workflow(
            session,
            journey_id=journey_id,
            workspace_id=workspace_id,
            record=record,
            workflow=result.workflow,
            layout=result.layout,
        )
        if not updated:
            current = await repository.get_agent_revision(
                session, journey_id, record.agent_id, workspace_id
            )
            if current is None:
                raise ApplicationError(ErrorCode.NOT_FOUND)
            raise _revision_error(record.revision, current)


async def save_journey_pattern(
    session: AsyncSession,
    journey_id: UUID,
    workspace_id: UUID,
    request: SaveJourneyRequest,
) -> JourneyEditorDocument:
    async with session.begin():
        locked = await repository.get_scoped_journey_for_update(session, journey_id, workspace_id)
        if locked is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        current = await repository.get_journey_document(session, journey_id, workspace_id)
        if current is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if current.journey.revision != request.expected_revision:
            raise _revision_error(request.expected_revision, current.journey.revision)
        _validate_transition(current.pattern, request.pattern)
        known_agent_ids = {agent.id for agent in current.agents}
        candidate_agent_ids = {
            slot.agent_id for slot in request.pattern.slots if slot.agent_id is not None
        }
        if not candidate_agent_ids.issubset(known_agent_ids):
            raise _validation_error(["AGENT_REFERENCE_INVALID"])
        await _synchronize_pattern_ends(
            session, journey_id, workspace_id, request.pattern, request.routing_confirmation
        )
        updated = await repository.cas_update_pattern(
            session,
            journey_id=journey_id,
            workspace_id=workspace_id,
            expected_revision=request.expected_revision,
            pattern=request.pattern,
        )
        if updated is None:
            current_revision = await repository.get_current_revision(
                session, journey_id, workspace_id
            )
            if current_revision is None:
                raise ApplicationError(ErrorCode.NOT_FOUND)
            raise _revision_error(request.expected_revision, current_revision)
        document = await repository.get_journey_document(session, journey_id, workspace_id)
        if document is None:
            raise RuntimeError("Updated Journey was not visible in its transaction")
        return document


async def delete_journey(
    session: AsyncSession,
    journey_id: UUID,
    workspace_id: UUID,
    expected_revision: int,
) -> None:
    async with session.begin():
        deleted = await repository.cas_delete_journey(
            session,
            journey_id=journey_id,
            workspace_id=workspace_id,
            expected_revision=expected_revision,
        )
        if deleted:
            return
        current_revision = await repository.get_current_revision(session, journey_id, workspace_id)
        if current_revision is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        raise _revision_error(expected_revision, current_revision)


def normalize_name(value: str) -> str:
    return unicodedata.normalize("NFKC", value.strip()).casefold()


def next_default_agent_name(existing_names: list[str]) -> str:
    normalized = {normalize_name(name) for name in existing_names}
    index = 1
    while normalize_name(f"Agent {index}") in normalized:
        index += 1
    return f"Agent {index}"


def next_guardrail_agent_name(side: GuardrailSide, existing_names: list[str]) -> str:
    base = f"{side.value.title()} Guardrail"
    normalized = {normalize_name(name) for name in existing_names}
    if normalize_name(base) not in normalized:
        return base
    index = 2
    while normalize_name(f"{base} {index}") in normalized:
        index += 1
    return f"{base} {index}"


async def load_agent_workflow(
    session: AsyncSession,
    journey_id: UUID,
    agent_id: UUID,
    workspace_id: UUID,
) -> AgentWorkflowEditorDocument:
    document = await repository.get_agent_workflow_document(
        session,
        journey_id=journey_id,
        agent_id=agent_id,
        workspace_id=workspace_id,
    )
    if document is None:
        raise ApplicationError(ErrorCode.NOT_FOUND)
    return document


async def create_minimum_agent_and_assign(
    session: AsyncSession,
    *,
    journey_id: UUID,
    slot_id: UUID,
    workspace_id: UUID,
    expected_revision: int,
    id_factory: Callable[[], UUID] = uuid4,
) -> CreateMinimumAgentResponse:
    async with session.begin():
        journey = await repository.get_scoped_journey_for_update(session, journey_id, workspace_id)
        if journey is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if journey.revision != expected_revision:
            raise _revision_error(expected_revision, journey.revision)
        pattern = PatternConfig.model_validate(journey.pattern_config)
        slot = next((candidate for candidate in pattern.slots if candidate.id == slot_id), None)
        if slot is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if slot.agent_id is not None:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={
                    "reason": "SLOT_OCCUPIED",
                    "currentAgentId": str(slot.agent_id),
                },
            )
        name = next_default_agent_name(await repository.list_agent_names(session, journey_id))
        agent_id = id_factory()
        workflow, layout = create_minimum_workflow(id_factory)
        routed = reconcile_workflow_ends(workflow, layout, pattern, slot.id, id_factory)
        workflow, layout = routed.workflow, routed.layout
        await repository.insert_agent_workflow(
            session,
            agent_id=agent_id,
            journey_id=journey_id,
            name=name,
            normalized_name=normalize_name(name),
            workflow=workflow,
            layout=layout,
        )
        slot.agent_id = agent_id
        updated = await repository.cas_update_pattern(
            session,
            journey_id=journey_id,
            workspace_id=workspace_id,
            expected_revision=expected_revision,
            pattern=pattern,
        )
        if updated is None:
            current_revision = await repository.get_current_revision(
                session, journey_id, workspace_id
            )
            if current_revision is None:
                raise ApplicationError(ErrorCode.NOT_FOUND)
            raise _revision_error(expected_revision, current_revision)
        journey_document = await repository.get_journey_document(session, journey_id, workspace_id)
        agent_document = await repository.get_agent_workflow_document(
            session,
            journey_id=journey_id,
            agent_id=agent_id,
            workspace_id=workspace_id,
        )
        if journey_document is None or agent_document is None:
            raise RuntimeError("Created Agent aggregate was not visible in its transaction")
        return CreateMinimumAgentResponse(journey=journey_document, agent=agent_document)


async def add_guardrail(
    session: AsyncSession,
    *,
    journey_id: UUID,
    side: GuardrailSide,
    workspace_id: UUID,
    expected_revision: int,
    id_factory: Callable[[], UUID] = uuid4,
) -> AddGuardrailResponse:
    async with session.begin():
        journey = await repository.get_scoped_journey_for_update(session, journey_id, workspace_id)
        if journey is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if journey.revision != expected_revision:
            raise _revision_error(expected_revision, journey.revision)
        bindings = await repository.list_guardrail_bindings(session, journey_id)
        if any(binding.side is side for binding in bindings):
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={"reason": "GUARDRAIL_ALREADY_ACTIVE", "side": side.value},
            )
        if len({binding.side for binding in bindings}) != len(bindings):
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={"reason": "GUARDRAIL_STATE_INVALID"},
            )
        existing_names = await repository.list_agent_names(session, journey_id)
        name = next_guardrail_agent_name(side, existing_names)
        agent_id = id_factory()
        workflow, layout = create_minimum_workflow(id_factory)
        await repository.insert_agent_workflow(
            session,
            agent_id=agent_id,
            journey_id=journey_id,
            name=name,
            normalized_name=normalize_name(name),
            workflow=workflow,
            layout=layout,
        )
        await repository.insert_guardrail_binding(
            session, journey_id=journey_id, side=side, agent_id=agent_id
        )
        updated = await repository.cas_advance_journey_revision(
            session,
            journey_id=journey_id,
            workspace_id=workspace_id,
            expected_revision=expected_revision,
        )
        if updated is None:
            current_revision = await repository.get_current_revision(
                session, journey_id, workspace_id
            )
            if current_revision is None:
                raise ApplicationError(ErrorCode.NOT_FOUND)
            raise _revision_error(expected_revision, current_revision)
        journey_document = await repository.get_journey_document(session, journey_id, workspace_id)
        agent_document = await repository.get_agent_workflow_document(
            session,
            journey_id=journey_id,
            agent_id=agent_id,
            workspace_id=workspace_id,
        )
        if journey_document is None or agent_document is None:
            raise RuntimeError("Created Guardrail aggregate was not visible in its transaction")
        return AddGuardrailResponse(journey=journey_document, agent=agent_document)


async def remove_guardrail(
    session: AsyncSession,
    *,
    journey_id: UUID,
    side: GuardrailSide,
    workspace_id: UUID,
    expected_revision: int,
    expected_agent_id: UUID,
) -> JourneyEditorDocument:
    async with session.begin():
        journey = await repository.get_scoped_journey_for_update(session, journey_id, workspace_id)
        if journey is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if journey.revision != expected_revision:
            raise _revision_error(expected_revision, journey.revision)
        bindings = await repository.list_guardrail_bindings(session, journey_id)
        binding = next((candidate for candidate in bindings if candidate.side is side), None)
        if binding is None:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={"reason": "GUARDRAIL_ALREADY_INACTIVE", "side": side.value},
            )
        if binding.agent_id != expected_agent_id:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={
                    "reason": "GUARDRAIL_AGENT_MISMATCH",
                    "side": side.value,
                    "currentAgentId": str(binding.agent_id),
                },
            )
        deleted = await repository.delete_guardrail_binding(
            session,
            journey_id=journey_id,
            side=side,
            expected_agent_id=expected_agent_id,
        )
        if not deleted:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={"reason": "GUARDRAIL_STATE_INVALID"},
            )
        await repository.delete_agent_workflow(session, expected_agent_id)
        updated = await repository.cas_advance_journey_revision(
            session,
            journey_id=journey_id,
            workspace_id=workspace_id,
            expected_revision=expected_revision,
        )
        if updated is None:
            current_revision = await repository.get_current_revision(
                session, journey_id, workspace_id
            )
            if current_revision is None:
                raise ApplicationError(ErrorCode.NOT_FOUND)
            raise _revision_error(expected_revision, current_revision)
        document = await repository.get_journey_document(session, journey_id, workspace_id)
        if document is None:
            raise RuntimeError("Updated Guardrail aggregate was not visible in its transaction")
        return document


async def save_agent_workflow(
    session: AsyncSession,
    journey_id: UUID,
    agent_id: UUID,
    workspace_id: UUID,
    request: SaveAgentWorkflowRequest,
) -> AgentWorkflowEditorDocument:
    candidate = AgentWorkflowEditorDocument(
        agent={
            "id": agent_id,
            "journeyId": journey_id,
            "name": "candidate",
            "description": None,
            "revision": request.expected_revision,
            "createdAt": "2000-01-01T00:00:00Z",
            "updatedAt": "2000-01-01T00:00:00Z",
        },
        workflow=request.workflow,
        layout=request.layout,
        variables=request.variables,
        reusable_tools=request.reusable_tools,
    )
    del candidate
    references = extract_knowledge_space_references(request.workflow, request.reusable_tools)
    async with session.begin():
        locked = await repository.get_scoped_journey_for_update(session, journey_id, workspace_id)
        if locked is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        current_document = await repository.get_agent_workflow_document(
            session, journey_id=journey_id, agent_id=agent_id, workspace_id=workspace_id
        )
        if current_document is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if current_document.agent.revision != request.expected_revision:
            raise _revision_error(request.expected_revision, current_document.agent.revision)
        old_ends = {
            node.id: node.configuration
            for node in current_document.workflow.nodes
            if isinstance(node, EndNode)
        }
        new_ends = {
            node.id: node.configuration
            for node in request.workflow.nodes
            if isinstance(node, EndNode)
        }
        if old_ends != new_ends:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT, details={"reason": "END_BOUNDARY_IMMUTABLE"}
            )
        requested_tool_kinds = {tool.kind for tool in request.reusable_tools}
        available_tool_kinds = await repository.get_available_tool_definition_kinds(
            session, requested_tool_kinds
        )
        missing_tool_kinds = sorted(requested_tool_kinds - available_tool_kinds)
        if missing_tool_kinds:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={
                    "reason": "TOOL_DEFINITION_UNAVAILABLE",
                    "toolKinds": missing_tool_kinds,
                },
            )
        referenced_ids = {reference.knowledge_space_id for reference in references}
        visible_ids = await get_visible_knowledge_space_ids(session, workspace_id, referenced_ids)
        if visible_ids != referenced_ids:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        referenceable_ids = await get_referenceable_knowledge_space_ids(
            session, workspace_id, referenced_ids
        )
        unavailable_ids = referenced_ids - referenceable_ids
        if unavailable_ids:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT,
                details={
                    "reason": "KNOWLEDGE_SPACE_UNAVAILABLE",
                    "knowledgeSpaceIds": sorted(str(item) for item in unavailable_ids),
                },
            )
        updated = await repository.cas_save_agent_workflow(
            session,
            journey_id=journey_id,
            agent_id=agent_id,
            workspace_id=workspace_id,
            expected_revision=request.expected_revision,
            workflow=request.workflow,
            layout=request.layout,
            variables=request.variables,
            reusable_tools=request.reusable_tools,
        )
        if updated is None:
            current = await repository.get_agent_revision(
                session, journey_id, agent_id, workspace_id
            )
            if current is None:
                raise ApplicationError(ErrorCode.NOT_FOUND)
            raise _revision_error(request.expected_revision, current)
        await repository.synchronize_workflow_knowledge_references(
            session, agent_workflow_id=agent_id, references=references
        )
        document = await repository.get_agent_workflow_document(
            session, journey_id=journey_id, agent_id=agent_id, workspace_id=workspace_id
        )
        if document is None:
            raise RuntimeError("Saved Agent was not visible in its transaction")
        return document


async def list_agent_templates(session: AsyncSession, workspace_id: UUID) -> list[AgentTemplate]:
    return await repository.list_agent_templates(session, workspace_id)


async def load_agent_template(
    session: AsyncSession, template_id: UUID, workspace_id: UUID
) -> AgentTemplate:
    template = await repository.get_visible_agent_template(session, template_id, workspace_id)
    if template is None:
        raise ApplicationError(ErrorCode.NOT_FOUND)
    return template


async def _save_agent_as_template_in_transaction(
    session: AsyncSession,
    *,
    journey_id: UUID,
    agent_id: UUID,
    workspace_id: UUID,
    request: SaveAgentAsTemplateRequest,
    id_factory: Callable[[], UUID],
) -> AgentTemplate:
    document = await repository.get_agent_workflow_document(
        session, journey_id=journey_id, agent_id=agent_id, workspace_id=workspace_id
    )
    if document is None:
        raise ApplicationError(ErrorCode.NOT_FOUND)
    snapshot = AgentTemplateSnapshot(
        workflow=copy.deepcopy(document.workflow),
        layout=copy.deepcopy(document.layout),
        variables=copy.deepcopy(document.variables),
        reusable_tools=copy.deepcopy(document.reusable_tools),
    )
    source_journey = await repository.get_scoped_journey(session, journey_id, workspace_id)
    source_pattern = (
        PatternConfig.model_validate(source_journey.pattern_config) if source_journey else None
    )
    for node in snapshot.workflow.nodes:
        if isinstance(node, EndNode):
            binding = node.configuration.binding
            if binding and source_pattern:
                if binding.target.type == "slot":
                    target_slot = next(
                        (
                            slot
                            for slot in source_pattern.slots
                            if slot.id == binding.target.slot_id
                        ),
                        None,
                    )
                    node.name = f"End → {target_slot.label}" if target_slot else "End"
                else:
                    node.name = "Complete Journey"
            node.configuration.binding = None
    return await repository.insert_agent_template(
        session,
        template_id=id_factory(),
        workspace_id=workspace_id,
        name=request.name.strip(),
        description=request.description,
        snapshot=snapshot,
    )


async def save_agent_as_template(
    session: AsyncSession,
    journey_id: UUID,
    agent_id: UUID,
    workspace_id: UUID,
    request: SaveAgentAsTemplateRequest,
    *,
    id_factory: Callable[[], UUID] = uuid4,
) -> AgentTemplate:
    async with session.begin():
        return await _save_agent_as_template_in_transaction(
            session,
            journey_id=journey_id,
            agent_id=agent_id,
            workspace_id=workspace_id,
            request=request,
            id_factory=id_factory,
        )


def _remap_template(
    snapshot: AgentTemplateSnapshot, id_factory: Callable[[], UUID]
) -> AgentTemplateSnapshot:
    data = snapshot.model_dump(mode="json", by_alias=True)
    owned = {str(node.id) for node in snapshot.workflow.nodes}
    owned.update(str(edge.id) for edge in snapshot.workflow.edges)
    owned.update(str(item.id) for item in snapshot.variables)
    owned.update(str(item.id) for item in snapshot.reusable_tools)

    def collect_api_ids(configuration: ApiRequestConfiguration) -> None:
        owned.update(str(header.id) for header in configuration.headers)
        if isinstance(configuration.body, FormDataApiRequestBody):
            owned.update(str(entry.id) for entry in configuration.body.entries)

    def collect_nodes(nodes: Sequence[WorkflowNode | LoopBodyNode]) -> None:
        for node in nodes:
            owned.add(str(node.id))
            if isinstance(node, BranchNode):
                owned.add(str(node.configuration.default_case.id))
                for case in node.configuration.cases:
                    owned.add(str(case.id))
                    owned.update(str(condition.id) for condition in case.conditions)
            elif isinstance(node, TaskNode):
                owned.update(str(variable.id) for variable in node.configuration.local_variables)
                for step in node.configuration.steps:
                    owned.add(str(step.id))
                    if isinstance(step, ApiRequestToolStep):
                        collect_api_ids(step.configuration)
            elif isinstance(node, LoopNode):
                owned.update(str(edge.id) for edge in node.configuration.body.graph.edges)
                collect_nodes(node.configuration.body.graph.nodes)

    collect_nodes(snapshot.workflow.nodes)
    for tool in snapshot.reusable_tools:
        if isinstance(tool, ReusableApiTool):
            collect_api_ids(tool.configuration)
    mapping = {value: str(id_factory()) for value in sorted(owned)}

    def remap(value: object) -> object:
        if isinstance(value, str):
            return mapping.get(value, value)
        if isinstance(value, list):
            return [remap(item) for item in value]
        if isinstance(value, dict):
            return {key: remap(item) for key, item in value.items()}
        return value

    return AgentTemplateSnapshot.model_validate(remap(data))


async def instantiate_agent_template(
    session: AsyncSession,
    *,
    template_id: UUID,
    journey_id: UUID,
    slot_id: UUID,
    workspace_id: UUID,
    expected_revision: int,
    end_assignments: list[TemplateEndAssignment] | None = None,
    id_factory: Callable[[], UUID] = uuid4,
) -> InstantiateAgentTemplateResponse:
    async with session.begin():
        template = await repository.get_visible_agent_template(session, template_id, workspace_id)
        if template is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        journey = await repository.get_scoped_journey_for_update(session, journey_id, workspace_id)
        if journey is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if journey.revision != expected_revision:
            raise _revision_error(expected_revision, journey.revision)
        pattern = PatternConfig.model_validate(journey.pattern_config)
        slot = next((item for item in pattern.slots if item.id == slot_id), None)
        if slot is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if slot.agent_id is not None:
            raise ApplicationError(ErrorCode.STATE_CONFLICT, details={"reason": "SLOT_OCCUPIED"})
        prepared = bind_template_exits(template.snapshot, pattern, slot_id, end_assignments)
        snapshot = _remap_template(prepared, id_factory)
        routed = reconcile_workflow_ends(
            snapshot.workflow, snapshot.layout, pattern, slot_id, id_factory
        )
        snapshot.workflow, snapshot.layout = routed.workflow, routed.layout
        agent_id = id_factory()
        name = next_default_agent_name(await repository.list_agent_names(session, journey_id))
        await repository.insert_agent_workflow(
            session,
            agent_id=agent_id,
            journey_id=journey_id,
            name=name,
            normalized_name=normalize_name(name),
            workflow=snapshot.workflow,
            layout=snapshot.layout,
        )
        await repository.insert_agent_children(
            session,
            agent_id=agent_id,
            variables=snapshot.variables,
            reusable_tools=snapshot.reusable_tools,
        )
        slot.agent_id = agent_id
        updated = await repository.cas_update_pattern(
            session,
            journey_id=journey_id,
            workspace_id=workspace_id,
            expected_revision=expected_revision,
            pattern=pattern,
        )
        if updated is None:
            current = await repository.get_current_revision(session, journey_id, workspace_id)
            raise _revision_error(expected_revision, current or expected_revision)
        journey_document = await repository.get_journey_document(session, journey_id, workspace_id)
        agent_document = await repository.get_agent_workflow_document(
            session, journey_id=journey_id, agent_id=agent_id, workspace_id=workspace_id
        )
        if journey_document is None or agent_document is None:
            raise RuntimeError("Instantiated Agent was not visible in its transaction")
        return InstantiateAgentTemplateResponse(journey=journey_document, agent=agent_document)


async def remove_occupied_slot(
    session: AsyncSession,
    *,
    journey_id: UUID,
    slot_id: UUID,
    workspace_id: UUID,
    request: RemoveOccupiedSlotRequest,
    id_factory: Callable[[], UUID] = uuid4,
) -> RemoveOccupiedSlotResponse:
    async with session.begin():
        journey = await repository.get_scoped_journey_for_update(session, journey_id, workspace_id)
        if journey is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if journey.revision != request.expected_revision:
            raise _revision_error(request.expected_revision, journey.revision)
        pattern = PatternConfig.model_validate(journey.pattern_config)
        slot = next((item for item in pattern.slots if item.id == slot_id), None)
        if slot is None:
            raise ApplicationError(ErrorCode.NOT_FOUND)
        if slot.agent_id != request.expected_agent_id:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT, details={"reason": "SLOT_AGENT_CHANGED"}
            )
        template = None
        if request.agent_action.type == "save_as_template_and_discard":
            template = await _save_agent_as_template_in_transaction(
                session,
                journey_id=journey_id,
                agent_id=request.expected_agent_id,
                workspace_id=workspace_id,
                request=request.agent_action.template,
                id_factory=id_factory,
            )
        candidate = remove_slot(pattern, slot_id, id_factory)
        issues = validate_pattern(candidate)
        if issues:
            raise _validation_error([issue.code.value for issue in issues])
        await _synchronize_pattern_ends(
            session, journey_id, workspace_id, candidate, request.routing_confirmation
        )
        await repository.delete_agent_workflow(session, request.expected_agent_id)
        updated = await repository.cas_update_pattern(
            session,
            journey_id=journey_id,
            workspace_id=workspace_id,
            expected_revision=request.expected_revision,
            pattern=candidate,
        )
        if updated is None:
            current = await repository.get_current_revision(session, journey_id, workspace_id)
            raise _revision_error(request.expected_revision, current or request.expected_revision)
        document = await repository.get_journey_document(session, journey_id, workspace_id)
        if document is None:
            raise RuntimeError("Updated Journey was not visible in its transaction")
        return RemoveOccupiedSlotResponse(journey=document, template=template)
