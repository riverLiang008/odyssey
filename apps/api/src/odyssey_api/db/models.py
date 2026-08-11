from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from odyssey_api.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

JSON_OBJECT_DEFAULT = text("'{}'::jsonb")
JSON_ARRAY_DEFAULT = text("'[]'::jsonb")


class VariableOwnership(StrEnum):
    USER_MANAGED = "user_managed"
    SHARED = "shared"
    AGENT_MANAGED = "agent_managed"


class Workspace(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workspace"

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)


class KnowledgeSpaceCategory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "knowledge_space_category"
    __table_args__ = (
        UniqueConstraint("workspace_id", "normalized_name"),
        CheckConstraint("sort_order >= 0", name="sort_order_nonnegative"),
        Index(
            "uq_knowledge_space_category_default_per_workspace",
            "workspace_id",
            unique=True,
            postgresql_where=text("is_default"),
        ),
        Index("ix_knowledge_space_category_workspace_sort", "workspace_id", "sort_order"),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspace.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    normalized_name: Mapped[str] = mapped_column(String(255))
    color_token: Mapped[str | None] = mapped_column(String(64))
    sort_order: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    is_default: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))


class OdyJourney(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ody_journey"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'archived')", name="status_values"),
        CheckConstraint("revision >= 1", name="revision_positive"),
        CheckConstraint("jsonb_typeof(tags) = 'array'", name="tags_array"),
        Index("ix_ody_journey_workspace_status_updated", "workspace_id", "status", "updated_at"),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspace.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), server_default=text("'draft'"))
    pattern_config: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=JSON_OBJECT_DEFAULT
    )
    tags: Mapped[list[str]] = mapped_column(JSONB, server_default=JSON_ARRAY_DEFAULT)
    revision: Mapped[int] = mapped_column(Integer, server_default=text("1"))


class AgentWorkflow(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_workflow"
    __table_args__ = (
        UniqueConstraint("ody_journey_id", "normalized_name"),
        CheckConstraint("revision >= 1", name="revision_positive"),
    )

    ody_journey_id: Mapped[UUID] = mapped_column(
        ForeignKey("ody_journey.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    normalized_name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    workflow_graph: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=JSON_OBJECT_DEFAULT
    )
    canvas_layout: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=JSON_OBJECT_DEFAULT)
    revision: Mapped[int] = mapped_column(Integer, server_default=text("1"))


class ToolDefinition(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tool_definition"
    __table_args__ = (CheckConstraint("source = 'built_in'", name="source_values"),)

    kind: Mapped[str] = mapped_column(String(128), unique=True)
    source: Mapped[str] = mapped_column(String(32), server_default=text("'built_in'"))
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(64))
    description: Mapped[str | None] = mapped_column(Text)
    configuration_schema: Mapped[dict[str, Any]] = mapped_column(JSONB)
    input_schema: Mapped[dict[str, Any]] = mapped_column(JSONB)
    output_schema: Mapped[dict[str, Any]] = mapped_column(JSONB)


class TemplateMixin:
    workspace_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("workspace.id", ondelete="RESTRICT"), index=True
    )
    template_key: Mapped[str | None] = mapped_column(String(255))
    source: Mapped[str] = mapped_column(String(32))
    visibility: Mapped[str] = mapped_column(String(16), server_default=text("'private'"))
    publication_status: Mapped[str] = mapped_column(String(16), server_default=text("'draft'"))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    dependencies: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, server_default=JSON_ARRAY_DEFAULT
    )
    tags: Mapped[list[str]] = mapped_column(JSONB, server_default=JSON_ARRAY_DEFAULT)
    revision: Mapped[int] = mapped_column(Integer, server_default=text("1"))
    published_at: Mapped[Any | None] = mapped_column(DateTime(timezone=True))


def template_constraints() -> tuple[CheckConstraint, ...]:
    return (
        CheckConstraint("source IN ('built_in', 'user')", name="source_values"),
        CheckConstraint("visibility IN ('private', 'public')", name="visibility_values"),
        CheckConstraint(
            "publication_status IN ('draft', 'published')", name="publication_status_values"
        ),
        CheckConstraint(
            "(source = 'built_in' AND workspace_id IS NULL AND template_key IS NOT NULL "
            "AND visibility = 'public' AND publication_status = 'published') OR "
            "(source = 'user' AND workspace_id IS NOT NULL AND template_key IS NULL)",
            name="source_ownership",
        ),
        CheckConstraint(
            "(publication_status = 'published' AND published_at IS NOT NULL) OR "
            "(publication_status = 'draft' AND published_at IS NULL)",
            name="publication_timestamp",
        ),
        CheckConstraint("revision >= 1", name="revision_positive"),
        CheckConstraint("jsonb_typeof(tags) = 'array'", name="tags_array"),
        CheckConstraint("jsonb_typeof(dependencies) = 'array'", name="dependencies_array"),
    )


