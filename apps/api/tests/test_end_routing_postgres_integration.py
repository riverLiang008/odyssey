import asyncio
from collections.abc import AsyncIterator
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from odyssey_api.db.models import AgentTemplate as AgentTemplateRow
from odyssey_api.db.models import AgentWorkflow, OdyJourney, Workspace
from odyssey_api.db.session import async_session_factory
from odyssey_api.errors import ApplicationError, ErrorCode
from odyssey_api.journeys import repository
from odyssey_api.journeys.dto import (
    CreateJourneyRequest,
    CreateMinimumAgentResponse,
    EndNode,
    PatternConfig,
    PatternRoute,
    RoutingConfirmation,
    SaveAgentAsTemplateRequest,
    SaveAgentWorkflowRequest,
    SaveJourneyRequest,
    SlotRouteTarget,
    TemplateEndAssignment,
    WorkflowEdge,
)
from odyssey_api.journeys.service import (
    create_journey,
    create_minimum_agent_and_assign,
    instantiate_agent_template,
    load_agent_workflow,
    load_journey,
    save_agent_as_template,
    save_agent_workflow,
    save_journey_pattern,
)

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture(loop_scope="session")
async def hub_workspace() -> AsyncIterator[tuple[UUID, CreateMinimumAgentResponse]]:
    workspace_id = uuid4()
    async with async_session_factory() as session, session.begin():
        session.add(Workspace(id=workspace_id, name="End routing integration", description=None))
    try:
        async with async_session_factory() as session:
            journey = await create_journey(
                session,
                workspace_id,
                CreateJourneyRequest(
                    name="Hub routing", description=None, patternTemplateKey="hub_and_spoke"
                ),
            )
        async with async_session_factory() as session:
            created = await create_minimum_agent_and_assign(
                session,
                journey_id=journey.journey.id,
                workspace_id=workspace_id,
                slot_id=journey.pattern.slots[0].id,
                expected_revision=1,
            )
        yield workspace_id, created
    finally:
        async with async_session_factory() as session, session.begin():
            await session.execute(delete(OdyJourney).where(OdyJourney.workspace_id == workspace_id))
            await session.execute(
                delete(AgentTemplateRow).where(AgentTemplateRow.workspace_id == workspace_id)
            )
            await session.execute(delete(Workspace).where(Workspace.id == workspace_id))


def reverse_first_spoke(pattern: PatternConfig) -> PatternConfig:
    candidate = pattern.model_copy(deep=True)
    candidate.schema_version = "1.1.0"
    hub, spoke = candidate.slots[:2]
    spoke.configuration["direction"] = "spoke_to_hub"
    candidate.routes = [
        route
        for route in candidate.routes
        if not (
            route.source_slot_id == hub.id
            and route.target == SlotRouteTarget(type="slot", slot_id=spoke.id)
        )
    ]
    candidate.routes.append(
        PatternRoute(
            id=uuid4(), source_slot_id=spoke.id, target=SlotRouteTarget(type="slot", slot_id=hub.id)
        )
    )
    return candidate


