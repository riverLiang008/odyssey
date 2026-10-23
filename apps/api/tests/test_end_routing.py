import json
from pathlib import Path
from uuid import uuid4

import pytest
from pydantic import ValidationError

from odyssey_api.errors import ApplicationError
from odyssey_api.journeys.dto import (
    AgentTemplateSnapshot,
    EndConfig,
    EndNode,
    PatternKind,
    TemplateEndAssignment,
)
from odyssey_api.journeys.end_routing import (
    bind_template_exits,
    derive_end_bindings,
    reconcile_workflow_ends,
)
from odyssey_api.journeys.pattern_domain import instantiate_pattern, remove_slot, validate_pattern
from odyssey_api.journeys.workflow_domain import create_minimum_workflow


def test_hub_generates_empty_targets_without_ambiguous_legacy_fanout() -> None:
    pattern = instantiate_pattern(PatternKind.HUB_AND_SPOKE, uuid4)
    workflow, layout = create_minimum_workflow(uuid4)
    original = workflow.model_copy(deep=True)
    result = reconcile_workflow_ends(workflow, layout, pattern, pattern.slots[0].id, uuid4)
    assert len([node for node in result.workflow.nodes if isinstance(node, EndNode)]) == 4
    assert result.removed_edge_ids == (workflow.edges[0].id,)
    assert result.workflow.edges == []
    assert workflow == original
    repeated = reconcile_workflow_ends(
        result.workflow, result.layout, pattern, pattern.slots[0].id, uuid4
    )
    assert not repeated.changed


def test_linear_boundary_keeps_identity_and_incoming_path_when_next_changes() -> None:
    pattern = instantiate_pattern(PatternKind.LINEAR_SEQUENCE, uuid4)
    workflow, layout = create_minimum_workflow(uuid4)
    first = reconcile_workflow_ends(workflow, layout, pattern, pattern.slots[0].id, uuid4)
    pattern.routes[0].target = pattern.routes[1].target.model_copy(deep=True)
    second = reconcile_workflow_ends(
        first.workflow, first.layout, pattern, pattern.slots[0].id, uuid4
    )
    assert second.workflow.edges == workflow.edges
    assert not second.removed_end_ids


def test_leaf_receives_one_completion_boundary() -> None:
    pattern = instantiate_pattern(PatternKind.HUB_AND_SPOKE, uuid4)
    assert len(derive_end_bindings(pattern, pattern.slots[1].id)) == 1
    assert derive_end_bindings(pattern, pattern.slots[1].id)[0].target.type == "journey_end"


def test_shared_end_config_fixtures() -> None:
    fixtures = json.loads(
        (Path(__file__).parents[3] / "packages/schemas/fixtures/end-routing.json").read_text(
            encoding="utf-8"
        )
    )
    for candidate in fixtures["valid"]:
        EndConfig.model_validate(candidate)
    for candidate in fixtures["invalid"]:
        with pytest.raises(ValidationError):
            EndConfig.model_validate(candidate)


def test_template_requires_explicit_choice_and_preserves_path_to_chosen_target() -> None:
    pattern = instantiate_pattern(PatternKind.HUB_AND_SPOKE, uuid4)
    workflow, layout = create_minimum_workflow(uuid4)
    snapshot = AgentTemplateSnapshot(
        workflow=workflow, layout=layout, variables=[], reusable_tools=[]
    )
    hub = pattern.slots[0]
    with pytest.raises(ApplicationError) as required:
        bind_template_exits(snapshot, pattern, hub.id, None)
    assert required.value.details["reason"] == "TEMPLATE_END_MAPPING_REQUIRED"
    end = next(node for node in workflow.nodes if isinstance(node, EndNode))
    chosen = derive_end_bindings(pattern, hub.id)[2]
    prepared = bind_template_exits(
        snapshot, pattern, hub.id, [TemplateEndAssignment(end_node_id=end.id, target=chosen.target)]
    )
    result = reconcile_workflow_ends(prepared.workflow, prepared.layout, pattern, hub.id, uuid4)
    assert result.workflow.edges == workflow.edges
    routed_end = next(node for node in result.workflow.nodes if node.id == end.id)
    assert isinstance(routed_end, EndNode)
    assert routed_end.configuration.binding == chosen
    assert len([node for node in result.workflow.nodes if isinstance(node, EndNode)]) == 4
    assert end.configuration.binding is None


def test_circle_entry_removal_uses_its_successor_after_reorder_without_mutating_input() -> None:
    from odyssey_api.journeys.dto import PatternRoute, SlotRouteTarget

    pattern = instantiate_pattern(PatternKind.DIAMOND_LOOP, uuid4)
    entry, first, second, successor = pattern.slots
    pattern.slots = [first, second, entry, successor]
    for order, slot in enumerate(pattern.slots):
        slot.order = order
    pattern.routes = [
        PatternRoute(
            id=uuid4(),
            source_slot_id=slot.id,
            target=SlotRouteTarget(type="slot", slot_id=pattern.slots[(index + 1) % 4].id),
        )
        for index, slot in enumerate(pattern.slots)
    ]
    assert not validate_pattern(pattern)
    before = pattern.model_copy(deep=True)
    preserved_route = pattern.routes[0].id
    result = remove_slot(pattern, entry.id, uuid4)
    assert not validate_pattern(result)
    assert next(slot.id for slot in result.slots if slot.topology_role == "entry") == successor.id
    assert (
        next(route.id for route in result.routes if route.source_slot_id == first.id)
        == preserved_route
    )
    assert pattern == before
