"""Add Journey-owned optional Guardrail bindings.

Revision ID: 20260822_0002
Revises: 20260806_0001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260822_0002"
down_revision: str | None = "20260806_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_agent_workflow_id_journey",
        "agent_workflow",
        ["id", "ody_journey_id"],
    )
    op.create_table(
        "journey_guardrail",
        sa.Column("ody_journey_id", sa.Uuid(), nullable=False),
        sa.Column("side", sa.String(length=16), nullable=False),
        sa.Column("agent_workflow_id", sa.Uuid(), nullable=False),
        sa.Column(
            "structure",
            sa.String(length=16),
            server_default=sa.text("'single'"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("side IN ('input', 'output')", name="ck_journey_guardrail_side_values"),
        sa.CheckConstraint("structure = 'single'", name="ck_journey_guardrail_structure_single"),
        sa.ForeignKeyConstraint(
            ["ody_journey_id"],
            ["ody_journey.id"],
            name="fk_journey_guardrail_ody_journey_id_ody_journey",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["agent_workflow_id", "ody_journey_id"],
            ["agent_workflow.id", "agent_workflow.ody_journey_id"],
            name="fk_journey_guardrail_agent_journey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("ody_journey_id", "side", name="pk_journey_guardrail"),
        sa.UniqueConstraint("agent_workflow_id", name="uq_journey_guardrail_agent"),
    )
    op.create_index(
        "ix_journey_guardrail_agent_workflow_id",
        "journey_guardrail",
        ["agent_workflow_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_journey_guardrail_agent_workflow_id", table_name="journey_guardrail")
    op.drop_table("journey_guardrail")
    op.drop_constraint("uq_agent_workflow_id_journey", "agent_workflow", type_="unique")
