from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from odyssey_api.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class VariableOwnership(StrEnum):
    USER_MANAGED = "user_managed"
    SHARED = "shared"
    AGENT_MANAGED = "agent_managed"


class Workspace(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workspace"

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)


class OdyJourney(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ody_journey"

    workspace_id: Mapped[UUID] = mapped_column(ForeignKey("workspace.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    pattern_config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list)


class AgentWorkflow(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_workflow"

    ody_journey_id: Mapped[UUID] = mapped_column(ForeignKey("ody_journey.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    # Semantic graph and presentation layout intentionally have separate persistence fields.
    workflow_graph: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    canvas_layout: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    current_version_id: Mapped[UUID | None] = mapped_column(nullable=True)


class AgentVariable(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_variable"
    __table_args__ = (UniqueConstraint("agent_workflow_id", "name"),)

    agent_workflow_id: Mapped[UUID] = mapped_column(ForeignKey("agent_workflow.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    data_type: Mapped[str] = mapped_column(String(32))
    ownership: Mapped[VariableOwnership] = mapped_column(
        Enum(
            VariableOwnership,
            name="variable_ownership",
            values_callable=lambda enum_type: [item.value for item in enum_type],
        )
    )
    default_value: Mapped[Any | None] = mapped_column(JSONB)


class AgentReusableTool(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "agent_reusable_tool"

    agent_workflow_id: Mapped[UUID] = mapped_column(ForeignKey("agent_workflow.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    tool_configuration: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
