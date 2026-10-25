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
    schema_version: Literal["1.0.0", "1.1.0"]
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
        for slot in self.slots:
            direction = slot.configuration.get("direction")
            if direction is not None and (
                self.kind is not PatternKind.HUB_AND_SPOKE
                or slot.topology_role != "spoke"
                or direction not in ("hub_to_spoke", "spoke_to_hub", "bidirectional")
            ):
                raise ValueError("Direction belongs to a Hub spoke and must be supported")
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


class RoutingConfirmation(ApiModel):
    agent_id: UUID
    revision: Revision
    removed_end_ids: list[UUID]
    removed_edge_ids: list[UUID]


class RoutingImpact(RoutingConfirmation):
    legacy: bool


class SaveJourneyRequest(ApiModel):
    expected_revision: Revision
    pattern: PatternConfig
    routing_confirmation: list[RoutingConfirmation] | None = None


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


class EmptyConfig(ApiModel):
    pass


class LiteralValueSource(ApiModel):
    kind: Literal["literal"]
    value: JsonValue


class SystemValueSource(ApiModel):
    kind: Literal["system"]
    key: Literal["change_event", "document_id", "document_revision"]


class SystemKnowledgeSpaceReference(ApiModel):
    kind: Literal["system_knowledge_space"]
    key: Literal["target_knowledge_space"]


KnowledgeSpaceReference = UUID | SystemKnowledgeSpaceReference


class VariableValueSource(ApiModel):
    kind: Literal["variable"]
    variable_id: UUID


class TextTemplateSegment(ApiModel):
    kind: Literal["text"]
    text: str


class VariableTemplateSegment(ApiModel):
    kind: Literal["variable"]
    variable_id: UUID


TemplateSegment = Annotated[
    TextTemplateSegment | VariableTemplateSegment | SystemValueSource, Field(discriminator="kind")
]


class TemplateValueSource(ApiModel):
    kind: Literal["template"]
    segments: Annotated[list[TemplateSegment], Field(min_length=1)]


ValueSource = Annotated[
    LiteralValueSource | VariableValueSource | TemplateValueSource | SystemValueSource,
    Field(discriminator="kind"),
]


class RetryFailureBehavior(ApiModel):
    kind: Literal["retry"]
    max_attempts: Literal[2]


class FailTaskFailureBehavior(ApiModel):
    kind: Literal["fail_task"]


ToolFailureBehavior = Annotated[
    RetryFailureBehavior | FailTaskFailureBehavior, Field(discriminator="kind")
]


class ToolOutputMapping(ApiModel):
    source_key: Annotated[str, Field(min_length=1)]
    target_variable_id: UUID


class KnowledgeRetrievalConfiguration(ApiModel):
    knowledge_space_id: KnowledgeSpaceReference
    query: ValueSource
    top_k: Annotated[int, Field(gt=0)] | None = None


class ReusableKnowledgeConfiguration(ApiModel):
    knowledge_space_id: KnowledgeSpaceReference
    # The shared editor contract models these fields as optional, not nullable.
    # Keep accepting persisted legacy nulls, but omit them at the API boundary.
    query: ValueSource | None = Field(default=None, exclude_if=lambda value: value is None)
    top_k: Annotated[int, Field(gt=0)] | None = Field(
        default=None, exclude_if=lambda value: value is None
    )


class ScriptInput(ApiModel):
    alias: Annotated[str, Field(pattern=r"^[A-Za-z_$][A-Za-z0-9_$]*$")]
    variable_id: UUID


class ScriptExecutionConfiguration(ApiModel):
    language: Literal["python", "javascript"]
    inputs: list[ScriptInput] = Field(default_factory=list)
    script: Annotated[str, Field(min_length=1)]

    @model_validator(mode="after")
    def validate_aliases(self) -> "ScriptExecutionConfiguration":
        aliases = [item.alias for item in self.inputs]
        if len(set(aliases)) != len(aliases):
            raise ValueError("Script input aliases must be unique")
        return self


class ApiHeader(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1)]
    value: ValueSource


class NoApiRequestBody(ApiModel):
    kind: Literal["none"]


class JsonApiRequestBody(ApiModel):
    kind: Literal["json"]
    value: ValueSource


class ApiFormEntry(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1)]
    value: ValueSource


class FormDataApiRequestBody(ApiModel):
    kind: Literal["form_data"]
    entries: list[ApiFormEntry]


ApiRequestBody = Annotated[
    NoApiRequestBody | JsonApiRequestBody | FormDataApiRequestBody,
    Field(discriminator="kind"),
]