class PatternTemplate(TemplateMixin, UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "pattern_template"
    __table_args__ = template_constraints() + (
        Index(
            "uq_pattern_template_builtin_key",
            "template_key",
            unique=True,
            postgresql_where=text("template_key IS NOT NULL"),
        ),
        Index(
            "ix_pattern_template_library",
            "source",
            "visibility",
            "publication_status",
            "updated_at",
        ),
    )

    source_template_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("pattern_template.id", ondelete="SET NULL"), index=True
    )
    pattern_kind: Mapped[str] = mapped_column(String(64))
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB)


class AgentTemplate(TemplateMixin, UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_template"
    __table_args__ = template_constraints() + (
        Index(
            "uq_agent_template_builtin_key",
            "template_key",
            unique=True,
            postgresql_where=text("template_key IS NOT NULL"),
        ),
        Index(
            "ix_agent_template_library", "source", "visibility", "publication_status", "updated_at"
        ),
    )

    source_template_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("agent_template.id", ondelete="SET NULL"), index=True
    )
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB)


class ToolTemplate(TemplateMixin, UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tool_template"
    __table_args__ = template_constraints() + (
        Index(
            "uq_tool_template_builtin_key",
            "template_key",
            unique=True,
            postgresql_where=text("template_key IS NOT NULL"),
        ),
        Index(
            "ix_tool_template_library", "source", "visibility", "publication_status", "updated_at"
        ),
    )

    source_template_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("tool_template.id", ondelete="SET NULL"), index=True
    )
    kind: Mapped[str] = mapped_column(ForeignKey("tool_definition.kind", ondelete="RESTRICT"))
    configuration: Mapped[dict[str, Any]] = mapped_column(JSONB)
    input_bindings: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=JSON_OBJECT_DEFAULT
    )
    output_mapping: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    failure_behavior: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=JSON_OBJECT_DEFAULT
    )


class AgentVariable(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_variable"
    __table_args__ = (
        UniqueConstraint("agent_workflow_id", "key"),
        CheckConstraint(
            "data_type IN ('string', 'number', 'boolean', 'json')", name="data_type_values"
        ),
        CheckConstraint(
            "ownership IN ('user_managed', 'shared', 'agent_managed')",
            name="ownership_values",
        ),
    )

    agent_workflow_id: Mapped[UUID] = mapped_column(
        ForeignKey("agent_workflow.id", ondelete="CASCADE"), index=True
    )
    key: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    data_type: Mapped[str] = mapped_column(String(32))
    ownership: Mapped[str] = mapped_column(String(32))
    default_value: Mapped[Any | None] = mapped_column(JSONB)
    read_only: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))


class AgentReusableTool(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_reusable_tool"

    agent_workflow_id: Mapped[UUID] = mapped_column(
        ForeignKey("agent_workflow.id", ondelete="CASCADE"), index=True
    )
    source_template_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("tool_template.id", ondelete="SET NULL"), index=True
    )
    kind: Mapped[str] = mapped_column(ForeignKey("tool_definition.kind", ondelete="RESTRICT"))
    label: Mapped[str | None] = mapped_column(String(255))
    configuration: Mapped[dict[str, Any]] = mapped_column(JSONB)
    input_bindings: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=JSON_OBJECT_DEFAULT
    )
    output_mapping: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    failure_behavior: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=JSON_OBJECT_DEFAULT
    )


class KnowledgeSpace(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "knowledge_space"
    __table_args__ = (
        UniqueConstraint("workspace_id", "normalized_name"),
        CheckConstraint(
            "lifecycle_status IN ('initializing', 'ready', 'syncing', 'failed')",
            name="lifecycle_status_values",
        ),
        CheckConstraint(
            "graph_status IN ('not_indexed', 'healthy', 'needs_review', 'error')",
            name="graph_status_values",
        ),
        CheckConstraint("revision >= 1", name="revision_positive"),
    )

    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspace.id", ondelete="RESTRICT"), index=True
    )
    knowledge_space_category_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_space_category.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    normalized_name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    lifecycle_status: Mapped[str] = mapped_column(String(16), server_default=text("'initializing'"))
    graph_status: Mapped[str] = mapped_column(String(16), server_default=text("'not_indexed'"))
    revision: Mapped[int] = mapped_column(Integer, server_default=text("1"))
    last_document_indexed_at: Mapped[Any | None] = mapped_column(DateTime(timezone=True))
    last_steward_run_at: Mapped[Any | None] = mapped_column(DateTime(timezone=True))


