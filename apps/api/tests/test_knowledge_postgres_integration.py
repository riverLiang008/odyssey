import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from odyssey_api.bootstrap import bootstrap_builtin_tool_definitions
from odyssey_api.db.models import (
    AgentWorkflow,
    KnowledgeSpace,
    KnowledgeSpaceCategory,
    OdyJourney,
    ToolDefinition,
    WorkflowKnowledgeSpaceReference,
    Workspace,
)
from odyssey_api.db.session import async_session_factory
from odyssey_api.dependencies.workspace import CurrentWorkspace, get_current_workspace
from odyssey_api.errors import ApplicationError, ErrorCode
from odyssey_api.journeys import repository
from odyssey_api.journeys.dto import CreateJourneyRequest, PatternKind, SaveAgentWorkflowRequest
from odyssey_api.journeys.service import (
    create_journey,
    create_minimum_agent_and_assign,
    save_agent_workflow,
)
from odyssey_api.main import create_app
from odyssey_api.settings import Settings


async def _seed_spaces(
    workspace_id: UUID, other_workspace_id: UUID
) -> tuple[list[UUID], UUID, list[UUID]]:
    category_id, other_category_id = uuid4(), uuid4()
    ids = [uuid4(), uuid4(), uuid4(), uuid4()]
    foreign_id = uuid4()
    now = datetime(2026, 8, 26, 12, tzinfo=UTC)
    async with async_session_factory() as session, session.begin():
        session.add_all(
            [
                Workspace(id=workspace_id, name=f"Knowledge {workspace_id}", description=None),
                Workspace(
                    id=other_workspace_id, name=f"Knowledge {other_workspace_id}", description=None
                ),
            ]
        )
        await session.flush()
        session.add_all(
            [
                KnowledgeSpaceCategory(
                    id=category_id,
                    workspace_id=workspace_id,
                    name="Default",
                    normalized_name="default",
                    color_token=None,
                    sort_order=0,
                    is_default=True,
                ),
                KnowledgeSpaceCategory(
                    id=other_category_id,
                    workspace_id=other_workspace_id,
                    name="Default",
                    normalized_name="default",
                    color_token=None,
                    sort_order=0,
                    is_default=True,
                ),
            ]
        )
        await session.flush()
        session.add_all(
            [
                KnowledgeSpace(
                    id=ids[0],
                    workspace_id=workspace_id,
                    knowledge_space_category_id=category_id,
                    name="100% Product",
                    normalized_name="100% product",
                    description="literal percent",
                    lifecycle_status="ready",
                    graph_status="healthy",
                    updated_at=now,
                ),
                KnowledgeSpace(
                    id=ids[1],
                    workspace_id=workspace_id,
                    knowledge_space_category_id=category_id,
                    name="Product_Research",
                    normalized_name="product_research",
                    description=None,
                    lifecycle_status="syncing",
                    graph_status="needs_review",
                    updated_at=now,
                ),
                KnowledgeSpace(
                    id=ids[2],
                    workspace_id=workspace_id,
                    knowledge_space_category_id=category_id,
                    name="Older Product",
                    normalized_name="older product",
                    description="market research",
                    lifecycle_status="failed",
                    graph_status="error",
                    updated_at=now - timedelta(days=1),
                ),
                KnowledgeSpace(
                    id=ids[3],
                    workspace_id=workspace_id,
                    knowledge_space_category_id=category_id,
                    name="Unrelated",
                    normalized_name="unrelated",
                    description=None,
                    lifecycle_status="initializing",
                    graph_status="not_indexed",
                    updated_at=now - timedelta(days=2),
                ),
                KnowledgeSpace(
                    id=foreign_id,
                    workspace_id=other_workspace_id,
                    knowledge_space_category_id=other_category_id,
                    name="Product Foreign",
                    normalized_name="product foreign",
                    description="market research",
                    lifecycle_status="ready",
                    graph_status="healthy",
                    updated_at=now + timedelta(days=1),
                ),
            ]
        )
    return ids, foreign_id, [category_id, other_category_id]


async def _cleanup(workspace_ids: list[UUID], category_ids: list[UUID]) -> None:
    async with async_session_factory() as session, session.begin():
        await session.execute(delete(OdyJourney).where(OdyJourney.workspace_id.in_(workspace_ids)))
        await session.execute(
            delete(KnowledgeSpace).where(KnowledgeSpace.workspace_id.in_(workspace_ids))
        )
        await session.execute(
            delete(KnowledgeSpaceCategory).where(KnowledgeSpaceCategory.id.in_(category_ids))
        )
        await session.execute(delete(Workspace).where(Workspace.id.in_(workspace_ids)))


