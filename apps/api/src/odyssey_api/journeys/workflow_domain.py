from collections.abc import Callable, Sequence
from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

from odyssey_api.journeys.dto import (
    AgentActionNode,
    AgentReusableTool,
    CanvasLayout,
    CanvasViewport,
    EndNode,
    KnowledgeRetrievalToolStep,
    LoopNode,
    NodePlacement,
    ReusableKnowledgeTool,
    StartNode,
    TaskNode,
    WorkflowGraph,
)


class KnowledgeReferenceOwnerKind(StrEnum):
    AGENT_ACTION = "agent_action"
    REUSABLE_TOOL = "reusable_tool"
    TASK_TOOL = "task_tool"


@dataclass(frozen=True, slots=True)
class WorkflowKnowledgeReference:
    knowledge_space_id: UUID
    owner_kind: KnowledgeReferenceOwnerKind
    owner_id: UUID
    issue_path: tuple[str | int, ...]


def extract_knowledge_space_references(
    workflow: WorkflowGraph, reusable_tools: list[AgentReusableTool]
) -> list[WorkflowKnowledgeReference]:
    references: list[WorkflowKnowledgeReference] = []

    def visit_nodes(nodes: Sequence[object], path: tuple[str | int, ...]) -> None:
        for node_index, node in enumerate(nodes):
            node_path = (*path, node_index)
            if isinstance(node, AgentActionNode):
                for index, knowledge_space_id in enumerate(node.configuration.knowledge_space_ids):
                    if not isinstance(knowledge_space_id, UUID):
                        continue
                    reference_path = (*node_path, "config", "knowledgeSpaceIds", index)
                    references.append(
                        WorkflowKnowledgeReference(
                            knowledge_space_id,
                            KnowledgeReferenceOwnerKind.AGENT_ACTION,
                            node.id,
                            reference_path,
                        )
                    )
            elif isinstance(node, TaskNode):
                for step_index, step in enumerate(node.configuration.steps):
                    if not isinstance(step, KnowledgeRetrievalToolStep) or not isinstance(
                        step.configuration.knowledge_space_id, UUID
                    ):
                        continue
                    reference_path = (
                        *node_path,
                        "config",
                        "steps",
                        step_index,
                        "configuration",
                        "knowledgeSpaceId",
                    )
                    references.append(
                        WorkflowKnowledgeReference(
                            step.configuration.knowledge_space_id,
                            KnowledgeReferenceOwnerKind.TASK_TOOL,
                            step.id,
                            reference_path,
                        )
                    )
            elif isinstance(node, LoopNode):
                visit_nodes(
                    node.configuration.body.graph.nodes,
                    (*node_path, "config", "body", "graph", "nodes"),
                )

    visit_nodes(workflow.nodes, ("workflow", "nodes"))
    for index, tool in enumerate(reusable_tools):
        if not isinstance(tool, ReusableKnowledgeTool) or not isinstance(
            tool.configuration.knowledge_space_id, UUID
        ):
            continue
        path = ("reusableTools", index, "configuration", "knowledgeSpaceId")
        references.append(
            WorkflowKnowledgeReference(
                tool.configuration.knowledge_space_id,
                KnowledgeReferenceOwnerKind.REUSABLE_TOOL,
                tool.id,
                path,
            )
        )
    return references


def create_minimum_workflow(
    id_factory: Callable[[], UUID],
) -> tuple[WorkflowGraph, CanvasLayout]:
    start_id = id_factory()
    end_id = id_factory()
    graph = WorkflowGraph(
        schema_version="1.0.0",
        nodes=[
            StartNode(id=start_id, name="Start", type="start", config={}),
            EndNode(id=end_id, name="End", type="end", config={}),
        ],
        edges=[],
    )
    layout = CanvasLayout(
        schema_version="1.0.0",
        node_placements=[
            NodePlacement(node_id=start_id, x=0, y=0),
            NodePlacement(node_id=end_id, x=200, y=0),
        ],
        viewport=CanvasViewport(x=0, y=0, zoom=1),
    )
    return graph, layout