class KnowledgeFolder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "knowledge_folder"
    __table_args__ = (
        CheckConstraint("sort_order >= 0", name="sort_order_nonnegative"),
        Index(
            "uq_knowledge_folder_root_name",
            "knowledge_space_id",
            "normalized_name",
            unique=True,
            postgresql_where=text("parent_folder_id IS NULL"),
        ),
        Index(
            "uq_knowledge_folder_child_name",
            "knowledge_space_id",
            "parent_folder_id",
            "normalized_name",
            unique=True,
            postgresql_where=text("parent_folder_id IS NOT NULL"),
        ),
    )

    knowledge_space_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_space.id", ondelete="CASCADE"), index=True
    )
    parent_folder_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("knowledge_folder.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    normalized_name: Mapped[str] = mapped_column(String(255))
    sort_order: Mapped[int] = mapped_column(Integer, server_default=text("0"))


class KnowledgeResource(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "knowledge_resource"
    __table_args__ = (
        CheckConstraint("resource_type = 'file'", name="resource_type_values"),
        CheckConstraint(
            "status IN ('pending', 'indexing', 'indexed', 'needs_review', 'unsupported', 'failed')",
            name="status_values",
        ),
        CheckConstraint("size_bytes IS NULL OR size_bytes >= 0", name="size_bytes_nonnegative"),
        CheckConstraint(
            "checksum IS NULL OR octet_length(checksum) = 32", name="checksum_sha256_length"
        ),
        Index("ix_knowledge_resource_space_folder", "knowledge_space_id", "folder_id"),
        Index("ix_knowledge_resource_space_status", "knowledge_space_id", "status"),
    )

    knowledge_space_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_space.id", ondelete="CASCADE"), index=True
    )
    folder_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("knowledge_folder.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    resource_type: Mapped[str] = mapped_column(String(32), server_default=text("'file'"))
    status: Mapped[str] = mapped_column(String(16), server_default=text("'pending'"))
    summary: Mapped[str | None] = mapped_column(Text)
    guide: Mapped[str | None] = mapped_column(Text)
    mime_type: Mapped[str | None] = mapped_column(String(255))
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    checksum: Mapped[bytes | None] = mapped_column(LargeBinary)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, server_default=JSON_OBJECT_DEFAULT
    )
    last_indexed_at: Mapped[Any | None] = mapped_column(DateTime(timezone=True))


class KnowledgeResourceArtifact(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "knowledge_resource_artifact"
    __table_args__ = (
        UniqueConstraint("storage_provider", "storage_bucket", "object_key"),
        CheckConstraint(
            "artifact_kind IN ('original', 'extracted_text', 'preview', 'thumbnail', 'ocr_result')",
            name="artifact_kind_values",
        ),
        CheckConstraint(
            "status IN ('staging', 'active', 'failed', 'superseded')", name="status_values"
        ),
        CheckConstraint(
            "storage_provider IN ('minio', 's3', 'aliyun_oss')", name="provider_values"
        ),
        CheckConstraint("declared_size_bytes >= 0", name="declared_size_nonnegative"),
        CheckConstraint("size_bytes IS NULL OR size_bytes >= 0", name="size_bytes_nonnegative"),
        CheckConstraint("checksum_algorithm = 'sha256'", name="checksum_algorithm_values"),
        CheckConstraint(
            "checksum IS NULL OR octet_length(checksum) = 32", name="checksum_sha256_length"
        ),
        CheckConstraint(
            "(status = 'staging' AND activated_at IS NULL AND failed_at IS NULL "
            "AND upload_expires_at IS NOT NULL) OR "
            "(status = 'active' AND activated_at IS NOT NULL AND failed_at IS NULL "
            "AND content_type IS NOT NULL AND size_bytes IS NOT NULL AND checksum IS NOT NULL) OR "
            "(status = 'superseded' AND activated_at IS NOT NULL AND failed_at IS NULL) OR "
            "(status = 'failed' AND activated_at IS NULL AND failed_at IS NOT NULL)",
            name="status_fields",
        ),
        Index(
            "uq_knowledge_resource_artifact_active_kind",
            "knowledge_resource_id",
            "artifact_kind",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
        Index(
            "ix_knowledge_resource_artifact_resource_kind_status",
            "knowledge_resource_id",
            "artifact_kind",
            "status",
        ),
    )

    knowledge_resource_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_resource.id", ondelete="CASCADE"), index=True
    )
    artifact_kind: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), server_default=text("'staging'"))
    storage_provider: Mapped[str] = mapped_column(String(32))
    storage_bucket: Mapped[str] = mapped_column(String(255))
    object_key: Mapped[str] = mapped_column(Text)
    storage_version_id: Mapped[str | None] = mapped_column(Text)
    declared_content_type: Mapped[str] = mapped_column(String(255))
    declared_size_bytes: Mapped[int] = mapped_column(BigInteger)
    upload_expires_at: Mapped[Any] = mapped_column(DateTime(timezone=True))
    content_type: Mapped[str | None] = mapped_column(String(255))
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    checksum_algorithm: Mapped[str] = mapped_column(String(16), server_default=text("'sha256'"))
    checksum: Mapped[bytes | None] = mapped_column(LargeBinary)
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    activated_at: Mapped[Any | None] = mapped_column(DateTime(timezone=True))
    failed_at: Mapped[Any | None] = mapped_column(DateTime(timezone=True))
    failure_reason: Mapped[str | None] = mapped_column(Text)


