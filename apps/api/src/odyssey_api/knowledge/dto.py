from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=lambda value: (
            value.split("_")[0] + "".join(part.title() for part in value.split("_")[1:])
        ),
        populate_by_name=True,
        extra="forbid",
    )


class KnowledgeSpaceLifecycleStatus(StrEnum):
    INITIALIZING = "initializing"
    READY = "ready"
    SYNCING = "syncing"
    FAILED = "failed"


class KnowledgeGraphStatus(StrEnum):
    NOT_INDEXED = "not_indexed"
    HEALTHY = "healthy"
    NEEDS_REVIEW = "needs_review"
    ERROR = "error"


class ListKnowledgeSpacesQuery(ApiModel):
    query: Annotated[str, Field(max_length=200)] = ""
    page: Annotated[int, Field(ge=1)] = 1
    page_size: Annotated[int, Field(ge=1, le=100)] = 20

    @field_validator("query", mode="before")
    @classmethod
    def trim_query(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class KnowledgeSpaceSummary(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1, max_length=255)]
    description: str | None
    knowledge_space_category_id: UUID
    lifecycle_status: KnowledgeSpaceLifecycleStatus
    graph_status: KnowledgeGraphStatus
    updated_at: datetime

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("updated_at")
    @classmethod
    def require_aware_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("updatedAt must be timezone-aware")
        return value.astimezone(UTC)


class KnowledgeSpaceSummaryPage(ApiModel):
    items: list[KnowledgeSpaceSummary]
    page: Annotated[int, Field(ge=1)]
    page_size: Annotated[int, Field(ge=1, le=100)]
    total: Annotated[int, Field(ge=0)]