class ApiRequestConfiguration(ApiModel):
    method: Literal["GET", "POST", "PUT", "DELETE"]
    url: ValueSource
    headers: list[ApiHeader]
    body: ApiRequestBody

    @model_validator(mode="after")
    def validate_headers(self) -> "ApiRequestConfiguration":
        names = [header.name.casefold() for header in self.headers]
        if len(set(names)) != len(names):
            raise ValueError("API header names must be unique case-insensitively")
        return self


class SetVariableValueConfiguration(ApiModel):
    target_variable_id: UUID
    operation: Literal["assign", "append", "increment"]
    value: ValueSource


class ToggleVariableConfiguration(ApiModel):
    target_variable_id: UUID
    operation: Literal["toggle"]


SetVariableConfiguration = Annotated[
    SetVariableValueConfiguration | ToggleVariableConfiguration,
    Field(discriminator="operation"),
]


class LlmCallConfiguration(ApiModel):
    model: Annotated[str, Field(min_length=1)]
    system_prompt: ValueSource | None = None
    prompt: ValueSource


class TaskLocalVariable(ApiModel):
    id: UUID
    key: Annotated[str, Field(min_length=1)]
    data_type: Literal["string", "number", "boolean", "json"]
    default_value: JsonValue


class KnowledgeRetrievalToolStep(ApiModel):
    id: UUID
    label: str | None = None
    failure_behavior: ToolFailureBehavior
    kind: Literal["knowledge_retrieval"]
    configuration: KnowledgeRetrievalConfiguration
    output_mapping: ToolOutputMapping | None

    @model_validator(mode="after")
    def validate_output_source(self) -> "KnowledgeRetrievalToolStep":
        if (
            self.output_mapping is not None
            and self.output_mapping.source_key != "retrieved_documents"
        ):
            raise ValueError("Knowledge retrieval output source must be retrieved_documents")
        return self


class ScriptExecutionToolStep(ApiModel):
    id: UUID
    label: str | None = None
    failure_behavior: ToolFailureBehavior
    kind: Literal["script_execution"]
    configuration: ScriptExecutionConfiguration
    output_mapping: ToolOutputMapping | None

    @model_validator(mode="after")
    def validate_output_source(self) -> "ScriptExecutionToolStep":
        if self.output_mapping is not None and self.output_mapping.source_key != "result":
            raise ValueError("Script output source must be result")
        return self


class ApiRequestToolStep(ApiModel):
    id: UUID
    label: str | None = None
    failure_behavior: ToolFailureBehavior
    kind: Literal["api_request"]
    configuration: ApiRequestConfiguration
    output_mapping: ToolOutputMapping | None

    @model_validator(mode="after")
    def validate_output_source(self) -> "ApiRequestToolStep":
        if self.output_mapping is not None and self.output_mapping.source_key != "response.data":
            raise ValueError("API output source must be response.data")
        return self


class SetVariableToolStep(ApiModel):
    id: UUID
    label: str | None = None
    failure_behavior: ToolFailureBehavior
    kind: Literal["set_variable"]
    configuration: SetVariableConfiguration
    output_mapping: None


class LlmCallToolStep(ApiModel):
    id: UUID
    label: str | None = None
    failure_behavior: ToolFailureBehavior
    kind: Literal["llm_call"]
    configuration: LlmCallConfiguration
    output_mapping: ToolOutputMapping | None

    @model_validator(mode="after")
    def validate_output_source(self) -> "LlmCallToolStep":
        if self.output_mapping is not None and self.output_mapping.source_key != "response.text":
            raise ValueError("LLM output source must be response.text")
        return self


ToolStep = Annotated[
    KnowledgeRetrievalToolStep
    | ScriptExecutionToolStep
    | ApiRequestToolStep
    | SetVariableToolStep
    | LlmCallToolStep,
    Field(discriminator="kind"),
]


class AgentActionConfig(ApiModel):
    model: Annotated[str, Field(min_length=1)]
    goal: ValueSource
    knowledge_space_ids: list[KnowledgeSpaceReference]
    reusable_tool_ids: list[UUID]

    @model_validator(mode="after")
    def validate_unique_references(self) -> "AgentActionConfig":
        if len(
            {
                str(reference) if isinstance(reference, UUID) else reference.key
                for reference in self.knowledge_space_ids
            }
        ) != len(self.knowledge_space_ids):
            raise ValueError("Knowledge Space references must be unique")
        if len(set(self.reusable_tool_ids)) != len(self.reusable_tool_ids):
            raise ValueError("Reusable Tool references must be unique")
        return self