class KnowledgeTag(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "knowledge_tag"
    __table_args__ = (UniqueConstraint("knowledge_space_id", "normalized_name"),)

    knowledge_space_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_space.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    normalized_name: Mapped[str] = mapped_column(String(255))
    color_token: Mapped[str | None] = mapped_column(String(64))


class KnowledgeResourceTag(Base):
    __tablename__ = "knowledge_resource_tag"
    __table_args__ = (
        Index(
            "ix_knowledge_resource_tag_tag_resource", "knowledge_tag_id", "knowledge_resource_id"
        ),
    )

    knowledge_resource_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_resource.id", ondelete="CASCADE"), primary_key=True
    )
    knowledge_tag_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_tag.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class KnowledgeRelation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "knowledge_relation"
    __table_args__ = (
        CheckConstraint(
            "relation_kind IN ('references', 'builds_on', 'explains', 'supports', "
            "'contradicts', 'supersedes', 'related_to')",
            name="relation_kind_values",
        ),
        CheckConstraint("status IN ('active', 'needs_review')", name="status_values"),
        CheckConstraint("source IN ('user', 'seed')", name="source_values"),
        CheckConstraint(
            "confidence IS NULL OR confidence BETWEEN 0 AND 1", name="confidence_range"
        ),
        CheckConstraint("source_resource_id <> target_resource_id", name="no_self_relation"),
        Index("ix_knowledge_relation_space_source", "knowledge_space_id", "source_resource_id"),
        Index("ix_knowledge_relation_space_target", "knowledge_space_id", "target_resource_id"),
    )

    knowledge_space_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_space.id", ondelete="CASCADE"), index=True
    )
    source_resource_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_resource.id", ondelete="CASCADE"), index=True
    )
    target_resource_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_resource.id", ondelete="CASCADE"), index=True
    )
    relation_kind: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), server_default=text("'active'"))
    confidence: Mapped[float | None] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(16), server_default=text("'user'"))
    confirmed_by_user: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    description: Mapped[str | None] = mapped_column(Text)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, server_default=JSON_OBJECT_DEFAULT
    )


class GraphIssue(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "graph_issue"
    __table_args__ = (
        CheckConstraint(
            "issue_kind IN ('unlinked_document', 'broken_reference', 'possible_duplicate', "
            "'possible_conflict', 'missing_metadata', 'stale_document', "
            "'family_assignment_review')",
            name="issue_kind_values",
        ),
        CheckConstraint("severity IN ('info', 'warning', 'error')", name="severity_values"),
        CheckConstraint(
            "resolution_status IN ('open', 'accepted', 'resolved', 'dismissed')",
            name="resolution_status_values",
        ),
        CheckConstraint("source IN ('user', 'seed')", name="source_values"),
        CheckConstraint("scope IN ('knowledge_space', 'affected_objects')", name="scope_values"),
        CheckConstraint(
            "(resolution_status = 'open' AND resolved_at IS NULL) OR "
            "(resolution_status <> 'open' AND resolved_at IS NOT NULL)",
            name="resolution_timestamp",
        ),
        Index(
            "ix_graph_issue_space_resolution_severity",
            "knowledge_space_id",
            "resolution_status",
            "severity",
        ),
    )

    knowledge_space_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_space.id", ondelete="CASCADE"), index=True
    )
    issue_kind: Mapped[str] = mapped_column(String(32))
    severity: Mapped[str] = mapped_column(String(16))
    resolution_status: Mapped[str] = mapped_column(String(16), server_default=text("'open'"))
    source: Mapped[str] = mapped_column(String(16), server_default=text("'user'"))
    scope: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str | None] = mapped_column(Text)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, server_default=JSON_OBJECT_DEFAULT
    )
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    resolved_at: Mapped[Any | None] = mapped_column(DateTime(timezone=True))


