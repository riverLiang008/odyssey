"""Pure Pattern-owned root boundary reconciliation; never invoked during rendering/read."""

from collections.abc import Callable
from dataclasses import dataclass
from uuid import UUID

from odyssey_api.errors import ApplicationError, ErrorCode
from odyssey_api.journeys.dto import (
    AgentTemplateSnapshot,
    CanvasLayout,
    EndBinding,
    EndConfig,
    EndNode,
    JourneyEndRouteTarget,
    NodePlacement,
    PatternConfig,
    PatternKind,
    TemplateEndAssignment,
    WorkflowGraph,
)


def bind_template_exits(
    snapshot: AgentTemplateSnapshot,
    pattern: PatternConfig,
    slot_id: UUID,
    assignments: list[TemplateEndAssignment] | None,
) -> AgentTemplateSnapshot:
    """Explicitly adapt portable exits before remapping owned IDs; never match by name/order."""
    result = snapshot.model_copy(deep=True)
    bindings = derive_end_bindings(pattern, slot_id)
    ends = [node for node in result.workflow.nodes if isinstance(node, EndNode)]
    supplied = {item.end_node_id: item.target for item in assignments or []}
    if not ends or (
        assignments is not None
        and (len(supplied) != len(assignments) or set(supplied) != {end.id for end in ends})
    ):
        raise ApplicationError(
            ErrorCode.STATE_CONFLICT, details={"reason": "TEMPLATE_END_MAPPING_REQUIRED"}
        )
    if len(bindings) > 1 and not supplied:
        raise ApplicationError(
            ErrorCode.STATE_CONFLICT, details={"reason": "TEMPLATE_END_MAPPING_REQUIRED"}
        )
    canonical: dict[str, UUID] = {}
    remap: dict[UUID, UUID] = {}
    for end in ends:
        target = supplied.get(end.id, bindings[0].target)
        binding = next((item for item in bindings if item.target == target), None)
        if binding is None:
            raise ApplicationError(
                ErrorCode.STATE_CONFLICT, details={"reason": "TEMPLATE_END_MAPPING_REQUIRED"}
            )
        end.configuration = EndConfig(binding=binding.model_copy(deep=True))
        key = binding.model_dump_json()
        if key in canonical:
            remap[end.id] = canonical[key]
        else:
            canonical[key] = end.id
    result.workflow.nodes = [node for node in result.workflow.nodes if node.id not in remap]
    result.layout.node_placements = [
        item for item in result.layout.node_placements if item.node_id not in remap
    ]
    seen: set[tuple[UUID, UUID | None, UUID]] = set()
    edges = []
    for edge in result.workflow.edges:
        edge.target_node_id = remap.get(edge.target_node_id, edge.target_node_id)
        key = (edge.source_node_id, edge.source_handle_id, edge.target_node_id)
        if key not in seen:
            edges.append(edge)
            seen.add(key)
    result.workflow.edges = edges
    result.workflow.schema_version = (
        "1.2.0" if snapshot.workflow.schema_version == "1.2.0" else "1.1.0"
    )
    return result


def derive_end_bindings(pattern: PatternConfig, slot_id: UUID) -> list[EndBinding]:
    if not any(slot.id == slot_id for slot in pattern.slots):
        raise ValueError("Routing requires an existing source Slot")
    bindings = [
        EndBinding(source_slot_id=slot_id, target=route.target.model_copy(deep=True))
        for route in pattern.routes
        if route.source_slot_id == slot_id
    ]
    return bindings or [
        EndBinding(source_slot_id=slot_id, target=JourneyEndRouteTarget(type="journey_end"))
    ]


@dataclass(frozen=True)
class EndRoutingResult:
    workflow: WorkflowGraph
    layout: CanvasLayout
    removed_end_ids: tuple[UUID, ...]
    removed_edge_ids: tuple[UUID, ...]
    changed: bool


def reconcile_workflow_ends(
    workflow: WorkflowGraph,
    layout: CanvasLayout,
    pattern: PatternConfig,
    slot_id: UUID,
    id_factory: Callable[[], UUID],
) -> EndRoutingResult:
    bindings = derive_end_bindings(pattern, slot_id)
    ends = [node for node in workflow.nodes if isinstance(node, EndNode)]
    sequential = pattern.kind in (PatternKind.LINEAR_SEQUENCE, PatternKind.DIAMOND_LOOP)
    single_legacy = len(ends) == 1 and ends[0].configuration.binding is None
    retained: set[UUID] = set()
    next_ends: list[EndNode] = []
    for binding in bindings:
        existing = next(
            (
                end
                for end in ends
                if end.id not in retained and end.configuration.binding == binding
            ),
            None,
        )
        if existing is None and len(ends) == len(bindings) == 1 and (sequential or single_legacy):
            existing = ends[0]
        if existing is not None:
            retained.add(existing.id)
        next_ends.append(
            EndNode(
                id=existing.id if existing else id_factory(),
                name=existing.name if existing else "End",
                type="end",
                config=EndConfig(binding=binding),
            )
        )
    removed = {end.id for end in ends if end.id not in retained}
    removed_edges = tuple(
        edge.id
        for edge in workflow.edges
        if edge.source_node_id in removed or edge.target_node_id in removed
    )
    graph = workflow.model_copy(deep=True)
    graph.schema_version = "1.2.0" if workflow.schema_version == "1.2.0" else "1.1.0"
    graph.nodes = [node for node in graph.nodes if not isinstance(node, EndNode)] + next_ends
    graph.edges = [
        edge
        for edge in graph.edges
        if edge.source_node_id not in removed and edge.target_node_id not in removed
    ]
    next_layout = layout.model_copy(deep=True)
    next_layout.node_placements = [
        item for item in next_layout.node_placements if item.node_id not in removed
    ]
    placed = {item.node_id for item in next_layout.node_placements}
    internal_ids = {node.id for node in workflow.nodes if not isinstance(node, EndNode)}
    x = (
        max([0, *[item.x for item in next_layout.node_placements if item.node_id in internal_ids]])
        + 260
    )
    for index, end in enumerate(next_ends):
        if end.id not in placed:
            y = index * 100
            while any(
                item.x == x and abs(item.y - y) < 100 for item in next_layout.node_placements
            ):
                y += 100
            next_layout.node_placements.append(NodePlacement(node_id=end.id, x=x, y=y))
    old_by_id = {end.id: end for end in ends}
    changed = (
        workflow.schema_version == "1.0.0"
        or len(ends) != len(next_ends)
        or any(old_by_id.get(end.id) != end for end in next_ends)
        or next_layout != layout
        or bool(removed_edges)
    )
    return EndRoutingResult(
        graph if changed else workflow.model_copy(deep=True),
        next_layout,
        tuple(sorted(removed)),
        removed_edges,
        changed,
    )