@pytest.mark.integration
async def test_inventory_http_pagination_search_order_and_workspace_total() -> None:
    workspace_id, other_workspace_id = uuid4(), uuid4()
    ids, _, category_ids = await _seed_spaces(workspace_id, other_workspace_id)
    try:
        app = create_app()
        app.dependency_overrides[get_current_workspace] = lambda: CurrentWorkspace(workspace_id)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(
                "/api/v1/knowledge-spaces", params={"query": "product", "page": 1, "pageSize": 2}
            )
            wildcard = await client.get("/api/v1/knowledge-spaces", params={"query": "100%"})
            underscore = await client.get("/api/v1/knowledge-spaces", params={"query": "Product_"})
            invalid = await client.get(
                "/api/v1/knowledge-spaces", params={"workspaceId": str(other_workspace_id)}
            )
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 3
        assert [item["id"] for item in body["items"]] == [str(value) for value in sorted(ids[:2])]
        assert wildcard.json()["items"][0]["id"] == str(ids[0])
        assert underscore.json()["items"][0]["id"] == str(ids[1])
        assert invalid.status_code == 422
        assert "workspaceId" not in str(body)
    finally:
        await _cleanup([workspace_id, other_workspace_id], category_ids)


def _workflow_request(
    *, revision: int, space_ids: list[UUID], reusable_tool_id: UUID
) -> SaveAgentWorkflowRequest:
    root_id, loop_id, nested_id, task_id, step_id = uuid4(), uuid4(), uuid4(), uuid4(), uuid4()
    output_variable_id = uuid4()
    literal = {"kind": "literal", "value": "query"}
    return SaveAgentWorkflowRequest.model_validate(
        {
            "expectedRevision": revision,
            "workflow": {
                "schemaVersion": "1.0.0",
                "edges": [],
                "nodes": [
                    {
                        "id": str(root_id),
                        "name": "Root",
                        "type": "agent_action",
                        "config": {
                            "model": "gpt-5",
                            "goal": literal,
                            "knowledgeSpaceIds": [str(space_ids[0])],
                            "reusableToolIds": [str(reusable_tool_id)],
                        },
                    },
                    {
                        "id": str(task_id),
                        "name": "Task",
                        "type": "task",
                        "config": {
                            "localVariables": [],
                            "steps": [
                                {
                                    "id": str(step_id),
                                    "kind": "knowledge_retrieval",
                                    "failureBehavior": {"kind": "fail_task"},
                                    "configuration": {
                                        "knowledgeSpaceId": str(space_ids[1]),
                                        "query": literal,
                                    },
                                    "outputMapping": {
                                        "sourceKey": "retrieved_documents",
                                        "targetVariableId": str(output_variable_id),
                                    },
                                }
                            ],
                        },
                    },
                    {
                        "id": str(loop_id),
                        "name": "Loop",
                        "type": "loop",
                        "config": {
                            "maxTurns": 2,
                            "exitCondition": {
                                "kind": "variable_comparison",
                                "variableId": str(uuid4()),
                                "operator": "eq",
                                "value": True,
                            },
                            "body": {
                                "graph": {
                                    "nodes": [
                                        {
                                            "id": str(nested_id),
                                            "name": "Nested",
                                            "type": "agent_action",
                                            "config": {
                                                "model": "gpt-5",
                                                "goal": literal,
                                                "knowledgeSpaceIds": [str(space_ids[2])],
                                                "reusableToolIds": [],
                                            },
                                        }
                                    ],
                                    "edges": [],
                                },
                                "layout": {
                                    "nodePlacements": [{"nodeId": str(nested_id), "x": 0, "y": 0}],
                                    "viewport": {"x": 0, "y": 0, "zoom": 1},
                                },
                            },
                        },
                    },
                ],
            },
            "layout": {
                "schemaVersion": "1.0.0",
                "nodePlacements": [],
                "viewport": {"x": 0, "y": 0, "zoom": 1},
            },
            "variables": [],
            "reusableTools": [
                {
                    "id": str(reusable_tool_id),
                    "name": "Reusable Search",
                    "sourceTemplateId": None,
                    "kind": "knowledge_retrieval",
                    "configuration": {"knowledgeSpaceId": str(space_ids[3])},
                    "inputBindings": [],
                    "outputBinding": None,
                }
            ],
        }
    )


