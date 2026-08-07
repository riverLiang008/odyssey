"""Create the initial Odyssey configuration foundation.

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

variable_ownership = sa.Enum("user_managed", "shared", "agent_managed", name="variable_ownership")


def upgrade() -> None:
    op.create_table(
        "workspace",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workspace")),
    )
    op.create_table(
        "ody_journey",
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("pattern_config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["workspace.id"], name=op.f("fk_ody_journey_workspace_id_workspace")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ody_journey")),
    )
    op.create_index(op.f("ix_ody_journey_workspace_id"), "ody_journey", ["workspace_id"])
    op.create_table(
        "agent_workflow",
        sa.Column("ody_journey_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("workflow_graph", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("canvas_layout", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("current_version_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["ody_journey_id"],
            ["ody_journey.id"],
            name=op.f("fk_agent_workflow_ody_journey_id_ody_journey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_workflow")),
    )
    op.create_index(op.f("ix_agent_workflow_ody_journey_id"), "agent_workflow", ["ody_journey_id"])
    op.create_table(
        "agent_reusable_tool",
        sa.Column("agent_workflow_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("tool_configuration", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["agent_workflow_id"],
            ["agent_workflow.id"],
            name=op.f("fk_agent_reusable_tool_agent_workflow_id_agent_workflow"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_reusable_tool")),
    )
    op.create_index(
        op.f("ix_agent_reusable_tool_agent_workflow_id"),
        "agent_reusable_tool",
        ["agent_workflow_id"],
    )
    op.create_table(
        "agent_variable",
        sa.Column("agent_workflow_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("data_type", sa.String(length=32), nullable=False),
        sa.Column("ownership", variable_ownership, nullable=False),
        sa.Column("default_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["agent_workflow_id"],
            ["agent_workflow.id"],
            name=op.f("fk_agent_variable_agent_workflow_id_agent_workflow"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_variable")),
        sa.UniqueConstraint(
            "agent_workflow_id", "name", name=op.f("uq_agent_variable_agent_workflow_id")
        ),
    )
    op.create_index(
        op.f("ix_agent_variable_agent_workflow_id"), "agent_variable", ["agent_workflow_id"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_agent_variable_agent_workflow_id"), table_name="agent_variable")
    op.drop_table("agent_variable")
    op.drop_index(
        op.f("ix_agent_reusable_tool_agent_workflow_id"), table_name="agent_reusable_tool"
    )
    op.drop_table("agent_reusable_tool")
    op.drop_index(op.f("ix_agent_workflow_ody_journey_id"), table_name="agent_workflow")
    op.drop_table("agent_workflow")
    op.drop_index(op.f("ix_ody_journey_workspace_id"), table_name="ody_journey")
    op.drop_table("ody_journey")
    op.drop_table("workspace")
    variable_ownership.drop(op.get_bind(), checkfirst=True)