class TaskConfig(ApiModel):
    local_variables: list[TaskLocalVariable]
    steps: list[ToolStep]

    @model_validator(mode="after")
    def validate_unique_ids(self) -> "TaskConfig":
        for entries in (self.local_variables, self.steps):
            ids = [entry.id for entry in entries]
            if len(set(ids)) != len(ids):
                raise ValueError("Task local Variable and step IDs must be unique")
        return self


class BinaryBranchCondition(ApiModel):
    id: UUID
    left: ValueSource
    operator: Literal["eq", "neq", "gt", "gte", "lt", "lte", "contains", "not_contains"]
    right: ValueSource


class UnaryBranchCondition(ApiModel):
    id: UUID
    left: ValueSource
    operator: Literal["is_empty", "is_not_empty"]


BranchCondition = BinaryBranchCondition | UnaryBranchCondition


class BranchCase(ApiModel):
    id: UUID
    label: Annotated[str, Field(min_length=1)]
    match: Literal["all"]
    conditions: Annotated[list[BranchCondition], Field(min_length=1)]


class BranchDefaultCase(ApiModel):
    id: UUID
    label: Annotated[str, Field(min_length=1)]


class BranchConfig(ApiModel):
    cases: list[BranchCase]
    default_case: BranchDefaultCase

    @model_validator(mode="after")
    def validate_handle_ids(self) -> "BranchConfig":
        ids = [self.default_case.id]
        for branch_case in self.cases:
            ids.append(branch_case.id)
            ids.extend(condition.id for condition in branch_case.conditions)
        if len(set(ids)) != len(ids):
            raise ValueError("Branch handle and condition IDs must be unique")
        return self


class StartNode(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1)]
    type: Literal["start"]
    configuration: EmptyConfig = Field(alias="config")


class EndBinding(ApiModel):
    source_slot_id: UUID
    target: PatternRouteTarget


class EndConfig(ApiModel):
    binding: EndBinding | None = None


class EndNode(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1)]
    type: Literal["end"]
    configuration: EndConfig = Field(alias="config")


class LoopStartNode(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1)]
    type: Literal["loop_start"]
    configuration: EmptyConfig = Field(alias="config")


class LoopEndNode(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1)]
    type: Literal["loop_end"]
    configuration: EmptyConfig = Field(alias="config")


class AgentActionNode(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1)]
    type: Literal["agent_action"]
    configuration: AgentActionConfig = Field(alias="config")


class TaskNode(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1)]
    type: Literal["task"]
    configuration: TaskConfig = Field(alias="config")


class BranchNode(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1)]
    type: Literal["branch"]
    configuration: BranchConfig = Field(alias="config")


class WorkflowEdge(ApiModel):
    id: UUID
    source_node_id: UUID
    source_handle_id: UUID | None = None
    target_node_id: UUID


class NodePlacement(ApiModel):
    node_id: UUID
    x: Annotated[float, Field(allow_inf_nan=False)]
    y: Annotated[float, Field(allow_inf_nan=False)]
    width: Annotated[float, Field(ge=420, le=1600, allow_inf_nan=False)] | None = None
    height: Annotated[float, Field(ge=300, le=1200, allow_inf_nan=False)] | None = None


class CanvasViewport(ApiModel):
    x: Annotated[float, Field(allow_inf_nan=False)]
    y: Annotated[float, Field(allow_inf_nan=False)]
    zoom: Annotated[float, Field(gt=0, allow_inf_nan=False)]


class EmbeddedCanvasLayout(ApiModel):
    node_placements: list[NodePlacement]
    viewport: CanvasViewport

    @model_validator(mode="after")
    def validate_placements(self) -> "EmbeddedCanvasLayout":
        node_ids = [placement.node_id for placement in self.node_placements]
        if len(set(node_ids)) != len(node_ids):
            raise ValueError("Canvas layout may contain only one placement per node")
        return self


LoopBodyNode = Annotated[
    LoopStartNode | LoopEndNode | AgentActionNode | TaskNode | BranchNode,
    Field(discriminator="type"),
]


class LoopBodyGraph(ApiModel):
    nodes: list[LoopBodyNode]
    edges: list[WorkflowEdge]

    @model_validator(mode="after")
    def validate_references(self) -> "LoopBodyGraph":
        _validate_graph_references(self.nodes, self.edges)
        return self