async def _create_agent(workspace_id: UUID) -> tuple[UUID, UUID]:
    async with async_session_factory() as session:
        journey = await create_journey(
            session,
            workspace_id,
            CreateJourneyRequest(
                name="Knowledge Journey",
                description=None,
                pattern_template_key=PatternKind.SOLO_COMPONENT,
            ),
        )
    async with async_session_factory() as session:
        result = await create_minimum_agent_and_assign(
            session,
            journey_id=journey.journey.id,
            slot_id=journey.pattern.slots[0].id,
            workspace_id=workspace_id,
            expected_revision=1,
        )
    return journey.journey.id, result.agent.agent.id


@pytest.mark.integration
async def test_workflow_reference_sync_cleanup_hidden_not_found_and_rollback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace_id, other_workspace_id = uuid4(), uuid4()
    ids, foreign_id, category_ids = await _seed_spaces(workspace_id, other_workspace_id)
    tool_definition_id = uuid4()
    created_knowledge_definition = False
    seeded_tool_kinds: set[str] = set()
    journey_id: UUID | None = None
    try:
        async with async_session_factory() as session, session.begin():
            existing_definition_id = await session.scalar(
                select(ToolDefinition.id).where(ToolDefinition.kind == "knowledge_retrieval")
            )
            if existing_definition_id is None:
                session.add(
                    ToolDefinition(
                        id=tool_definition_id,
                        kind="knowledge_retrieval",
                        source="built_in",
                        name="Knowledge retrieval",
                        category="knowledge",
                        description=None,
                        configuration_schema={},
                        input_schema={},
                        output_schema={},
                    )
                )
                created_knowledge_definition = True
            else:
                tool_definition_id = existing_definition_id
        journey_id, agent_id = await _create_agent(workspace_id)
        reusable_tool_id = uuid4()
        request = _workflow_request(revision=1, space_ids=ids, reusable_tool_id=reusable_tool_id)
        async with async_session_factory() as session:
            saved = await save_agent_workflow(session, journey_id, agent_id, workspace_id, request)
        assert saved.agent.revision == 2
        async with async_session_factory() as session:
            rows = list(
                (
                    await session.scalars(
                        select(WorkflowKnowledgeSpaceReference).where(
                            WorkflowKnowledgeSpaceReference.agent_workflow_id == agent_id
                        )
                    )
                ).all()
            )
        assert {(row.owner_kind, row.knowledge_space_id) for row in rows} == {
            ("agent_action", ids[0]),
            ("task_tool", ids[1]),
            ("agent_action", ids[2]),
            ("reusable_tool", ids[3]),
        }

        empty = SaveAgentWorkflowRequest.model_validate(
            {
                **request.model_dump(mode="json", by_alias=True),
                "expectedRevision": 2,
                "workflow": {"schemaVersion": "1.0.0", "nodes": [], "edges": []},
                "reusableTools": [],
            }
        )
        async with async_session_factory() as session:
            await save_agent_workflow(session, journey_id, agent_id, workspace_id, empty)
        async with async_session_factory() as session:
            assert (
                list(
                    (
                        await session.scalars(
                            select(WorkflowKnowledgeSpaceReference).where(
                                WorkflowKnowledgeSpaceReference.agent_workflow_id == agent_id
                            )
                        )
                    ).all()
                )
                == []
            )

        foreign = _workflow_request(
            revision=3, space_ids=[foreign_id, *ids[1:]], reusable_tool_id=uuid4()
        )
        missing = _workflow_request(
            revision=3, space_ids=[uuid4(), *ids[1:]], reusable_tool_id=uuid4()
        )
        for rejected in (foreign, missing):
            async with async_session_factory() as session:
                with pytest.raises(ApplicationError) as error:
                    await save_agent_workflow(session, journey_id, agent_id, workspace_id, rejected)
            assert error.value.code is ErrorCode.NOT_FOUND
            assert error.value.details == {}

        async def fail_sync(*args: object, **kwargs: object) -> None:
            raise RuntimeError("injected reference synchronization failure")

        original_synchronize_references = repository.synchronize_workflow_knowledge_references
        monkeypatch.setattr(repository, "synchronize_workflow_knowledge_references", fail_sync)
        with pytest.raises(RuntimeError):
            async with async_session_factory() as session:
                await save_agent_workflow(
                    session,
                    journey_id,
                    agent_id,
                    workspace_id,
                    _workflow_request(revision=3, space_ids=ids, reusable_tool_id=uuid4()),
                )
        async with async_session_factory() as session:
            assert (
                await session.scalar(
                    select(AgentWorkflow.revision).where(AgentWorkflow.id == agent_id)
                )
                == 3
            )
            assert (
                list(
                    (
                        await session.scalars(
                            select(WorkflowKnowledgeSpaceReference).where(
                                WorkflowKnowledgeSpaceReference.agent_workflow_id == agent_id
                            )
                        )
                    ).all()
                )
                == []
            )
        monkeypatch.setattr(
            repository,
            "synchronize_workflow_knowledge_references",
            original_synchronize_references,
        )

        script_request = SaveAgentWorkflowRequest.model_validate(
            {
                "expectedRevision": 3,
                "workflow": {"schemaVersion": "1.0.0", "nodes": [], "edges": []},
                "layout": {
                    "schemaVersion": "1.0.0",
                    "nodePlacements": [],
                    "viewport": {"x": 0, "y": 0, "zoom": 1},
                },
                "variables": [],
                "reusableTools": [
                    {
                        "id": str(uuid4()),
                        "name": "Acceptance Script",
                        "sourceTemplateId": None,
                        "kind": "script_execution",
                        "configuration": {
                            "language": "javascript",
                            "script": "return true;",
                        },
                        "inputBindings": [],
                        "outputBinding": None,
                    }
                ],
            }
        )
        original_available_kinds = repository.get_available_tool_definition_kinds

        async def no_available_kinds(*args: object, **kwargs: object) -> set[str]:
            return set()

        monkeypatch.setattr(repository, "get_available_tool_definition_kinds", no_available_kinds)
        async with async_session_factory() as session:
            with pytest.raises(ApplicationError) as unavailable:
                await save_agent_workflow(
                    session, journey_id, agent_id, workspace_id, script_request
                )
        assert unavailable.value.code is ErrorCode.STATE_CONFLICT
        assert unavailable.value.details == {
            "reason": "TOOL_DEFINITION_UNAVAILABLE",
            "toolKinds": ["script_execution"],
        }
        monkeypatch.setattr(
            repository,
            "get_available_tool_definition_kinds",
            original_available_kinds,
        )
        async with async_session_factory() as session:
            seed_result = await bootstrap_builtin_tool_definitions(
                session, Settings(environment="development")
            )
            seeded_tool_kinds.update(seed_result.created_kinds)
        async with async_session_factory() as session:
            script_saved = await save_agent_workflow(
                session, journey_id, agent_id, workspace_id, script_request
            )
        assert script_saved.agent.revision == 4
        assert len(script_saved.reusable_tools) == 1
        assert script_saved.reusable_tools[0].kind == "script_execution"
        async with async_session_factory() as session:
            reloaded = await repository.get_agent_workflow_document(
                session,
                journey_id=journey_id,
                agent_id=agent_id,
                workspace_id=workspace_id,
            )
        assert reloaded is not None
        assert len(reloaded.reusable_tools) == 1
        assert reloaded.reusable_tools[0].kind == "script_execution"
    finally:
        async with async_session_factory() as session, session.begin():
            if journey_id is not None:
                await session.execute(delete(OdyJourney).where(OdyJourney.id == journey_id))
            if created_knowledge_definition:
                await session.execute(
                    delete(ToolDefinition).where(ToolDefinition.id == tool_definition_id)
                )
            if seeded_tool_kinds:
                await session.execute(
                    delete(ToolDefinition).where(ToolDefinition.kind.in_(seeded_tool_kinds))
                )
        await _cleanup([workspace_id, other_workspace_id], category_ids)


