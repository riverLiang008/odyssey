from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, JsonValue, model_validator

from odyssey_api.journeys.guardrail_domain import (
    validate_guardrail_agent_ids,
)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=lambda value: (
            value.split("_")[0] + "".join(part.title() for part in value.split("_")[1:])
        ),
        populate_by_name=True,
        extra="forbid",
    )


Revision = Annotated[int, Field(ge=1)]
SchemaVersion = Literal["1.0.0"]


class PatternKind(StrEnum):
    HUB_AND_SPOKE = "hub_and_spoke"
    DIAMOND_LOOP = "diamond_loop"
    LINEAR_SEQUENCE = "linear_sequence"
    SOLO_COMPONENT = "solo_component"


class JourneyStatus(StrEnum):
    DRAFT = "draft"
    ARCHIVED = "archived"


class SlotRouteTarget(ApiModel):
    type: Literal["slot"]
    slot_id: UUID


class JourneyEndRouteTarget(ApiModel):
    type: Literal["journey_end"]


PatternRouteTarget = Annotated[SlotRouteTarget | JourneyEndRouteTarget, Field(discriminator="type")]


class PatternSlot(ApiModel):
    id: UUID
    topology_role: str | None
    label: Annotated[str, Field(min_length=1)]
    order: Annotated[int, Field(ge=0)] | None
    agent_id: UUID | None
    configuration: dict[str, JsonValue]


class PatternRoute(ApiModel):
    id: UUID
    source_slot_id: UUID
    target: PatternRouteTarget


class PatternConfig(ApiModel):
    schema_version: SchemaVersion
    id: UUID
    template_key: PatternKind
    kind: PatternKind
    name: Annotated[str, Field(min_length=1)]
    slots: list[PatternSlot]
    routes: list[PatternRoute]
    configuration: dict[str, JsonValue]

    @model_validator(mode="after")
    def validate_references(self) -> "PatternConfig":
        slot_ids = [slot.id for slot in self.slots]
        if len(set(slot_ids)) != len(slot_ids):
            raise ValueError("Pattern slot IDs must be unique")
        route_ids = [route.id for route in self.routes]
        if len(set(route_ids)) != len(route_ids):
            raise ValueError("Pattern route IDs must be unique")
        slot_id_set = set(slot_ids)
        for route in self.routes:
            if route.source_slot_id not in slot_id_set:
                raise ValueError("Pattern route source must reference an existing slot")
            if (
                isinstance(route.target, SlotRouteTarget)
                and route.target.slot_id not in slot_id_set
            ):
                raise ValueError("Pattern route target must reference an existing slot")
        return self


class JourneyMetadata(ApiModel):
    id: UUID
    workspace_id: UUID
    name: Annotated[str, Field(min_length=1, max_length=255)]
    description: str | None
    status: JourneyStatus
    tags: list[str]
    revision: Revision
    created_at: datetime
    updated_at: datetime


class AgentSummary(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1, max_length=255)]
    description: str | None
    revision: Revision
    updated_at: datetime


class InactiveGuardrail(ApiModel):
    state: Literal["inactive"]


class ActiveGuardrail(ApiModel):
    state: Literal["active"]
    structure: Literal["single"]
    agent_id: UUID


GuardrailProjection = Annotated[
    InactiveGuardrail | ActiveGuardrail,
    Field(discriminator="state"),
]


class JourneyEditorDocument(ApiModel):
    journey: JourneyMetadata
    pattern: PatternConfig
    agents: list[AgentSummary]
    input_guardrail: GuardrailProjection
    output_guardrail: GuardrailProjection

    @model_validator(mode="after")
    def validate_agent_references(self) -> "JourneyEditorDocument":
        agent_ids = [agent.id for agent in self.agents]
        if len(set(agent_ids)) != len(agent_ids):
            raise ValueError("Agent summary IDs must be unique")
        assigned_ids = [slot.agent_id for slot in self.pattern.slots if slot.agent_id is not None]
        if len(set(assigned_ids)) != len(assigned_ids):
            raise ValueError("An Agent may occupy only one Pattern slot")
        if not set(assigned_ids).issubset(agent_ids):
            raise ValueError("Occupied slots must reference an Agent summary")
        issues = validate_guardrail_agent_ids(
            input_agent_id=(
                self.input_guardrail.agent_id
                if isinstance(self.input_guardrail, ActiveGuardrail)
                else None
            ),
            output_agent_id=(
                self.output_guardrail.agent_id
                if isinstance(self.output_guardrail, ActiveGuardrail)
                else None
            ),
            journey_agent_ids=set(agent_ids),
            pattern_agent_ids=set(assigned_ids),
        )
        if issues:
            raise ValueError(
                "Invalid Guardrail state: " + ",".join(issue.value for issue in issues)
            )
        return self


class CreateJourneyRequest(ApiModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "name": "Customer support journey",
                    "description": "Routes incoming requests through a support workflow.",
                    "patternTemplateKey": "linear_sequence",
                }
            ]
        }
    )

    name: Annotated[str, Field(min_length=1, max_length=255)]
    description: str | None
    pattern_template_key: PatternKind


class SaveJourneyRequest(ApiModel):
    expected_revision: Revision
    pattern: PatternConfig


class JourneySummary(ApiModel):
    id: UUID
    name: str
    description: str | None
    status: JourneyStatus
    pattern_kind: PatternKind
    agent_count: Annotated[int, Field(ge=0)]
    revision: Revision
    created_at: datetime
    updated_at: datetime


class CreateMinimumAgentRequest(ApiModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"expectedRevision": 3}]})

    expected_revision: Revision


class AddGuardrailRequest(ApiModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"expectedRevision": 3}]})

    expected_revision: Revision


