from typing import Literal
from uuid import UUID

from pydantic import ConfigDict, Field, JsonValue

from odyssey_api.journeys.dto import ApiModel


class ToolDefinitionResponse(ApiModel):
    model_config = ConfigDict(strict=True)
    id: UUID
    kind: Literal[
        "knowledge_retrieval", "script_execution", "api_request", "set_variable", "llm_call"
    ]
    source: Literal["built_in"]
    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    description: str | None
    configuration_schema: dict[str, JsonValue]
    input_schema: dict[str, JsonValue]
    output_schema: dict[str, JsonValue]


class ListToolDefinitionsQuery(ApiModel):
    pass
