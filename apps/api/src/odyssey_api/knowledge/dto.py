from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated, Literal
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
    ARCHIVED = "archived"


class KnowledgeGraphStatus(StrEnum):
    NOT_INDEXED = "not_indexed"
    HEALTHY = "healthy"
    NEEDS_REVIEW = "needs_review"
    ERROR = "error"


class ListKnowledgeSpacesQuery(ApiModel):
    query: Annotated[str, Field(max_length=200)] = ""
    page: Annotated[int, Field(ge=1)] = 1
    page_size: Annotated[int, Field(ge=1, le=100)] = 20
    include_archived: bool = False

    @field_validator("query", mode="before")
    @classmethod
    def trim_query(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class KnowledgeSpaceCategorySummary(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1, max_length=255)]
    color_token: Annotated[str, Field(min_length=1, max_length=64)] | None
    sort_order: Annotated[int, Field(ge=0)]
    is_default: bool


class CreateKnowledgeSpaceCategoryRequest(ApiModel):
    name: Annotated[str, Field(min_length=1, max_length=255)]
    color_token: Annotated[str, Field(min_length=1, max_length=64)] | None = None

    @field_validator("name", "color_token", mode="before")
    @classmethod
    def trim_strings(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class KnowledgeSpaceSummary(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1, max_length=255)]
    description: str | None
    category: KnowledgeSpaceCategorySummary
    lifecycle_status: KnowledgeSpaceLifecycleStatus
    graph_status: KnowledgeGraphStatus
    file_count: Annotated[int, Field(ge=0)]
    knowledge_family_count: Annotated[int, Field(ge=0)]
    open_issue_count: Annotated[int, Field(ge=0)]
    created_at: datetime
    updated_at: datetime

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("created_at", "updated_at")
    @classmethod
    def require_aware_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("updatedAt must be timezone-aware")
        return value.astimezone(UTC)


