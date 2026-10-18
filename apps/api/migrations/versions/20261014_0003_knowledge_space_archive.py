"""Allow Knowledge Spaces to be archived.

Revision ID: 20261014_0003
Revises: 20260822_0002
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261014_0003"
down_revision: str | None = "20260822_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        op.f("ck_knowledge_space_lifecycle_status_values"),
        "knowledge_space",
        type_="check",
    )
    op.create_check_constraint(
        op.f("ck_knowledge_space_lifecycle_status_values"),
        "knowledge_space",
        "lifecycle_status IN ('initializing', 'ready', 'syncing', 'failed', 'archived')",
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE knowledge_space SET lifecycle_status = 'failed' "
            "WHERE lifecycle_status = 'archived'"
        )
    )
    op.drop_constraint(
        op.f("ck_knowledge_space_lifecycle_status_values"),
        "knowledge_space",
        type_="check",
    )
    op.create_check_constraint(
        op.f("ck_knowledge_space_lifecycle_status_values"),
        "knowledge_space",
        "lifecycle_status IN ('initializing', 'ready', 'syncing', 'failed')",
    )
