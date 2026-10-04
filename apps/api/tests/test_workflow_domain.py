from uuid import UUID

from odyssey_api.journeys.workflow_domain import create_minimum_workflow


class SequentialIds:
    def __init__(self) -> None:
        self.value = 100

    def __call__(self) -> UUID:
        result = UUID(f"00000000-0000-4000-8000-{self.value:012d}")
        self.value += 1
        return result


def test_minimum_workflow_is_start_to_end_with_separate_layout() -> None:
    graph, layout = create_minimum_workflow(SequentialIds())
    assert [node.type for node in graph.nodes] == ["start", "end"]
    assert len(graph.edges) == 1
    assert graph.edges[0].source_node_id == graph.nodes[0].id
    assert graph.edges[0].target_node_id == graph.nodes[1].id
    assert {placement.node_id for placement in layout.node_placements} == {
        node.id for node in graph.nodes
    }
    assert [(placement.x, placement.y) for placement in layout.node_placements] == [
        (0.0, 0.0),
        (200.0, 0.0),
    ]
    assert "x" not in graph.model_dump_json()