class LoopBody(ApiModel):
    graph: LoopBodyGraph
    layout: EmbeddedCanvasLayout

    @model_validator(mode="after")
    def validate_layout_references(self) -> "LoopBody":
        node_ids = {node.id for node in self.graph.nodes}
        if not {item.node_id for item in self.layout.node_placements}.issubset(node_ids):
            raise ValueError("Loop placements must reference Loop body nodes")
        return self


class LoopExitCondition(ApiModel):
    kind: Literal["variable_comparison"]
    variable_id: UUID
    operator: Literal["eq", "neq", "gt", "gte", "lt", "lte"]
    value: JsonValue


class LoopConfig(ApiModel):
    max_turns: Annotated[int, Field(gt=0)]
    exit_condition: LoopExitCondition
    body: LoopBody


class LoopNode(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1)]
    type: Literal["loop"]
    configuration: LoopConfig = Field(alias="config")


WorkflowNode = Annotated[
    StartNode | EndNode | AgentActionNode | TaskNode | BranchNode | LoopNode,
    Field(discriminator="type"),
]


def _validate_graph_references(
    nodes: list[WorkflowNode] | list[LoopBodyNode], edges: list[WorkflowEdge]
) -> None:
    node_ids = [node.id for node in nodes]
    edge_ids = [edge.id for edge in edges]
    if len(set(node_ids)) != len(node_ids):
        raise ValueError("Workflow node IDs must be unique")
    if len(set(edge_ids)) != len(edge_ids):
        raise ValueError("Workflow edge IDs must be unique")
    node_by_id = {node.id: node for node in nodes}
    for edge in edges:
        if edge.source_node_id not in node_by_id or edge.target_node_id not in node_by_id:
            raise ValueError("Workflow edge endpoints must reference existing nodes")
        if edge.source_handle_id is not None:
            source = node_by_id[edge.source_node_id]
            if not isinstance(source, BranchNode):
                raise ValueError("Only Branch edges may use source handles")
            handle_ids = {source.configuration.default_case.id} | {
                item.id for item in source.configuration.cases
            }
            if edge.source_handle_id not in handle_ids:
                raise ValueError("Branch source handle must belong to its source Branch")


class WorkflowGraph(ApiModel):
    schema_version: Literal["1.0.0", "1.1.0", "1.2.0"]
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]

    @model_validator(mode="after")
    def validate_references(self) -> "WorkflowGraph":
        _validate_graph_references(self.nodes, self.edges)
        if self.schema_version != "1.2.0" and _nodes_have_system_binding(self.nodes):
            raise ValueError("System bindings require Workflow schemaVersion 1.2.0")
        if self.schema_version == "1.0.0" and any(
            isinstance(node, EndNode) and node.configuration.binding is not None
            for node in self.nodes
        ):
            raise ValueError("Pattern-bound exits require Workflow schemaVersion 1.1.0")
        return self


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


class ReusableToolBase(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1, max_length=255)]
    source_template_id: UUID | None
    input_bindings: list[ValueSource]
    output_binding: ToolOutputMapping | None


class ReusableKnowledgeTool(ReusableToolBase):
    kind: Literal["knowledge_retrieval"]
    configuration: ReusableKnowledgeConfiguration


class ReusableScriptTool(ReusableToolBase):
    kind: Literal["script_execution"]
    configuration: ScriptExecutionConfiguration


class ReusableApiTool(ReusableToolBase):
    kind: Literal["api_request"]
    configuration: ApiRequestConfiguration


class ReusableSetVariableTool(ReusableToolBase):
    kind: Literal["set_variable"]
    configuration: SetVariableConfiguration


class ReusableLlmTool(ReusableToolBase):
    kind: Literal["llm_call"]
    configuration: LlmCallConfiguration


AgentReusableTool = Annotated[
    ReusableKnowledgeTool
    | ReusableScriptTool
    | ReusableApiTool
    | ReusableSetVariableTool
    | ReusableLlmTool,
    Field(discriminator="kind"),
]


def _value_has_system_binding(value: ValueSource | None) -> bool:
    return isinstance(value, SystemValueSource) or (
        isinstance(value, TemplateValueSource)
        and any(isinstance(segment, SystemValueSource) for segment in value.segments)
    )