@pytest.mark.integration
async def test_confirmed_removal_is_atomic_and_old_workflow_cannot_resurrect_exit(
    hub_workspace: tuple[UUID, CreateMinimumAgentResponse],
) -> None:
    workspace_id, created = hub_workspace
    journey_id = created.journey.journey.id
    agent = created.agent
    start = next(node for node in agent.workflow.nodes if node.type == "start")
    first_end = next(node for node in agent.workflow.nodes if isinstance(node, EndNode))
    assert len([node for node in agent.workflow.nodes if isinstance(node, EndNode)]) == 4
    assert not agent.workflow.edges  # No arbitrary first-target wiring.
    graph = agent.workflow.model_copy(deep=True)
    graph.edges.append(
        WorkflowEdge(id=uuid4(), source_node_id=start.id, target_node_id=first_end.id)
    )
    request = SaveAgentWorkflowRequest(
        expected_revision=1, workflow=graph, layout=agent.layout, variables=[], reusable_tools=[]
    )
    async with async_session_factory() as session:
        saved = await save_agent_workflow(
            session, journey_id, agent.agent.id, workspace_id, request
        )
    candidate = reverse_first_spoke(created.journey.pattern)
    async with async_session_factory() as session:
        with pytest.raises(ApplicationError) as pending:
            await save_journey_pattern(
                session,
                journey_id,
                workspace_id,
                SaveJourneyRequest(expected_revision=2, pattern=candidate),
            )
    assert pending.value.details["reason"] == "END_ROUTING_CONFIRMATION_REQUIRED"
    impact = pending.value.details["routingImpact"]
    assert impact[0]["removedEdgeIds"] == [str(graph.edges[0].id)]
    async with async_session_factory() as session:
        unchanged = await load_journey(session, journey_id, workspace_id)
    assert unchanged.journey.revision == 2
    assert unchanged.pattern == created.journey.pattern
    async with async_session_factory() as session:
        await save_journey_pattern(
            session,
            journey_id,
            workspace_id,
            SaveJourneyRequest(
                expected_revision=2,
                pattern=candidate,
                routing_confirmation=[
                    RoutingConfirmation(
                        agent_id=agent.agent.id,
                        revision=saved.agent.revision,
                        removed_end_ids=[first_end.id],
                        removed_edge_ids=[graph.edges[0].id],
                    )
                ],
            ),
        )
    async with async_session_factory() as session:
        updated = await load_agent_workflow(session, journey_id, agent.agent.id, workspace_id)
    assert updated.agent.revision == saved.agent.revision + 1
    assert first_end.id not in {node.id for node in updated.workflow.nodes}
    assert not updated.workflow.edges
    async with async_session_factory() as session:
        with pytest.raises(ApplicationError) as stale:
            await save_agent_workflow(
                session,
                journey_id,
                agent.agent.id,
                workspace_id,
                request.model_copy(update={"expected_revision": saved.agent.revision}),
            )
    assert stale.value.code is ErrorCode.REVISION_CONFLICT