class RemoveGuardrailRequest(ApiModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "expectedRevision": 4,
                    "expectedAgentId": "0195f076-b6e6-7ef0-98db-d721990f8002",
                }
            ]
        }
    )

    expected_revision: Revision
    expected_agent_id: UUID


class WorkflowNode(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1)]
    type: Literal["start", "end", "agent_action", "task", "branch", "loop"]
    configuration: dict[str, JsonValue] = Field(alias="config")


class WorkflowEdge(ApiModel):
    id: UUID
    source_node_id: UUID
    source_handle_id: UUID | None = None
    target_node_id: UUID


class WorkflowGraph(ApiModel):
    schema_version: SchemaVersion
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]

    @model_validator(mode="after")
    def validate_references(self) -> "WorkflowGraph":
        node_ids = [node.id for node in self.nodes]
        edge_ids = [edge.id for edge in self.edges]
        if len(set(node_ids)) != len(node_ids):
            raise ValueError("Workflow node IDs must be unique")
        if len(set(edge_ids)) != len(edge_ids):
            raise ValueError("Workflow edge IDs must be unique")
        node_id_set = set(node_ids)
        if any(
            edge.source_node_id not in node_id_set or edge.target_node_id not in node_id_set
            for edge in self.edges
        ):
            raise ValueError("Workflow edge endpoints must reference existing nodes")
        return self


class NodePlacement(ApiModel):
    node_id: UUID
    x: float
    y: float


class CanvasViewport(ApiModel):
    x: float
    y: float
    zoom: Annotated[float, Field(gt=0)]


class CanvasLayout(ApiModel):
    schema_version: SchemaVersion
    node_placements: list[NodePlacement]
    viewport: CanvasViewport

    @model_validator(mode="after")
    def validate_placements(self) -> "CanvasLayout":
        node_ids = [placement.node_id for placement in self.node_placements]
        if len(set(node_ids)) != len(node_ids):
            raise ValueError("Canvas layout may contain only one placement per node")
        return self


class AgentVariable(ApiModel):
    id: UUID
    key: Annotated[str, Field(min_length=1, max_length=255)]
    display_name: Annotated[str, Field(min_length=1, max_length=255)]
    description: str | None
    data_type: Literal["string", "number", "boolean", "json"]
    ownership: Literal["user_managed", "shared", "agent_managed"]
    default_value: JsonValue
    read_only: bool


class AgentReusableTool(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1, max_length=255)]
    source_template_id: UUID | None
    kind: Literal[
        "knowledge_retrieval",
        "script_execution",
        "api_request",
        "set_variable",
        "llm_call",
    ]
    configuration: dict[str, JsonValue]
    input_bindings: list[JsonValue]
    output_binding: dict[str, JsonValue] | None


class AgentMetadata(ApiModel):
    id: UUID
    journey_id: UUID
    name: Annotated[str, Field(min_length=1, max_length=255)]
    description: str | None
    revision: Revision
    created_at: datetime
    updated_at: datetime


class AgentWorkflowEditorDocument(ApiModel):
    agent: AgentMetadata
    workflow: WorkflowGraph
    layout: CanvasLayout
    variables: list[AgentVariable]
    reusable_tools: list[AgentReusableTool]

    @model_validator(mode="after")
    def validate_layout_references(self) -> "AgentWorkflowEditorDocument":
        node_ids = {node.id for node in self.workflow.nodes}
        placement_ids = {placement.node_id for placement in self.layout.node_placements}
        if not placement_ids.issubset(node_ids):
            raise ValueError("Canvas placements must reference Workflow nodes")
        return self


class SaveAgentWorkflowRequest(ApiModel):
    expected_revision: Revision
    workflow: WorkflowGraph
    layout: CanvasLayout
    variables: list[AgentVariable]
    reusable_tools: list[AgentReusableTool]


class SaveAgentAsTemplateRequest(ApiModel):
    name: Annotated[str, Field(min_length=1, max_length=255)]
    description: str | None


class AgentTemplateSnapshot(ApiModel):
    workflow: WorkflowGraph
    layout: CanvasLayout
    variables: list[AgentVariable]
    reusable_tools: list[AgentReusableTool]


class AgentTemplate(ApiModel):
    schema_version: SchemaVersion
    id: UUID
    name: Annotated[str, Field(min_length=1, max_length=255)]
    description: str | None
    source: Literal["built_in", "user"]
    owner_workspace_id: UUID | None
    source_template_id: UUID | None
    visibility: Literal["private", "public"]
    publication_status: Literal["draft", "published"]
    dependencies: list[dict[str, JsonValue]]
    snapshot: AgentTemplateSnapshot
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime


class InstantiateAgentTemplateRequest(ApiModel):
    expected_revision: Revision


class InstantiateAgentTemplateResponse(ApiModel):
    journey: JourneyEditorDocument
    agent: AgentWorkflowEditorDocument


class DiscardAgentAction(ApiModel):
    type: Literal["discard"]


class SaveTemplateAndDiscardAgentAction(ApiModel):
    type: Literal["save_as_template_and_discard"]
    template: SaveAgentAsTemplateRequest


RemoveAgentAction = Annotated[
    DiscardAgentAction | SaveTemplateAndDiscardAgentAction,
    Field(discriminator="type"),
]


class RemoveOccupiedSlotRequest(ApiModel):
    expected_revision: Revision
    expected_agent_id: UUID
    agent_action: RemoveAgentAction


class RemoveOccupiedSlotResponse(ApiModel):
    journey: JourneyEditorDocument
    template: AgentTemplate | None = None


class CreateMinimumAgentResponse(ApiModel):
    journey: JourneyEditorDocument
    agent: AgentWorkflowEditorDocument


class AddGuardrailResponse(ApiModel):
    journey: JourneyEditorDocument
    agent: AgentWorkflowEditorDocument