def _tool_has_system_binding(tool: ToolStep | AgentReusableTool) -> bool:
    if isinstance(tool, ReusableToolBase) and any(
        _value_has_system_binding(value) for value in tool.input_bindings
    ):
        return True
    config = tool.configuration
    if isinstance(config, KnowledgeRetrievalConfiguration | ReusableKnowledgeConfiguration):
        return isinstance(
            config.knowledge_space_id, SystemKnowledgeSpaceReference
        ) or _value_has_system_binding(config.query)
    if isinstance(config, LlmCallConfiguration):
        return _value_has_system_binding(config.prompt) or _value_has_system_binding(
            config.system_prompt
        )
    if isinstance(config, SetVariableValueConfiguration):
        return _value_has_system_binding(config.value)
    if isinstance(config, ApiRequestConfiguration):
        body = config.body
        return (
            _value_has_system_binding(config.url)
            or any(_value_has_system_binding(header.value) for header in config.headers)
            or (isinstance(body, JsonApiRequestBody) and _value_has_system_binding(body.value))
            or (
                isinstance(body, FormDataApiRequestBody)
                and any(_value_has_system_binding(entry.value) for entry in body.entries)
            )
        )
    return False


def _nodes_have_system_binding(nodes: list[WorkflowNode] | list[LoopBodyNode]) -> bool:
    for node in nodes:
        if isinstance(node, AgentActionNode):
            if _value_has_system_binding(node.configuration.goal) or any(
                isinstance(reference, SystemKnowledgeSpaceReference)
                for reference in node.configuration.knowledge_space_ids
            ):
                return True
        elif isinstance(node, TaskNode):
            if any(_tool_has_system_binding(step) for step in node.configuration.steps):
                return True
        elif isinstance(node, BranchNode):
            if any(
                _value_has_system_binding(condition.left)
                or (
                    isinstance(condition, BinaryBranchCondition)
                    and _value_has_system_binding(condition.right)
                )
                for case in node.configuration.cases
                for condition in case.conditions
            ):
                return True
        elif isinstance(node, LoopNode) and _nodes_have_system_binding(
            node.configuration.body.graph.nodes
        ):
            return True
    return False


def _validate_agent_reusable_tool_references(
    workflow: WorkflowGraph, reusable_tools: list[AgentReusableTool]
) -> None:
    if workflow.schema_version != "1.2.0" and (
        _nodes_have_system_binding(workflow.nodes)
        or any(_tool_has_system_binding(tool) for tool in reusable_tools)
    ):
        raise ValueError("System bindings require Workflow schemaVersion 1.2.0")
    reusable_tool_ids = [tool.id for tool in reusable_tools]
    if len(set(reusable_tool_ids)) != len(reusable_tool_ids):
        raise ValueError("Reusable Tool IDs must be unique within an Agent")
    available_ids = set(reusable_tool_ids)

    def visit(nodes: list[WorkflowNode] | list[LoopBodyNode]) -> None:
        for node in nodes:
            if isinstance(node, AgentActionNode):
                if any(
                    tool_id not in available_ids for tool_id in node.configuration.reusable_tool_ids
                ):
                    raise ValueError(
                        "Agent Action must reference a reusable Tool owned by the Agent"
                    )
            elif isinstance(node, LoopNode):
                visit(node.configuration.body.graph.nodes)

    visit(workflow.nodes)


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
        _validate_agent_reusable_tool_references(self.workflow, self.reusable_tools)
        return self


class SaveAgentWorkflowRequest(ApiModel):
    expected_revision: Revision
    workflow: WorkflowGraph
    layout: CanvasLayout
    variables: list[AgentVariable]
    reusable_tools: list[AgentReusableTool]

    @model_validator(mode="after")
    def validate_reusable_tool_references(self) -> "SaveAgentWorkflowRequest":
        _validate_agent_reusable_tool_references(self.workflow, self.reusable_tools)
        return self


class SaveAgentAsTemplateRequest(ApiModel):
    name: Annotated[str, Field(min_length=1, max_length=255)]
    description: str | None


class AgentTemplateSnapshot(ApiModel):
    workflow: WorkflowGraph
    layout: CanvasLayout
    variables: list[AgentVariable]
    reusable_tools: list[AgentReusableTool]

    @model_validator(mode="after")
    def validate_system_bindings(self) -> "AgentTemplateSnapshot":
        _validate_agent_reusable_tool_references(self.workflow, self.reusable_tools)
        return self


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


class TemplateEndAssignment(ApiModel):
    end_node_id: UUID
    target: PatternRouteTarget


class InstantiateAgentTemplateRequest(ApiModel):
    expected_revision: Revision
    end_assignments: list[TemplateEndAssignment] | None = None


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
    routing_confirmation: list[RoutingConfirmation] | None = None
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
