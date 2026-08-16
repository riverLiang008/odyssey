from uuid import uuid4

import pytest
from sqlalchemy import delete

from odyssey_api.db.models import OdyJourney, Workspace
from odyssey_api.db.session import async_session_factory
from odyssey_api.errors import ApplicationError, ErrorCode
from odyssey_api.journeys.dto import CreateJourneyRequest, PatternKind, SaveJourneyRequest
from odyssey_api.journeys.service import (
    create_journey,
    create_minimum_agent_and_assign,
    delete_journey,
    list_journeys,
    load_journey,
    save_journey_pattern,
)


@pytest.mark.integration
async def test_journey_create_save_conflict_isolation_and_delete_round_trip() -> None:
    workspace_id = uuid4()
    other_workspace_id = uuid4()
    async with async_session_factory() as setup_session, setup_session.begin():
        setup_session.add_all(
            [
                Workspace(id=workspace_id, name="Journey integration", description=None),
                Workspace(id=other_workspace_id, name="Other integration", description=None),
            ]
        )

    journey_id = None
    try:
        async with async_session_factory() as session:
            created = await create_journey(
                session,
                workspace_id,
                CreateJourneyRequest(
                    name="Persistent Journey",
                    description=None,
                    pattern_template_key=PatternKind.LINEAR_SEQUENCE,
                ),
            )
            journey_id = created.journey.id
            assert created.journey.revision == 1

        async with async_session_factory() as session:
            summaries = await list_journeys(session, workspace_id)
            assert [summary.id for summary in summaries] == [journey_id]
            assert summaries[0].pattern_kind is PatternKind.LINEAR_SEQUENCE

        async with async_session_factory() as session:
            with pytest.raises(ApplicationError) as hidden:
                await load_journey(session, journey_id, other_workspace_id)
            assert hidden.value.code is ErrorCode.NOT_FOUND

        candidate = created.pattern.model_copy(deep=True)
        candidate.slots[0].label = "Renamed Stage"
        async with async_session_factory() as session:
            saved = await save_journey_pattern(
                session,
                journey_id,
                workspace_id,
                SaveJourneyRequest(expected_revision=1, pattern=candidate),
            )
            assert saved.journey.revision == 2
            assert saved.pattern.slots[0].label == "Renamed Stage"

        async with async_session_factory() as session:
            with pytest.raises(ApplicationError) as stale:
                await save_journey_pattern(
                    session,
                    journey_id,
                    workspace_id,
                    SaveJourneyRequest(expected_revision=1, pattern=candidate),
                )
            assert stale.value.code is ErrorCode.REVISION_CONFLICT
            assert stale.value.details["currentRevision"] == 2

        async with async_session_factory() as session:
            await delete_journey(session, journey_id, workspace_id, expected_revision=2)
            journey_id = None

        async with async_session_factory() as session:
            assert await list_journeys(session, workspace_id) == []
    finally:
        async with async_session_factory() as cleanup_session, cleanup_session.begin():
            if journey_id is not None:
                await cleanup_session.execute(delete(OdyJourney).where(OdyJourney.id == journey_id))
            await cleanup_session.execute(
                delete(Workspace).where(Workspace.id.in_([workspace_id, other_workspace_id]))
            )


@pytest.mark.integration
async def test_minimum_agent_creation_is_atomic_and_rejects_occupied_slot() -> None:
    workspace_id = uuid4()
    async with async_session_factory() as setup_session, setup_session.begin():
        setup_session.add(Workspace(id=workspace_id, name="Agent integration", description=None))

    journey_id = None
    try:
        async with async_session_factory() as session:
            created = await create_journey(
                session,
                workspace_id,
                CreateJourneyRequest(
                    name="Agent Journey",
                    description=None,
                    pattern_template_key=PatternKind.SOLO_COMPONENT,
                ),
            )
            journey_id = created.journey.id
            slot_id = created.pattern.slots[0].id

        async with async_session_factory() as session:
            result = await create_minimum_agent_and_assign(
                session,
                journey_id=journey_id,
                slot_id=slot_id,
                workspace_id=workspace_id,
                expected_revision=1,
            )
            assert result.journey.journey.revision == 2
            assert result.journey.pattern.slots[0].agent_id == result.agent.agent.id
            assert result.agent.agent.name == "Agent 1"
            assert [node.type for node in result.agent.workflow.nodes] == ["start", "end"]

        async with async_session_factory() as session:
            with pytest.raises(ApplicationError) as occupied:
                await create_minimum_agent_and_assign(
                    session,
                    journey_id=journey_id,
                    slot_id=slot_id,
                    workspace_id=workspace_id,
                    expected_revision=2,
                )
            assert occupied.value.code is ErrorCode.STATE_CONFLICT

        async with async_session_factory() as session:
            reloaded = await load_journey(session, journey_id, workspace_id)
            assert reloaded.journey.revision == 2
            assert len(reloaded.agents) == 1
    finally:
        async with async_session_factory() as cleanup_session, cleanup_session.begin():
            if journey_id is not None:
                await cleanup_session.execute(delete(OdyJourney).where(OdyJourney.id == journey_id))
            await cleanup_session.execute(delete(Workspace).where(Workspace.id == workspace_id))
