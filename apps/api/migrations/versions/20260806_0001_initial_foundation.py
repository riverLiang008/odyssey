# ruff: noqa: E501
"""Create the Odyssey V1 implementation baseline.

Revision ID: 20260806_0001
Revises:
Create Date: 2026-08-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260806_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "storage_object_deletion_outbox",
        sa.Column("idempotency_key", sa.LargeBinary(length=32), nullable=False),
        sa.Column("storage_provider", sa.String(length=32), nullable=False),
        sa.Column("storage_bucket", sa.String(length=255), nullable=False),
        sa.Column("object_key", sa.Text(), nullable=False),
        sa.Column("storage_version_id", sa.Text(), nullable=True),
        sa.Column(
            "status", sa.String(length=16), server_default=sa.text("'pending'"), nullable=False
        ),
        sa.Column("attempt_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "next_attempt_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("lease_token", sa.Uuid(), nullable=True),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "(status = 'completed' AND completed_at IS NOT NULL) OR (status <> 'completed' AND completed_at IS NULL)",
            name=op.f("ck_storage_object_deletion_outbox_completion_timestamp"),
        ),
        sa.CheckConstraint(
            "(status = 'processing' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL) OR (status <> 'processing' AND lease_token IS NULL AND lease_expires_at IS NULL)",
            name=op.f("ck_storage_object_deletion_outbox_lease_fields"),
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'processing', 'retry', 'completed', 'failed')",
            name=op.f("ck_storage_object_deletion_outbox_status_values"),
        ),
        sa.CheckConstraint(
            "attempt_count >= 0",
            name=op.f("ck_storage_object_deletion_outbox_attempt_count_nonnegative"),
        ),
        sa.CheckConstraint(
            "octet_length(idempotency_key) = 32",
            name=op.f("ck_storage_object_deletion_outbox_idempotency_sha256_length"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_storage_object_deletion_outbox")),
        sa.UniqueConstraint(
            "idempotency_key", name=op.f("uq_storage_object_deletion_outbox_idempotency_key")
        ),
    )

    op.create_index(
        "ix_storage_outbox_claim",
        "storage_object_deletion_outbox",
        ["status", "next_attempt_at"],
        unique=False,
    )

    op.create_index(
        "ix_storage_outbox_reclaim",
        "storage_object_deletion_outbox",
        ["status", "lease_expires_at"],
        unique=False,
    )

    op.create_table(
        "tool_definition",
        sa.Column("kind", sa.String(length=128), nullable=False),
        sa.Column(
            "source", sa.String(length=32), server_default=sa.text("'built_in'"), nullable=False
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("configuration_schema", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("input_schema", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("output_schema", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("source = 'built_in'", name=op.f("ck_tool_definition_source_values")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tool_definition")),
        sa.UniqueConstraint("kind", name=op.f("uq_tool_definition_kind")),
    )

    op.create_table(
        "workspace",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workspace")),
    )

    op.create_table(
        "agent_template",
        sa.Column("source_template_id", sa.Uuid(), nullable=True),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=True),
        sa.Column("template_key", sa.String(length=255), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column(
            "visibility", sa.String(length=16), server_default=sa.text("'private'"), nullable=False
        ),
        sa.Column(
            "publication_status",
            sa.String(length=16),
            server_default=sa.text("'draft'"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "dependencies",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("revision", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(publication_status = 'published' AND published_at IS NOT NULL) OR (publication_status = 'draft' AND published_at IS NULL)",
            name=op.f("ck_agent_template_publication_timestamp"),
        ),
        sa.CheckConstraint(
            "(source = 'built_in' AND workspace_id IS NULL AND template_key IS NOT NULL AND visibility = 'public' AND publication_status = 'published') OR (source = 'user' AND workspace_id IS NOT NULL AND template_key IS NULL)",
            name=op.f("ck_agent_template_source_ownership"),
        ),
        sa.CheckConstraint(
            "jsonb_typeof(dependencies) = 'array'",
            name=op.f("ck_agent_template_dependencies_array"),
        ),
        sa.CheckConstraint(
            "jsonb_typeof(tags) = 'array'", name=op.f("ck_agent_template_tags_array")
        ),
        sa.CheckConstraint(
            "publication_status IN ('draft', 'published')",
            name=op.f("ck_agent_template_publication_status_values"),
        ),
        sa.CheckConstraint(
            "source IN ('built_in', 'user')", name=op.f("ck_agent_template_source_values")
        ),
        sa.CheckConstraint(
            "visibility IN ('private', 'public')", name=op.f("ck_agent_template_visibility_values")
        ),
        sa.CheckConstraint("revision >= 1", name=op.f("ck_agent_template_revision_positive")),
        sa.ForeignKeyConstraint(
            ["source_template_id"],
            ["agent_template.id"],
            name=op.f("fk_agent_template_source_template_id_agent_template"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspace.id"],
            name=op.f("fk_agent_template_workspace_id_workspace"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_template")),
    )

    op.create_index(
        "ix_agent_template_library",
        "agent_template",
        ["source", "visibility", "publication_status", "updated_at"],
        unique=False,
    )

    op.create_index(
        op.f("ix_agent_template_source_template_id"),
        "agent_template",
        ["source_template_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_agent_template_workspace_id"), "agent_template", ["workspace_id"], unique=False
    )

    op.create_index(
        "uq_agent_template_builtin_key",
        "agent_template",
        ["template_key"],
        unique=True,
        postgresql_where=sa.text("template_key IS NOT NULL"),
    )

    op.create_table(
        "knowledge_space_category",
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("color_token", sa.String(length=64), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "sort_order >= 0", name=op.f("ck_knowledge_space_category_sort_order_nonnegative")
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspace.id"],
            name=op.f("fk_knowledge_space_category_workspace_id_workspace"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_knowledge_space_category")),
        sa.UniqueConstraint(
            "workspace_id", "normalized_name", name=op.f("uq_knowledge_space_category_workspace_id")
        ),
    )

    op.create_index(
        op.f("ix_knowledge_space_category_workspace_id"),
        "knowledge_space_category",
        ["workspace_id"],
        unique=False,
    )

    op.create_index(
        "ix_knowledge_space_category_workspace_sort",
        "knowledge_space_category",
        ["workspace_id", "sort_order"],
        unique=False,
    )

    op.create_index(
        "uq_knowledge_space_category_default_per_workspace",
        "knowledge_space_category",
        ["workspace_id"],
        unique=True,
        postgresql_where=sa.text("is_default"),
    )

    op.create_table(
        "ody_journey",
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status", sa.String(length=16), server_default=sa.text("'draft'"), nullable=False
        ),
        sa.Column(
            "pattern_config",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("revision", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("jsonb_typeof(tags) = 'array'", name=op.f("ck_ody_journey_tags_array")),
        sa.CheckConstraint(
            "status IN ('draft', 'archived')", name=op.f("ck_ody_journey_status_values")
        ),
        sa.CheckConstraint("revision >= 1", name=op.f("ck_ody_journey_revision_positive")),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspace.id"],
            name=op.f("fk_ody_journey_workspace_id_workspace"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ody_journey")),
    )

    op.create_index(
        op.f("ix_ody_journey_workspace_id"), "ody_journey", ["workspace_id"], unique=False
    )

    op.create_index(
        "ix_ody_journey_workspace_status_updated",
        "ody_journey",
        ["workspace_id", "status", "updated_at"],
        unique=False,
    )

    op.create_table(
        "pattern_template",
        sa.Column("source_template_id", sa.Uuid(), nullable=True),
        sa.Column("pattern_kind", sa.String(length=64), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=True),
        sa.Column("template_key", sa.String(length=255), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column(
            "visibility", sa.String(length=16), server_default=sa.text("'private'"), nullable=False
        ),
        sa.Column(
            "publication_status",
            sa.String(length=16),
            server_default=sa.text("'draft'"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "dependencies",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("revision", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(publication_status = 'published' AND published_at IS NOT NULL) OR (publication_status = 'draft' AND published_at IS NULL)",
            name=op.f("ck_pattern_template_publication_timestamp"),
        ),
        sa.CheckConstraint(
            "(source = 'built_in' AND workspace_id IS NULL AND template_key IS NOT NULL AND visibility = 'public' AND publication_status = 'published') OR (source = 'user' AND workspace_id IS NOT NULL AND template_key IS NULL)",
            name=op.f("ck_pattern_template_source_ownership"),
        ),
        sa.CheckConstraint(
            "jsonb_typeof(dependencies) = 'array'",
            name=op.f("ck_pattern_template_dependencies_array"),
        ),
        sa.CheckConstraint(
            "jsonb_typeof(tags) = 'array'", name=op.f("ck_pattern_template_tags_array")
        ),
        sa.CheckConstraint(
            "publication_status IN ('draft', 'published')",
            name=op.f("ck_pattern_template_publication_status_values"),
        ),
        sa.CheckConstraint(
            "source IN ('built_in', 'user')", name=op.f("ck_pattern_template_source_values")
        ),
        sa.CheckConstraint(
            "visibility IN ('private', 'public')",
            name=op.f("ck_pattern_template_visibility_values"),
        ),
        sa.CheckConstraint("revision >= 1", name=op.f("ck_pattern_template_revision_positive")),
        sa.ForeignKeyConstraint(
            ["source_template_id"],
            ["pattern_template.id"],
            name=op.f("fk_pattern_template_source_template_id_pattern_template"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspace.id"],
            name=op.f("fk_pattern_template_workspace_id_workspace"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pattern_template")),
    )

    op.create_index(
        "ix_pattern_template_library",
        "pattern_template",
        ["source", "visibility", "publication_status", "updated_at"],
        unique=False,
    )

    op.create_index(
        op.f("ix_pattern_template_source_template_id"),
        "pattern_template",
        ["source_template_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_pattern_template_workspace_id"), "pattern_template", ["workspace_id"], unique=False
    )

    op.create_index(
        "uq_pattern_template_builtin_key",
        "pattern_template",
        ["template_key"],
        unique=True,
        postgresql_where=sa.text("template_key IS NOT NULL"),
    )

    op.create_table(
        "tool_template",
        sa.Column("source_template_id", sa.Uuid(), nullable=True),
        sa.Column("kind", sa.String(length=128), nullable=False),
        sa.Column("configuration", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "input_bindings",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("output_mapping", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "failure_behavior",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("workspace_id", sa.Uuid(), nullable=True),
        sa.Column("template_key", sa.String(length=255), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column(
            "visibility", sa.String(length=16), server_default=sa.text("'private'"), nullable=False
        ),
        sa.Column(
            "publication_status",
            sa.String(length=16),
            server_default=sa.text("'draft'"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "dependencies",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("revision", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(publication_status = 'published' AND published_at IS NOT NULL) OR (publication_status = 'draft' AND published_at IS NULL)",
            name=op.f("ck_tool_template_publication_timestamp"),
        ),
        sa.CheckConstraint(
            "(source = 'built_in' AND workspace_id IS NULL AND template_key IS NOT NULL AND visibility = 'public' AND publication_status = 'published') OR (source = 'user' AND workspace_id IS NOT NULL AND template_key IS NULL)",
            name=op.f("ck_tool_template_source_ownership"),
        ),
        sa.CheckConstraint(
            "jsonb_typeof(dependencies) = 'array'", name=op.f("ck_tool_template_dependencies_array")
        ),
        sa.CheckConstraint(
            "jsonb_typeof(tags) = 'array'", name=op.f("ck_tool_template_tags_array")
        ),
        sa.CheckConstraint(
            "publication_status IN ('draft', 'published')",
            name=op.f("ck_tool_template_publication_status_values"),
        ),
        sa.CheckConstraint(
            "source IN ('built_in', 'user')", name=op.f("ck_tool_template_source_values")
        ),
        sa.CheckConstraint(
            "visibility IN ('private', 'public')", name=op.f("ck_tool_template_visibility_values")
        ),
        sa.CheckConstraint("revision >= 1", name=op.f("ck_tool_template_revision_positive")),
        sa.ForeignKeyConstraint(
            ["kind"],
            ["tool_definition.kind"],
            name=op.f("fk_tool_template_kind_tool_definition"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["source_template_id"],
            ["tool_template.id"],
            name=op.f("fk_tool_template_source_template_id_tool_template"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspace.id"],
            name=op.f("fk_tool_template_workspace_id_workspace"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tool_template")),
    )

    op.create_index(
        "ix_tool_template_library",
        "tool_template",
        ["source", "visibility", "publication_status", "updated_at"],
        unique=False,
    )

    op.create_index(
        op.f("ix_tool_template_source_template_id"),
        "tool_template",
        ["source_template_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_tool_template_workspace_id"), "tool_template", ["workspace_id"], unique=False
    )

    op.create_index(
        "uq_tool_template_builtin_key",
        "tool_template",
        ["template_key"],
        unique=True,
        postgresql_where=sa.text("template_key IS NOT NULL"),
    )

    op.create_table(
        "agent_workflow",
        sa.Column("ody_journey_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "workflow_graph",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "canvas_layout",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("revision", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("revision >= 1", name=op.f("ck_agent_workflow_revision_positive")),
        sa.ForeignKeyConstraint(
            ["ody_journey_id"],
            ["ody_journey.id"],
            name=op.f("fk_agent_workflow_ody_journey_id_ody_journey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_workflow")),
        sa.UniqueConstraint(
            "ody_journey_id", "normalized_name", name=op.f("uq_agent_workflow_ody_journey_id")
        ),
    )

    op.create_index(
        op.f("ix_agent_workflow_ody_journey_id"), "agent_workflow", ["ody_journey_id"], unique=False
    )

    op.create_table(
        "knowledge_space",
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("knowledge_space_category_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "lifecycle_status",
            sa.String(length=16),
            server_default=sa.text("'initializing'"),
            nullable=False,
        ),
        sa.Column(
            "graph_status",
            sa.String(length=16),
            server_default=sa.text("'not_indexed'"),
            nullable=False,
        ),
        sa.Column("revision", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("last_document_indexed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_steward_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "graph_status IN ('not_indexed', 'healthy', 'needs_review', 'error')",
            name=op.f("ck_knowledge_space_graph_status_values"),
        ),
        sa.CheckConstraint(
            "lifecycle_status IN ('initializing', 'ready', 'syncing', 'failed')",
            name=op.f("ck_knowledge_space_lifecycle_status_values"),
        ),
        sa.CheckConstraint("revision >= 1", name=op.f("ck_knowledge_space_revision_positive")),
        sa.ForeignKeyConstraint(
            ["knowledge_space_category_id"],
            ["knowledge_space_category.id"],
            name=op.f("fk_knowledge_space_knowledge_space_category_id_knowledge_space_category"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspace.id"],
            name=op.f("fk_knowledge_space_workspace_id_workspace"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_knowledge_space")),
        sa.UniqueConstraint(
            "workspace_id", "normalized_name", name=op.f("uq_knowledge_space_workspace_id")
        ),
    )

    op.create_index(
        op.f("ix_knowledge_space_knowledge_space_category_id"),
        "knowledge_space",
        ["knowledge_space_category_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_knowledge_space_workspace_id"), "knowledge_space", ["workspace_id"], unique=False
    )

    op.create_table(
        "agent_reusable_tool",
        sa.Column("agent_workflow_id", sa.Uuid(), nullable=False),
        sa.Column("source_template_id", sa.Uuid(), nullable=True),
        sa.Column("kind", sa.String(length=128), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=True),
        sa.Column("configuration", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "input_bindings",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("output_mapping", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "failure_behavior",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["agent_workflow_id"],
            ["agent_workflow.id"],
            name=op.f("fk_agent_reusable_tool_agent_workflow_id_agent_workflow"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["kind"],
            ["tool_definition.kind"],
            name=op.f("fk_agent_reusable_tool_kind_tool_definition"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["source_template_id"],
            ["tool_template.id"],
            name=op.f("fk_agent_reusable_tool_source_template_id_tool_template"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_reusable_tool")),
    )

    op.create_index(
        op.f("ix_agent_reusable_tool_agent_workflow_id"),
        "agent_reusable_tool",
        ["agent_workflow_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_agent_reusable_tool_source_template_id"),
        "agent_reusable_tool",
        ["source_template_id"],
        unique=False,
    )

    op.create_table(
        "agent_template_knowledge_space_reference",
        sa.Column("agent_template_id", sa.Uuid(), nullable=False),
        sa.Column("knowledge_space_id", sa.Uuid(), nullable=False),
        sa.Column("owner_kind", sa.String(length=32), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "owner_kind IN ('agent_action', 'reusable_tool', 'task_tool')",
            name=op.f("ck_agent_template_knowledge_space_reference_owner_kind_values"),
        ),
        sa.ForeignKeyConstraint(
            ["agent_template_id"],
            ["agent_template.id"],
            name=op.f(
                "fk_agent_template_knowledge_space_reference_agent_template_id_agent_template"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_space_id"],
            ["knowledge_space.id"],
            name=op.f(
                "fk_agent_template_knowledge_space_reference_knowledge_space_id_knowledge_space"
            ),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_template_knowledge_space_reference")),
        sa.UniqueConstraint(
            "agent_template_id",
            "knowledge_space_id",
            "owner_kind",
            "owner_id",
            name=op.f("uq_agent_template_knowledge_space_reference_agent_template_id"),
        ),
    )

    op.create_index(
        op.f("ix_agent_template_knowledge_space_reference_agent_template_id"),
        "agent_template_knowledge_space_reference",
        ["agent_template_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_agent_template_knowledge_space_reference_knowledge_space_id"),
        "agent_template_knowledge_space_reference",
        ["knowledge_space_id"],
        unique=False,
    )

    op.create_table(
        "agent_variable",
        sa.Column("agent_workflow_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("data_type", sa.String(length=32), nullable=False),
        sa.Column("ownership", sa.String(length=32), nullable=False),
        sa.Column("default_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("read_only", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "data_type IN ('string', 'number', 'boolean', 'json')",
            name=op.f("ck_agent_variable_data_type_values"),
        ),
        sa.CheckConstraint(
            "ownership IN ('user_managed', 'shared', 'agent_managed')",
            name=op.f("ck_agent_variable_ownership_values"),
        ),
        sa.ForeignKeyConstraint(
            ["agent_workflow_id"],
            ["agent_workflow.id"],
            name=op.f("fk_agent_variable_agent_workflow_id_agent_workflow"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_variable")),
        sa.UniqueConstraint(
            "agent_workflow_id", "key", name=op.f("uq_agent_variable_agent_workflow_id")
        ),
    )

    op.create_index(
        op.f("ix_agent_variable_agent_workflow_id"),
        "agent_variable",
        ["agent_workflow_id"],
        unique=False,
    )

    op.create_table(
        "agent_workflow_knowledge_space_reference",
        sa.Column("agent_workflow_id", sa.Uuid(), nullable=False),
        sa.Column("knowledge_space_id", sa.Uuid(), nullable=False),
        sa.Column("owner_kind", sa.String(length=32), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "owner_kind IN ('agent_action', 'reusable_tool', 'task_tool')",
            name=op.f("ck_agent_workflow_knowledge_space_reference_owner_kind_values"),
        ),
        sa.ForeignKeyConstraint(
            ["agent_workflow_id"],
            ["agent_workflow.id"],
            name=op.f(
                "fk_agent_workflow_knowledge_space_reference_agent_workflow_id_agent_workflow"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_space_id"],
            ["knowledge_space.id"],
            name=op.f(
                "fk_agent_workflow_knowledge_space_reference_knowledge_space_id_knowledge_space"
            ),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_workflow_knowledge_space_reference")),
        sa.UniqueConstraint(
            "agent_workflow_id",
            "knowledge_space_id",
            "owner_kind",
            "owner_id",
            name=op.f("uq_agent_workflow_knowledge_space_reference_agent_workflow_id"),
        ),
    )

    op.create_index(
        op.f("ix_agent_workflow_knowledge_space_reference_agent_workflow_id"),
        "agent_workflow_knowledge_space_reference",
        ["agent_workflow_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_agent_workflow_knowledge_space_reference_knowledge_space_id"),
        "agent_workflow_knowledge_space_reference",
        ["knowledge_space_id"],
        unique=False,
    )

    op.create_table(
        "graph_issue",
        sa.Column("knowledge_space_id", sa.Uuid(), nullable=False),
        sa.Column("issue_kind", sa.String(length=32), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column(
            "resolution_status",
            sa.String(length=16),
            server_default=sa.text("'open'"),
            nullable=False,
        ),
        sa.Column("source", sa.String(length=16), server_default=sa.text("'user'"), nullable=False),
        sa.Column("scope", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "(resolution_status = 'open' AND resolved_at IS NULL) OR (resolution_status <> 'open' AND resolved_at IS NOT NULL)",
            name=op.f("ck_graph_issue_resolution_timestamp"),
        ),
        sa.CheckConstraint(
            "issue_kind IN ('unlinked_document', 'broken_reference', 'possible_duplicate', 'possible_conflict', 'missing_metadata', 'stale_document', 'family_assignment_review')",
            name=op.f("ck_graph_issue_issue_kind_values"),
        ),
        sa.CheckConstraint(
            "resolution_status IN ('open', 'accepted', 'resolved', 'dismissed')",
            name=op.f("ck_graph_issue_resolution_status_values"),
        ),
        sa.CheckConstraint(
            "scope IN ('knowledge_space', 'affected_objects')",
            name=op.f("ck_graph_issue_scope_values"),
        ),
        sa.CheckConstraint(
            "severity IN ('info', 'warning', 'error')", name=op.f("ck_graph_issue_severity_values")
        ),
        sa.CheckConstraint("source IN ('user', 'seed')", name=op.f("ck_graph_issue_source_values")),
        sa.ForeignKeyConstraint(
            ["knowledge_space_id"],
            ["knowledge_space.id"],
            name=op.f("fk_graph_issue_knowledge_space_id_knowledge_space"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_graph_issue")),
    )

    op.create_index(
        op.f("ix_graph_issue_knowledge_space_id"),
        "graph_issue",
        ["knowledge_space_id"],
        unique=False,
    )

    op.create_index(
        "ix_graph_issue_space_resolution_severity",
        "graph_issue",
        ["knowledge_space_id", "resolution_status", "severity"],
        unique=False,
    )

    op.create_table(
        "knowledge_folder",
        sa.Column("knowledge_space_id", sa.Uuid(), nullable=False),
        sa.Column("parent_folder_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "sort_order >= 0", name=op.f("ck_knowledge_folder_sort_order_nonnegative")
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_space_id"],
            ["knowledge_space.id"],
            name=op.f("fk_knowledge_folder_knowledge_space_id_knowledge_space"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["parent_folder_id"],
            ["knowledge_folder.id"],
            name=op.f("fk_knowledge_folder_parent_folder_id_knowledge_folder"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_knowledge_folder")),
    )

    op.create_index(
        op.f("ix_knowledge_folder_knowledge_space_id"),
        "knowledge_folder",
        ["knowledge_space_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_knowledge_folder_parent_folder_id"),
        "knowledge_folder",
        ["parent_folder_id"],
        unique=False,
    )

    op.create_index(
        "uq_knowledge_folder_child_name",
        "knowledge_folder",
        ["knowledge_space_id", "parent_folder_id", "normalized_name"],
        unique=True,
        postgresql_where=sa.text("parent_folder_id IS NOT NULL"),
    )

    op.create_index(
        "uq_knowledge_folder_root_name",
        "knowledge_folder",
        ["knowledge_space_id", "normalized_name"],
        unique=True,
        postgresql_where=sa.text("parent_folder_id IS NULL"),
    )

    op.create_table(
        "knowledge_tag",
        sa.Column("knowledge_space_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("color_token", sa.String(length=64), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_space_id"],
            ["knowledge_space.id"],
            name=op.f("fk_knowledge_tag_knowledge_space_id_knowledge_space"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_knowledge_tag")),
        sa.UniqueConstraint(
            "knowledge_space_id",
            "normalized_name",
            name=op.f("uq_knowledge_tag_knowledge_space_id"),
        ),
    )

    op.create_index(
        op.f("ix_knowledge_tag_knowledge_space_id"),
        "knowledge_tag",
        ["knowledge_space_id"],
        unique=False,
    )

    op.create_table(
        "tool_template_knowledge_space_reference",
        sa.Column("tool_template_id", sa.Uuid(), nullable=False),
        sa.Column("knowledge_space_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["knowledge_space_id"],
            ["knowledge_space.id"],
            name=op.f(
                "fk_tool_template_knowledge_space_reference_knowledge_space_id_knowledge_space"
            ),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["tool_template_id"],
            ["tool_template.id"],
            name=op.f("fk_tool_template_knowledge_space_reference_tool_template_id_tool_template"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tool_template_knowledge_space_reference")),
        sa.UniqueConstraint(
            "tool_template_id",
            "knowledge_space_id",
            "owner_id",
            name=op.f("uq_tool_template_knowledge_space_reference_tool_template_id"),
        ),
    )

    op.create_index(
        op.f("ix_tool_template_knowledge_space_reference_knowledge_space_id"),
        "tool_template_knowledge_space_reference",
        ["knowledge_space_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_tool_template_knowledge_space_reference_tool_template_id"),
        "tool_template_knowledge_space_reference",
        ["tool_template_id"],
        unique=False,
    )

    op.create_table(
        "knowledge_resource",
        sa.Column("knowledge_space_id", sa.Uuid(), nullable=False),
        sa.Column("folder_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "resource_type", sa.String(length=32), server_default=sa.text("'file'"), nullable=False
        ),
        sa.Column(
            "status", sa.String(length=16), server_default=sa.text("'pending'"), nullable=False
        ),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("guide", sa.Text(), nullable=True),
        sa.Column("mime_type", sa.String(length=255), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("checksum", sa.LargeBinary(), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("last_indexed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "resource_type = 'file'", name=op.f("ck_knowledge_resource_resource_type_values")
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'indexing', 'indexed', 'needs_review', 'unsupported', 'failed')",
            name=op.f("ck_knowledge_resource_status_values"),
        ),
        sa.CheckConstraint(
            "checksum IS NULL OR octet_length(checksum) = 32",
            name=op.f("ck_knowledge_resource_checksum_sha256_length"),
        ),
        sa.CheckConstraint(
            "size_bytes IS NULL OR size_bytes >= 0",
            name=op.f("ck_knowledge_resource_size_bytes_nonnegative"),
        ),
        sa.ForeignKeyConstraint(
            ["folder_id"],
            ["knowledge_folder.id"],
            name=op.f("fk_knowledge_resource_folder_id_knowledge_folder"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_space_id"],
            ["knowledge_space.id"],
            name=op.f("fk_knowledge_resource_knowledge_space_id_knowledge_space"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_knowledge_resource")),
    )

    op.create_index(
        op.f("ix_knowledge_resource_folder_id"), "knowledge_resource", ["folder_id"], unique=False
    )

    op.create_index(
        op.f("ix_knowledge_resource_knowledge_space_id"),
        "knowledge_resource",
        ["knowledge_space_id"],
        unique=False,
    )

    op.create_index(
        "ix_knowledge_resource_space_folder",
        "knowledge_resource",
        ["knowledge_space_id", "folder_id"],
        unique=False,
    )

    op.create_index(
        "ix_knowledge_resource_space_status",
        "knowledge_resource",
        ["knowledge_space_id", "status"],
        unique=False,
    )

    op.create_table(
        "graph_issue_resource",
        sa.Column("graph_issue_id", sa.Uuid(), nullable=False),
        sa.Column("knowledge_resource_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["graph_issue_id"],
            ["graph_issue.id"],
            name=op.f("fk_graph_issue_resource_graph_issue_id_graph_issue"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_resource_id"],
            ["knowledge_resource.id"],
            name=op.f("fk_graph_issue_resource_knowledge_resource_id_knowledge_resource"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "graph_issue_id", "knowledge_resource_id", name=op.f("pk_graph_issue_resource")
        ),
    )

    op.create_index(
        op.f("ix_graph_issue_resource_knowledge_resource_id"),
        "graph_issue_resource",
        ["knowledge_resource_id"],
        unique=False,
    )

    op.create_table(
        "knowledge_relation",
        sa.Column("knowledge_space_id", sa.Uuid(), nullable=False),
        sa.Column("source_resource_id", sa.Uuid(), nullable=False),
        sa.Column("target_resource_id", sa.Uuid(), nullable=False),
        sa.Column("relation_kind", sa.String(length=32), nullable=False),
        sa.Column(
            "status", sa.String(length=16), server_default=sa.text("'active'"), nullable=False
        ),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("source", sa.String(length=16), server_default=sa.text("'user'"), nullable=False),
        sa.Column(
            "confirmed_by_user", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "relation_kind IN ('references', 'builds_on', 'explains', 'supports', 'contradicts', 'supersedes', 'related_to')",
            name=op.f("ck_knowledge_relation_relation_kind_values"),
        ),
        sa.CheckConstraint(
            "source IN ('user', 'seed')", name=op.f("ck_knowledge_relation_source_values")
        ),
        sa.CheckConstraint(
            "status IN ('active', 'needs_review')", name=op.f("ck_knowledge_relation_status_values")
        ),
        sa.CheckConstraint(
            "confidence IS NULL OR confidence BETWEEN 0 AND 1",
            name=op.f("ck_knowledge_relation_confidence_range"),
        ),
        sa.CheckConstraint(
            "source_resource_id <> target_resource_id",
            name=op.f("ck_knowledge_relation_no_self_relation"),
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_space_id"],
            ["knowledge_space.id"],
            name=op.f("fk_knowledge_relation_knowledge_space_id_knowledge_space"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_resource_id"],
            ["knowledge_resource.id"],
            name=op.f("fk_knowledge_relation_source_resource_id_knowledge_resource"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["target_resource_id"],
            ["knowledge_resource.id"],
            name=op.f("fk_knowledge_relation_target_resource_id_knowledge_resource"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_knowledge_relation")),
    )

    op.create_index(
        op.f("ix_knowledge_relation_knowledge_space_id"),
        "knowledge_relation",
        ["knowledge_space_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_knowledge_relation_source_resource_id"),
        "knowledge_relation",
        ["source_resource_id"],
        unique=False,
    )

    op.create_index(
        "ix_knowledge_relation_space_source",
        "knowledge_relation",
        ["knowledge_space_id", "source_resource_id"],
        unique=False,
    )

    op.create_index(
        "ix_knowledge_relation_space_target",
        "knowledge_relation",
        ["knowledge_space_id", "target_resource_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_knowledge_relation_target_resource_id"),
        "knowledge_relation",
        ["target_resource_id"],
        unique=False,
    )

    op.create_table(
        "knowledge_resource_artifact",
        sa.Column("knowledge_resource_id", sa.Uuid(), nullable=False),
        sa.Column("artifact_kind", sa.String(length=32), nullable=False),
        sa.Column(
            "status", sa.String(length=16), server_default=sa.text("'staging'"), nullable=False
        ),
        sa.Column("storage_provider", sa.String(length=32), nullable=False),
        sa.Column("storage_bucket", sa.String(length=255), nullable=False),
        sa.Column("object_key", sa.Text(), nullable=False),
        sa.Column("storage_version_id", sa.Text(), nullable=True),
        sa.Column("declared_content_type", sa.String(length=255), nullable=False),
        sa.Column("declared_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("upload_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column(
            "checksum_algorithm",
            sa.String(length=16),
            server_default=sa.text("'sha256'"),
            nullable=False,
        ),
        sa.Column("checksum", sa.LargeBinary(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "(status = 'staging' AND activated_at IS NULL AND failed_at IS NULL AND upload_expires_at IS NOT NULL) OR (status = 'active' AND activated_at IS NOT NULL AND failed_at IS NULL AND content_type IS NOT NULL AND size_bytes IS NOT NULL AND checksum IS NOT NULL) OR (status = 'superseded' AND activated_at IS NOT NULL AND failed_at IS NULL) OR (status = 'failed' AND activated_at IS NULL AND failed_at IS NOT NULL)",
            name=op.f("ck_knowledge_resource_artifact_status_fields"),
        ),
        sa.CheckConstraint(
            "artifact_kind IN ('original', 'extracted_text', 'preview', 'thumbnail', 'ocr_result')",
            name=op.f("ck_knowledge_resource_artifact_artifact_kind_values"),
        ),
        sa.CheckConstraint(
            "checksum_algorithm = 'sha256'",
            name=op.f("ck_knowledge_resource_artifact_checksum_algorithm_values"),
        ),
        sa.CheckConstraint(
            "status IN ('staging', 'active', 'failed', 'superseded')",
            name=op.f("ck_knowledge_resource_artifact_status_values"),
        ),
        sa.CheckConstraint(
            "storage_provider IN ('minio', 's3', 'aliyun_oss')",
            name=op.f("ck_knowledge_resource_artifact_provider_values"),
        ),
        sa.CheckConstraint(
            "checksum IS NULL OR octet_length(checksum) = 32",
            name=op.f("ck_knowledge_resource_artifact_checksum_sha256_length"),
        ),
        sa.CheckConstraint(
            "declared_size_bytes >= 0",
            name=op.f("ck_knowledge_resource_artifact_declared_size_nonnegative"),
        ),
        sa.CheckConstraint(
            "size_bytes IS NULL OR size_bytes >= 0",
            name=op.f("ck_knowledge_resource_artifact_size_bytes_nonnegative"),
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_resource_id"],
            ["knowledge_resource.id"],
            name=op.f("fk_knowledge_resource_artifact_knowledge_resource_id_knowledge_resource"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_knowledge_resource_artifact")),
        sa.UniqueConstraint(
            "storage_provider",
            "storage_bucket",
            "object_key",
            name=op.f("uq_knowledge_resource_artifact_storage_provider"),
        ),
    )

    op.create_index(
        op.f("ix_knowledge_resource_artifact_knowledge_resource_id"),
        "knowledge_resource_artifact",
        ["knowledge_resource_id"],
        unique=False,
    )

    op.create_index(
        "ix_knowledge_resource_artifact_resource_kind_status",
        "knowledge_resource_artifact",
        ["knowledge_resource_id", "artifact_kind", "status"],
        unique=False,
    )

    op.create_index(
        "uq_knowledge_resource_artifact_active_kind",
        "knowledge_resource_artifact",
        ["knowledge_resource_id", "artifact_kind"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "knowledge_resource_tag",
        sa.Column("knowledge_resource_id", sa.Uuid(), nullable=False),
        sa.Column("knowledge_tag_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_resource_id"],
            ["knowledge_resource.id"],
            name=op.f("fk_knowledge_resource_tag_knowledge_resource_id_knowledge_resource"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_tag_id"],
            ["knowledge_tag.id"],
            name=op.f("fk_knowledge_resource_tag_knowledge_tag_id_knowledge_tag"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "knowledge_resource_id", "knowledge_tag_id", name=op.f("pk_knowledge_resource_tag")
        ),
    )

    op.create_index(
        "ix_knowledge_resource_tag_tag_resource",
        "knowledge_resource_tag",
        ["knowledge_tag_id", "knowledge_resource_id"],
        unique=False,
    )

    op.create_table(
        "graph_issue_relation",
        sa.Column("graph_issue_id", sa.Uuid(), nullable=False),
        sa.Column("knowledge_relation_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["graph_issue_id"],
            ["graph_issue.id"],
            name=op.f("fk_graph_issue_relation_graph_issue_id_graph_issue"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_relation_id"],
            ["knowledge_relation.id"],
            name=op.f("fk_graph_issue_relation_knowledge_relation_id_knowledge_relation"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "graph_issue_id", "knowledge_relation_id", name=op.f("pk_graph_issue_relation")
        ),
    )

    op.create_index(
        op.f("ix_graph_issue_relation_knowledge_relation_id"),
        "graph_issue_relation",
        ["knowledge_relation_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("graph_issue_relation")
    op.drop_table("knowledge_resource_tag")
    op.drop_table("knowledge_resource_artifact")
    op.drop_table("knowledge_relation")
    op.drop_table("graph_issue_resource")
    op.drop_table("knowledge_resource")
    op.drop_table("tool_template_knowledge_space_reference")
    op.drop_table("knowledge_tag")
    op.drop_table("knowledge_folder")
    op.drop_table("graph_issue")
    op.drop_table("agent_workflow_knowledge_space_reference")
    op.drop_table("agent_variable")
    op.drop_table("agent_template_knowledge_space_reference")
    op.drop_table("agent_reusable_tool")
    op.drop_table("knowledge_space")
    op.drop_table("agent_workflow")
    op.drop_table("tool_template")
    op.drop_table("pattern_template")
    op.drop_table("ody_journey")
    op.drop_table("knowledge_space_category")
    op.drop_table("agent_template")
    op.drop_table("workspace")
    op.drop_table("tool_definition")
    op.drop_table("storage_object_deletion_outbox")
