from odyssey_api.db.models import AgentWorkflow, VariableOwnership


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