class KnowledgeSpaceDetail(KnowledgeSpaceSummary):
    root_folder_id: UUID
    revision: Annotated[int, Field(ge=1)]
    last_document_indexed_at: datetime | None
    last_steward_run_at: datetime | None

    @field_validator("last_document_indexed_at", "last_steward_run_at")
    @classmethod
    def require_optional_aware_utc(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp must be timezone-aware")
        return value.astimezone(UTC)


class CreateKnowledgeSpaceRequest(ApiModel):
    name: Annotated[str, Field(min_length=1, max_length=255)]
    description: Annotated[str, Field(max_length=4000)] | None = None
    category_id: UUID

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", mode="before")
    @classmethod
    def trim_description(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        return stripped or None


class UpdateKnowledgeSpaceRequest(ApiModel):
    expected_revision: Annotated[int, Field(ge=1)]
    name: Annotated[str, Field(min_length=1, max_length=255)]
    description: Annotated[str, Field(max_length=4000)] | None
    category_id: UUID

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", mode="before")
    @classmethod
    def trim_description(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        return stripped or None


class KnowledgeSpaceRevisionRequest(ApiModel):
    expected_revision: Annotated[int, Field(ge=1)]


class KnowledgeFolderSummary(ApiModel):
    id: UUID
    knowledge_space_id: UUID
    parent_folder_id: UUID | None
    name: Annotated[str, Field(min_length=1, max_length=255)]
    sort_order: Annotated[int, Field(ge=0)]
    created_at: datetime
    updated_at: datetime


class KnowledgeResourceSummary(ApiModel):
    id: UUID
    knowledge_space_id: UUID
    folder_id: UUID
    name: Annotated[str, Field(min_length=1, max_length=255)]
    status: Annotated[
        str,
        Field(pattern="^(pending|indexing|indexed|needs_review|unsupported|failed)$"),
    ]
    mime_type: Annotated[str, Field(min_length=1, max_length=255)] | None
    size_bytes: Annotated[int, Field(ge=0)] | None
    created_at: datetime
    updated_at: datetime


class KnowledgeResourceDetail(KnowledgeResourceSummary):
    summary: str | None
    guide: str | None
    checksum_sha256: Annotated[str, Field(pattern="^[0-9a-f]{64}$")] | None
    last_indexed_at: datetime | None
    download_url: str
    download_expires_at: datetime

    @field_validator("last_indexed_at", "download_expires_at")
    @classmethod
    def require_detail_aware_utc(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp must be timezone-aware")
        return value.astimezone(UTC)


class KnowledgeFileTree(ApiModel):
    knowledge_space_id: UUID
    root_folder_id: UUID
    revision: Annotated[int, Field(ge=1)]
    folders: list[KnowledgeFolderSummary]
    resources: list[KnowledgeResourceSummary]


class KnowledgeGraphTag(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1, max_length=255)]
    color_token: Annotated[str, Field(min_length=1, max_length=64)] | None


class KnowledgeGraphNode(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1, max_length=255)]
    status: Annotated[
        str,
        Field(pattern="^(pending|indexing|indexed|needs_review|unsupported|failed)$"),
    ]
    summary: str | None
    guide: str | None
    tags: list[KnowledgeGraphTag]
    issue_ids: list[UUID]


class KnowledgeGraphEdge(ApiModel):
    id: UUID
    source_resource_id: UUID
    target_resource_id: UUID
    kind: Annotated[
        str,
        Field(
            pattern=("^(references|builds_on|explains|supports|contradicts|supersedes|related_to)$")
        ),
    ]
    status: Annotated[str, Field(pattern="^(active|needs_review)$")]
    confidence: Annotated[float, Field(ge=0, le=1)] | None
    description: str | None


class KnowledgeGraphFamily(ApiModel):
    id: UUID
    name: Annotated[str, Field(min_length=1, max_length=255)]
    color_token: Annotated[str, Field(min_length=1, max_length=64)] | None
    resource_ids: list[UUID]


class KnowledgeGraphIssue(ApiModel):
    id: UUID
    kind: Annotated[
        str,
        Field(
            pattern=(
                "^(unlinked_document|broken_reference|possible_duplicate|possible_conflict|"
                "missing_metadata|stale_document|family_assignment_review)$"
            )
        ),
    ]
    severity: Annotated[str, Field(pattern="^(info|warning|error)$")]
    resolution_status: Annotated[str, Field(pattern="^(open|accepted|resolved|dismissed)$")]
    title: Annotated[str, Field(min_length=1, max_length=255)]
    message: str | None
    resource_ids: list[UUID]
    relation_ids: list[UUID]


class KnowledgeGraphOverview(ApiModel):
    knowledge_space_id: UUID
    status: KnowledgeGraphStatus
    generated_at: datetime | None
    nodes: list[KnowledgeGraphNode]
    edges: list[KnowledgeGraphEdge]
    families: list[KnowledgeGraphFamily]
    issues: list[KnowledgeGraphIssue]

    @field_validator("generated_at")
    @classmethod
    def require_generated_at_aware_utc(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("generatedAt must be timezone-aware")
        return value.astimezone(UTC)


class CreateKnowledgeFolderRequest(ApiModel):
    expected_revision: Annotated[int, Field(ge=1)]
    parent_folder_id: UUID
    name: Annotated[str, Field(min_length=1, max_length=255)]

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class CreateKnowledgeFolderSuccess(ApiModel):
    folder: KnowledgeFolderSummary
    knowledge_space_revision: Annotated[int, Field(ge=1)]


class MoveKnowledgeResourceRequest(ApiModel):
    target_folder_id: UUID
    expected_revision: Annotated[int, Field(ge=1)]


class MoveKnowledgeResourceSuccess(ApiModel):
    resource: KnowledgeResourceSummary
    knowledge_space_revision: Annotated[int, Field(ge=1)]


class DeleteKnowledgeResourceSuccess(ApiModel):
    resource_id: UUID
    knowledge_space_revision: Annotated[int, Field(ge=1)]


class UpdateKnowledgeResourceContentRequest(ApiModel):
    expected_revision: Annotated[int, Field(ge=1)]
    content: Annotated[str, Field(max_length=2_000_000)]


class UpdateKnowledgeResourceContentSuccess(ApiModel):
    resource: KnowledgeResourceSummary
    knowledge_space_revision: Annotated[int, Field(ge=1)]


class PrepareKnowledgeUploadRequest(ApiModel):
    folder_id: UUID
    file_name: Annotated[str, Field(min_length=1, max_length=255)]
    content_type: Annotated[str, Field(min_length=1, max_length=255)]
    size_bytes: Annotated[int, Field(gt=0)]

    @field_validator("file_name", "content_type", mode="before")
    @classmethod
    def trim_strings(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class PrepareKnowledgeUploadSuccess(ApiModel):
    resource_id: UUID
    artifact_id: UUID
    upload_url: str
    method: Literal["PUT"]
    required_headers: dict[str, str]
    expires_at: datetime


class CompleteKnowledgeUploadRequest(ApiModel):
    artifact_id: UUID
    expected_revision: Annotated[int, Field(ge=1)]


class CompleteKnowledgeUploadSuccess(ApiModel):
    resource: KnowledgeResourceSummary
    knowledge_space_revision: Annotated[int, Field(ge=1)]


class KnowledgeSpaceSummaryPage(ApiModel):
    items: list[KnowledgeSpaceSummary]
    page: Annotated[int, Field(ge=1)]
    page_size: Annotated[int, Field(ge=1, le=100)]
    total: Annotated[int, Field(ge=0)]