@pytest.mark.integration
async def test_routing_update_rolls_back_when_journey_write_fails(
    hub_workspace: tuple[UUID, CreateMinimumAgentResponse],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace_id, created = hub_workspace
    journey_id = created.journey.journey.id
    candidate = reverse_first_spoke(created.journey.pattern)

    async def fail_write(
        session: AsyncSession,
        *,
        journey_id: UUID,
        workspace_id: UUID,
        expected_revision: int,
        pattern: PatternConfig,
    ) -> None:
        raise RuntimeError("injected after Workflow update")

    monkeypatch.setattr(repository, "cas_update_pattern", fail_write)
    async with async_session_factory() as session:
        with pytest.raises(RuntimeError, match="injected"):
            await save_journey_pattern(
                session,
                journey_id,
                workspace_id,
                SaveJourneyRequest(expected_revision=2, pattern=candidate),
            )
    # Independent sessions prove rollback, rather than only checking the exception.
    async with async_session_factory() as session:
        document = await load_agent_workflow(
            session, journey_id, created.agent.agent.id, workspace_id
        )
    assert document.workflow == created.agent.workflow
    assert document.agent.revision == created.agent.agent.revision
    async with async_session_factory() as session:
        journey = await load_journey(session, journey_id, workspace_id)
    assert journey.journey.revision == 2
    assert journey.pattern == created.journey.pattern


@pytest.mark.integration
async def test_workflow_cannot_rebind_a_server_owned_end(
    hub_workspace: tuple[UUID, CreateMinimumAgentResponse],
) -> None:
    workspace_id, created = hub_workspace
    graph = created.agent.workflow.model_copy(deep=True)
    end = next(node for node in graph.nodes if isinstance(node, EndNode))
    end.configuration.binding = None
    async with async_session_factory() as session:
        with pytest.raises(ApplicationError) as rejected:
            await save_agent_workflow(
                session,
                created.journey.journey.id,
                created.agent.agent.id,
                workspace_id,
                SaveAgentWorkflowRequest(
                    expected_revision=1,
                    workflow=graph,
                    layout=created.agent.layout,
                    variables=[],
                    reusable_tools=[],
                ),
            )
    assert rejected.value.details["reason"] == "END_BOUNDARY_IMMUTABLE"


@pytest.mark.integration
async def test_portable_template_requires_explicit_destinations_before_any_write(
    hub_workspace: tuple[UUID, CreateMinimumAgentResponse],
) -> None:
    workspace_id, created = hub_workspace
    async with async_session_factory() as session:
        template = await save_agent_as_template(
            session,
            created.journey.journey.id,
            created.agent.agent.id,
            workspace_id,
            SaveAgentAsTemplateRequest(name="Portable Hub", description=None),
        )
    portable = template.snapshot.model_dump_json()
    for slot in created.journey.pattern.slots:
        assert str(slot.id) not in portable
    async with async_session_factory() as session:
        target = await create_journey(
            session,
            workspace_id,
            CreateJourneyRequest(
                name="Target Hub", description=None, patternTemplateKey="hub_and_spoke"
            ),
        )
    source_ends = [node for node in template.snapshot.workflow.nodes if isinstance(node, EndNode)]
    async with async_session_factory() as session:
        with pytest.raises(ApplicationError) as required:
            await instantiate_agent_template(
                session,
                template_id=template.id,
                journey_id=target.journey.id,
                slot_id=target.pattern.slots[0].id,
                workspace_id=workspace_id,
                expected_revision=1,
            )
    assert required.value.details["reason"] == "TEMPLATE_END_MAPPING_REQUIRED"
    async with async_session_factory() as session:
        unchanged = await load_journey(session, target.journey.id, workspace_id)
    assert unchanged.journey.revision == 1
    assert not unchanged.agents
    assignments = [
        TemplateEndAssignment(end_node_id=end.id, target=route.target)
        for end, route in zip(source_ends, target.pattern.routes, strict=True)
    ]
    async with async_session_factory() as session:
        instantiated = await instantiate_agent_template(
            session,
            template_id=template.id,
            journey_id=target.journey.id,
            slot_id=target.pattern.slots[0].id,
            workspace_id=workspace_id,
            expected_revision=1,
            end_assignments=assignments,
        )
    target_ends = [node for node in instantiated.agent.workflow.nodes if isinstance(node, EndNode)]
    assert len(target_ends) == 4
    assert all(
        end.configuration.binding is not None
        and end.configuration.binding.source_slot_id == target.pattern.slots[0].id
        for end in target_ends
    )
    assert not {node.id for node in source_ends} & {node.id for node in target_ends}


@pytest.mark.integration
async def test_concurrent_pattern_change_and_workflow_save_cannot_restore_removed_exit(
    hub_workspace: tuple[UUID, CreateMinimumAgentResponse],
) -> None:
    workspace_id, created = hub_workspace
    journey_id, agent_id = created.journey.journey.id, created.agent.agent.id
    graph = created.agent.workflow.model_copy(deep=True)
    start = next(node for node in graph.nodes if node.type == "start")
    ends = [node for node in graph.nodes if isinstance(node, EndNode)]
    graph.edges.append(WorkflowEdge(id=uuid4(), source_node_id=start.id, target_node_id=ends[1].id))

    async def save_pattern() -> object:
        async with async_session_factory() as session:
            return await save_journey_pattern(
                session,
                journey_id,
                workspace_id,
                SaveJourneyRequest(
                    expected_revision=2, pattern=reverse_first_spoke(created.journey.pattern)
                ),
            )

    async def save_workflow() -> object:
        async with async_session_factory() as session:
            try:
                return await save_agent_workflow(
                    session,
                    journey_id,
                    agent_id,
                    workspace_id,
                    SaveAgentWorkflowRequest(
                        expected_revision=1,
                        workflow=graph,
                        layout=created.agent.layout,
                        variables=[],
                        reusable_tools=[],
                    ),
                )
            except ApplicationError as error:
                return error

    pattern_result, workflow_result = await asyncio.gather(save_pattern(), save_workflow())
    assert not isinstance(pattern_result, ApplicationError)
    if isinstance(workflow_result, ApplicationError):
        assert workflow_result.code is ErrorCode.REVISION_CONFLICT
    async with async_session_factory() as session:
        final = await load_agent_workflow(session, journey_id, agent_id, workspace_id)
    assert ends[0].id not in {node.id for node in final.workflow.nodes}
    assert all(edge.target_node_id != ends[0].id for edge in final.workflow.edges)
    assert len([node for node in final.workflow.nodes if isinstance(node, EndNode)]) == 3


@pytest.mark.integration
@pytest.mark.parametrize("has_incoming_edge", [False, True])
async def test_legacy_upgrade_on_pattern_save_only_requires_confirmation_for_connection_loss(
    hub_workspace: tuple[UUID, CreateMinimumAgentResponse], has_incoming_edge: bool
) -> None:
    workspace_id, created = hub_workspace
    agent = created.agent
    journey_id = created.journey.journey.id
    legacy = agent.workflow.model_copy(deep=True)
    legacy.schema_version = "1.0.0"
    for node in legacy.nodes:
        if isinstance(node, EndNode):
            node.configuration.binding = None
    if has_incoming_edge:
        start = next(node for node in legacy.nodes if node.type == "start")
        end = next(node for node in legacy.nodes if isinstance(node, EndNode))
        legacy.edges.append(
            WorkflowEdge(id=uuid4(), source_node_id=start.id, target_node_id=end.id)
        )
    async with async_session_factory() as session, session.begin():
        await session.execute(
            update(AgentWorkflow)
            .where(AgentWorkflow.id == agent.agent.id, AgentWorkflow.ody_journey_id == journey_id)
            .values(workflow_graph=legacy.model_dump(mode="json", by_alias=True))
        )
    async with async_session_factory() as session:
        loaded = await load_agent_workflow(session, journey_id, agent.agent.id, workspace_id)
    assert loaded.workflow.schema_version == "1.0.0"  # Reads never migrate.
    async with async_session_factory() as session:
        if has_incoming_edge:
            with pytest.raises(ApplicationError) as pending:
                await save_journey_pattern(
                    session,
                    journey_id,
                    workspace_id,
                    SaveJourneyRequest(expected_revision=2, pattern=created.journey.pattern),
                )
            assert pending.value.details["reason"] == "END_ROUTING_CONFIRMATION_REQUIRED"
            assert pending.value.details["routingImpact"][0]["removedEdgeIds"] == [
                str(legacy.edges[0].id)
            ]
        else:
            saved = await save_journey_pattern(
                session,
                journey_id,
                workspace_id,
                SaveJourneyRequest(expected_revision=2, pattern=created.journey.pattern),
            )
            assert saved.journey.revision == 3
    async with async_session_factory() as session:
        persisted = await load_agent_workflow(session, journey_id, agent.agent.id, workspace_id)
    if has_incoming_edge:
        assert persisted.workflow == legacy
        assert persisted.agent.revision == agent.agent.revision
    else:
        assert persisted.workflow.schema_version == "1.1.0"
        assert all(
            node.configuration.binding is not None
            for node in persisted.workflow.nodes
            if isinstance(node, EndNode)
        )
        assert persisted.agent.revision == agent.agent.revision + 1


@pytest.mark.integration
async def test_runtime_binding_save_reload_and_template_preserve_system_resource(
    hub_workspace: tuple[UUID, CreateMinimumAgentResponse],
) -> None:
    from odyssey_api.journeys.dto import AgentActionNode

    workspace_id, created = hub_workspace
    document = created.agent
    graph = document.workflow.model_copy(deep=True)
    graph.schema_version = "1.2.0"
    graph.nodes.append(
        AgentActionNode.model_validate(
            {
                "id": str(uuid4()),
                "name": "Runtime Curator",
                "type": "agent_action",
                "config": {
                    "model": "test",
                    "goal": {"kind": "system", "key": "document_id"},
                    "knowledgeSpaceIds": [
                        {"kind": "system_knowledge_space", "key": "target_knowledge_space"}
                    ],
                    "reusableToolIds": [],
                },
            }
        )
    )
    async with async_session_factory() as session:
        saved = await save_agent_workflow(
            session,
            document.agent.journey_id,
            document.agent.id,
            workspace_id,
            SaveAgentWorkflowRequest(
                expected_revision=document.agent.revision,
                workflow=graph,
                layout=document.layout,
                variables=[],
                reusable_tools=[],
            ),
        )
    async with async_session_factory() as session:
        loaded = await load_agent_workflow(
            session, document.agent.journey_id, document.agent.id, workspace_id
        )
    assert loaded.workflow == saved.workflow
    assert loaded.workflow.schema_version == "1.2.0"
    assert (
        loaded.workflow.nodes[-1].configuration.knowledge_space_ids[0].key
        == "target_knowledge_space"
    )
