from sqlalchemy import CheckConstraint

from odyssey_api.db.base import Base
from odyssey_api.db.models import (
    AgentTemplate,
    AgentWorkflow,
    JourneyGuardrail,
    KnowledgeResourceArtifact,
    PatternTemplate,
    StorageObjectDeletionOutbox,
    ToolTemplate,
    VariableOwnership,
)


def test_workflow_graph_and_canvas_layout_are_separate_columns() -> None:
    columns = AgentWorkflow.__table__.columns
    assert "workflow_graph" in columns
    assert "canvas_layout" in columns


def test_persistent_variable_ownership_has_only_confirmed_values() -> None:
    assert {item.value for item in VariableOwnership} == {
        "user_managed",
        "shared",
        "agent_managed",
    }


def test_v1_baseline_contains_all_first_class_tables() -> None:
    assert set(Base.metadata.tables) == {
        "workspace",
        "knowledge_space_category",
        "ody_journey",
        "agent_workflow",
        "journey_guardrail",
        "tool_definition",
        "pattern_template",
        "agent_template",
        "tool_template",
        "agent_variable",
        "agent_reusable_tool",
        "knowledge_space",
        "knowledge_graph_manifest_import",
        "knowledge_folder",
        "knowledge_resource",
        "knowledge_resource_artifact",
        "knowledge_tag",
        "knowledge_resource_tag",
        "knowledge_relation",
        "graph_issue",
        "graph_issue_resource",
        "graph_issue_relation",
        "agent_workflow_knowledge_space_reference",
        "agent_template_knowledge_space_reference",
        "tool_template_knowledge_space_reference",
        "storage_object_deletion_outbox",
    }


def test_guardrail_binding_is_side_scoped_and_agent_unique() -> None:
    table = JourneyGuardrail.__table__
    assert set(table.primary_key.columns.keys()) == {"ody_journey_id", "side"}
    assert any(constraint.name == "uq_journey_guardrail_agent" for constraint in table.constraints)


def test_agent_workflow_uses_current_revision_without_version_pointer() -> None:
    columns = AgentWorkflow.__table__.columns
    assert "revision" in columns
    assert "normalized_name" in columns
    assert "current_version_id" not in columns


def test_template_lineage_uses_set_null() -> None:
    for model in (PatternTemplate, AgentTemplate, ToolTemplate):
        foreign_key = next(iter(model.__table__.columns.source_template_id.foreign_keys))
        assert foreign_key.ondelete == "SET NULL"


def test_artifact_has_staged_upload_and_active_uniqueness_contract() -> None:
    table = KnowledgeResourceArtifact.__table__
    assert {
        "declared_content_type",
        "declared_size_bytes",
        "upload_expires_at",
        "storage_provider",
        "storage_bucket",
        "object_key",
        "checksum",
    } <= set(table.columns.keys())
    assert any(
        index.name == "uq_knowledge_resource_artifact_active_kind"
        and index.unique
        and index.dialect_options["postgresql"]["where"] is not None
        for index in table.indexes
    )
    assert any(
        constraint.name == "ck_knowledge_resource_artifact_status_fields"
        for constraint in table.constraints
        if isinstance(constraint, CheckConstraint)
    )


def test_storage_outbox_has_lease_fencing_contract() -> None:
    table = StorageObjectDeletionOutbox.__table__
    assert {"lease_token", "lease_expires_at", "idempotency_key"} <= set(table.columns.keys())
    check_names = {
        constraint.name
        for constraint in table.constraints
        if isinstance(constraint, CheckConstraint)
    }
    assert "ck_storage_object_deletion_outbox_lease_fields" in check_names
    assert "ck_storage_object_deletion_outbox_idempotency_sha256_length" in check_names


def test_all_knowledge_space_reference_fks_restrict_deletion() -> None:
    for table_name in (
        "agent_workflow_knowledge_space_reference",
        "agent_template_knowledge_space_reference",
        "tool_template_knowledge_space_reference",
    ):
        column = Base.metadata.tables[table_name].columns.knowledge_space_id
        assert next(iter(column.foreign_keys)).ondelete == "RESTRICT"
