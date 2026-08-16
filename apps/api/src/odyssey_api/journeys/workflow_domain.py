from collections.abc import Callable
from uuid import UUID

from odyssey_api.journeys.dto import (
    CanvasLayout,
    CanvasViewport,
    NodePlacement,
    WorkflowEdge,
    WorkflowGraph,
    WorkflowNode,
)


def create_minimum_workflow(
    id_factory: Callable[[], UUID],
) -> tuple[WorkflowGraph, CanvasLayout]:
    start_id = id_factory()
    end_id = id_factory()
    graph = WorkflowGraph(
        schema_version="1.0.0",
        nodes=[
            WorkflowNode(id=start_id, name="Start", type="start", config={}),
            WorkflowNode(id=end_id, name="End", type="end", config={}),
        ],
        edges=[
            WorkflowEdge(
                id=id_factory(),
                source_node_id=start_id,
                target_node_id=end_id,
            )
        ],
    )
    layout = CanvasLayout(
        schema_version="1.0.0",
        node_placements=[
            NodePlacement(node_id=start_id, x=0, y=0),
            NodePlacement(node_id=end_id, x=240, y=0),
        ],
        viewport=CanvasViewport(x=0, y=0, zoom=1),
    )
    return graph, layout