@pytest.mark.integration
async def test_concurrent_workflow_save_has_one_cas_winner() -> None:
    workspace_id, other_workspace_id = uuid4(), uuid4()
    ids, _, category_ids = await _seed_spaces(workspace_id, other_workspace_id)
    journey_id: UUID | None = None
    try:
        journey_id, agent_id = await _create_agent(workspace_id)

        async def attempt() -> object:
            request = _workflow_request(revision=1, space_ids=ids, reusable_tool_id=uuid4())
            request.reusable_tools = []
            async with async_session_factory() as session:
                try:
                    return await save_agent_workflow(
                        session, journey_id, agent_id, workspace_id, request
                    )
                except ApplicationError as error:
                    return error

        results = await asyncio.gather(attempt(), attempt())
        assert sum(not isinstance(result, ApplicationError) for result in results) == 1
        loser = next(result for result in results if isinstance(result, ApplicationError))
        assert loser.code is ErrorCode.REVISION_CONFLICT
        async with async_session_factory() as session:
            assert (
                await session.scalar(
                    select(AgentWorkflow.revision).where(AgentWorkflow.id == agent_id)
                )
                == 2
            )
    finally:
        if journey_id is not None:
            async with async_session_factory() as session, session.begin():
                await session.execute(delete(OdyJourney).where(OdyJourney.id == journey_id))
        await _cleanup([workspace_id, other_workspace_id], category_ids)
