"""Add Knowledge Graph Manifest provenance.

Revision ID: 20261017_0004
Revises: 20261014_0003
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261017_0004"
down_revision: str | None = "20261014_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SOURCE_VALUES = "source IN ('user', 'manifest', 'llm', 'seed')"


def upgrade() -> None:
    op.add_column("knowledge_resource", sa.Column("summary_source", sa.String(16)))
    op.add_column("knowledge_resource", sa.Column("summary_source_key", sa.String(128)))
    op.add_column("knowledge_resource", sa.Column("guide_source", sa.String(16)))
    op.add_column("knowledge_resource", sa.Column("guide_source_key", sa.String(128)))
    op.execute("UPDATE knowledge_resource SET summary_source = 'user' WHERE summary IS NOT NULL")
    op.execute("UPDATE knowledge_resource SET guide_source = 'user' WHERE guide IS NOT NULL")
    op.create_check_constraint(
        op.f("ck_knowledge_resource_summary_source_values"),
        "knowledge_resource",
        "summary_source IS NULL OR summary_source IN ('user', 'manifest', 'llm', 'seed')",
    )
    op.create_check_constraint(
        op.f("ck_knowledge_resource_guide_source_values"),
        "knowledge_resource",
        "guide_source IS NULL OR guide_source IN ('user', 'manifest', 'llm', 'seed')",
    )

    for table_name in ("knowledge_tag", "knowledge_resource_tag"):
        op.add_column(
            table_name,
            sa.Column("source", sa.String(16), server_default=sa.text("'user'"), nullable=False),
        )
        op.add_column(table_name, sa.Column("source_key", sa.String(128)))
        op.create_check_constraint(
            op.f(f"ck_{table_name}_source_values"), table_name, SOURCE_VALUES
        )

    for table_name in ("knowledge_relation", "graph_issue"):
        op.drop_constraint(op.f(f"ck_{table_name}_source_values"), table_name, type_="check")
        op.create_check_constraint(
            op.f(f"ck_{table_name}_source_values"), table_name, SOURCE_VALUES
        )
        op.add_column(table_name, sa.Column("source_key", sa.String(128)))

    op.create_table(
        "knowledge_graph_manifest_import",
        sa.Column("knowledge_space_id", sa.Uuid(), nullable=False),
        sa.Column("manifest_key", sa.String(128), nullable=False),
        sa.Column("manifest_checksum", sa.LargeBinary(), nullable=False),
        sa.Column("applied_revision", sa.Integer(), nullable=False),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "octet_length(manifest_checksum) = 32",
            name=op.f("ck_knowledge_graph_manifest_import_checksum_sha256_length"),
        ),
        sa.CheckConstraint(
            "applied_revision >= 1",
            name=op.f("ck_knowledge_graph_manifest_import_applied_revision_positive"),
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_space_id"],
            ["knowledge_space.id"],
            name=op.f("fk_knowledge_graph_manifest_import_knowledge_space_id_knowledge_space"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_knowledge_graph_manifest_import")),
        sa.UniqueConstraint(
            "knowledge_space_id",
            name=op.f("uq_knowledge_graph_manifest_import_knowledge_space_id"),
        ),
    )
    op.create_index(
        op.f("ix_knowledge_graph_manifest_import_knowledge_space_id"),
        "knowledge_graph_manifest_import",
        ["knowledge_space_id"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_knowledge_graph_manifest_import_knowledge_space_id"),
        table_name="knowledge_graph_manifest_import",
    )
    op.drop_table("knowledge_graph_manifest_import")

    for table_name in ("graph_issue", "knowledge_relation"):
        op.drop_column(table_name, "source_key")
        op.drop_constraint(op.f(f"ck_{table_name}_source_values"), table_name, type_="check")
        op.execute(
            sa.text(f"UPDATE {table_name} SET source = 'seed' WHERE source IN ('manifest', 'llm')")
        )
        op.create_check_constraint(
            op.f(f"ck_{table_name}_source_values"),
            table_name,
            "source IN ('user', 'seed')",
        )

    for table_name in ("knowledge_resource_tag", "knowledge_tag"):
        op.drop_constraint(op.f(f"ck_{table_name}_source_values"), table_name, type_="check")
        op.drop_column(table_name, "source_key")
        op.drop_column(table_name, "source")

    op.drop_constraint(
        op.f("ck_knowledge_resource_guide_source_values"),
        "knowledge_resource",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_knowledge_resource_summary_source_values"),
        "knowledge_resource",
        type_="check",
    )
    op.drop_column("knowledge_resource", "guide_source_key")
    op.drop_column("knowledge_resource", "guide_source")
    op.drop_column("knowledge_resource", "summary_source_key")
    op.drop_column("knowledge_resource", "summary_source")