class GraphIssueResource(Base):
    __tablename__ = "graph_issue_resource"

    graph_issue_id: Mapped[UUID] = mapped_column(
        ForeignKey("graph_issue.id", ondelete="CASCADE"), primary_key=True
    )
    knowledge_resource_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_resource.id", ondelete="CASCADE"), primary_key=True, index=True
    )


class GraphIssueRelation(Base):
    __tablename__ = "graph_issue_relation"

    graph_issue_id: Mapped[UUID] = mapped_column(
        ForeignKey("graph_issue.id", ondelete="CASCADE"), primary_key=True
    )
    knowledge_relation_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_relation.id", ondelete="CASCADE"), primary_key=True, index=True
    )


class WorkflowKnowledgeSpaceReference(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "agent_workflow_knowledge_space_reference"
    __table_args__ = (
        UniqueConstraint("agent_workflow_id", "knowledge_space_id", "owner_kind", "owner_id"),
        CheckConstraint(
            "owner_kind IN ('agent_action', 'reusable_tool', 'task_tool')", name="owner_kind_values"
        ),
    )

    agent_workflow_id: Mapped[UUID] = mapped_column(
        ForeignKey("agent_workflow.id", ondelete="CASCADE"), index=True
    )
    knowledge_space_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_space.id", ondelete="RESTRICT"), index=True
    )
    owner_kind: Mapped[str] = mapped_column(String(32))
    owner_id: Mapped[UUID] = mapped_column()
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class AgentTemplateKnowledgeSpaceReference(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "agent_template_knowledge_space_reference"
    __table_args__ = (
        UniqueConstraint("agent_template_id", "knowledge_space_id", "owner_kind", "owner_id"),
        CheckConstraint(
            "owner_kind IN ('agent_action', 'reusable_tool', 'task_tool')", name="owner_kind_values"
        ),
    )

    agent_template_id: Mapped[UUID] = mapped_column(
        ForeignKey("agent_template.id", ondelete="CASCADE"), index=True
    )
    knowledge_space_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_space.id", ondelete="RESTRICT"), index=True
    )
    owner_kind: Mapped[str] = mapped_column(String(32))
    owner_id: Mapped[UUID] = mapped_column()
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class ToolTemplateKnowledgeSpaceReference(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "tool_template_knowledge_space_reference"
    __table_args__ = (UniqueConstraint("tool_template_id", "knowledge_space_id", "owner_id"),)

    tool_template_id: Mapped[UUID] = mapped_column(
        ForeignKey("tool_template.id", ondelete="CASCADE"), index=True
    )
    knowledge_space_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_space.id", ondelete="RESTRICT"), index=True
    )
    owner_id: Mapped[UUID] = mapped_column()
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class StorageObjectDeletionOutbox(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "storage_object_deletion_outbox"
    __table_args__ = (
        UniqueConstraint("idempotency_key"),
        CheckConstraint("octet_length(idempotency_key) = 32", name="idempotency_sha256_length"),
        CheckConstraint(
            "status IN ('pending', 'processing', 'retry', 'completed', 'failed')",
            name="status_values",
        ),
        CheckConstraint("attempt_count >= 0", name="attempt_count_nonnegative"),
        CheckConstraint(
            "(status = 'completed' AND completed_at IS NOT NULL) OR "
            "(status <> 'completed' AND completed_at IS NULL)",
            name="completion_timestamp",
        ),
        CheckConstraint(
            "(status = 'processing' AND lease_token IS NOT NULL "
            "AND lease_expires_at IS NOT NULL) OR "
            "(status <> 'processing' AND lease_token IS NULL AND lease_expires_at IS NULL)",
            name="lease_fields",
        ),
        Index("ix_storage_outbox_claim", "status", "next_attempt_at"),
        Index("ix_storage_outbox_reclaim", "status", "lease_expires_at"),
    )

    idempotency_key: Mapped[bytes] = mapped_column(LargeBinary(32))
    storage_provider: Mapped[str] = mapped_column(String(32))
    storage_bucket: Mapped[str] = mapped_column(String(255))
    object_key: Mapped[str] = mapped_column(Text)
    storage_version_id: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), server_default=text("'pending'"))
    attempt_count: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    next_attempt_at: Mapped[Any] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    lease_token: Mapped[UUID | None] = mapped_column()
    lease_expires_at: Mapped[Any | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    completed_at: Mapped[Any | None] = mapped_column(DateTime(timezone=True))
