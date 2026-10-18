from uuid import uuid4

import pytest
from pydantic import ValidationError

from odyssey_api.journeys.dto import SaveAgentWorkflowRequest, ScriptExecutionConfiguration
from odyssey_api.journeys.workflow_domain import (
    KnowledgeReferenceOwnerKind,
    extract_knowledge_space_references,
)


def _literal(value: str) -> dict[str, object]:
    return {"kind": "literal", "value": value}


def _dict(value: object) -> dict[str, object]:
    assert isinstance(value, dict)
    return value


def _request_payload() -> tuple[dict[str, object], dict[str, object]]:
    action_space_id, nested_space_id, task_space_id, reusable_space_id = (
        uuid4(),
        uuid4(),
        uuid4(),
        uuid4(),
    )
    action_id, nested_id, task_step_id, reusable_id = uuid4(), uuid4(), uuid4(), uuid4()
    task_variable_id = uuid4()
    payload: dict[str, object] = {
        "expectedRevision": 1,
        "workflow": {
            "schemaVersion": "1.0.0",
            "edges": [],
            "nodes": [
                {
                    "id": str(action_id),
                    "name": "Action",
                    "type": "agent_action",
                    "config": {
                        "model": "gpt-5",
                        "goal": _literal("research"),
                        "knowledgeSpaceIds": [str(action_space_id)],
                        "reusableToolIds": [],
                    },
                },
                {
                    "id": str(uuid4()),
                    "name": "Task",
                    "type": "task",
                    "config": {
                        "localVariables": [],
                        "steps": [
                            {
                                "id": str(task_step_id),
                                "kind": "knowledge_retrieval",
                                "failureBehavior": {"kind": "fail_task"},
                                "configuration": {
                                    "knowledgeSpaceId": str(task_space_id),
                                    "query": _literal("query"),
                                },
                                "outputMapping": {
                                    "sourceKey": "retrieved_documents",
                                    "targetVariableId": str(task_variable_id),
                                },
                            }
                        ],
                    },
                },
                {
                    "id": str(uuid4()),
                    "name": "Loop",
                    "type": "loop",
                    "config": {
                        "maxTurns": 2,
                        "exitCondition": {
                            "kind": "variable_comparison",
                            "variableId": str(uuid4()),
                            "operator": "eq",
                            "value": True,
                        },
                        "body": {
                            "graph": {
                                "nodes": [
                                    {
                                        "id": str(nested_id),
                                        "name": "Nested",
                                        "type": "agent_action",
                                        "config": {
                                            "model": "gpt-5",
                                            "goal": _literal("nested"),
                                            "knowledgeSpaceIds": [str(nested_space_id)],
                                            "reusableToolIds": [],
                                        },
                                    }
                                ],
                                "edges": [],
                            },
                            "layout": {
                                "nodePlacements": [{"nodeId": str(nested_id), "x": 0, "y": 0}],
                                "viewport": {"x": 0, "y": 0, "zoom": 1},
                            },
                        },
                    },
                },
            ],
        },
        "layout": {
            "schemaVersion": "1.0.0",
            "nodePlacements": [],
            "viewport": {"x": 0, "y": 0, "zoom": 1},
        },
        "variables": [],
        "reusableTools": [
            {
                "id": str(reusable_id),
                "name": "Search",
                "sourceTemplateId": None,
                "kind": "knowledge_retrieval",
                "configuration": {"knowledgeSpaceId": str(reusable_space_id)},
                "inputBindings": [],
                "outputBinding": None,
            }
        ],
    }
    expected = {
        "action": (action_space_id, KnowledgeReferenceOwnerKind.AGENT_ACTION, action_id),
        "nested": (nested_space_id, KnowledgeReferenceOwnerKind.AGENT_ACTION, nested_id),
        "task": (task_space_id, KnowledgeReferenceOwnerKind.TASK_TOOL, task_step_id),
        "reusable": (reusable_space_id, KnowledgeReferenceOwnerKind.REUSABLE_TOOL, reusable_id),
    }
    return payload, expected


def test_extracts_root_nested_task_and_reusable_knowledge_references() -> None:
    payload, expected = _request_payload()
    request = SaveAgentWorkflowRequest.model_validate(payload)
    references = extract_knowledge_space_references(request.workflow, request.reusable_tools)
    assert {
        (item.knowledge_space_id, item.owner_kind, item.owner_id) for item in references
    } == set(expected.values())


def test_strict_workflow_boundary_rejects_malformed_and_duplicate_configs() -> None:
    payload, _ = _request_payload()
    workflow = _dict(payload["workflow"])
    nodes = workflow["nodes"]
    assert isinstance(nodes, list)
    action = _dict(nodes[0])
    action_config = _dict(action["config"])
    ids = action_config["knowledgeSpaceIds"]
    assert isinstance(ids, list)
    ids.extend(ids)
    with pytest.raises(ValidationError):
        SaveAgentWorkflowRequest.model_validate(payload)


def test_reusable_tools_must_be_owned_and_unique_across_root_and_nested_actions() -> None:
    payload, _ = _request_payload()
    workflow = _dict(payload["workflow"])
    nodes = workflow["nodes"]
    reusable_tools = payload["reusableTools"]
    assert isinstance(nodes, list)
    assert isinstance(reusable_tools, list)
    reusable = _dict(reusable_tools[0])
    reusable_id = reusable["id"]

    root_action = _dict(nodes[0])
    _dict(root_action["config"])["reusableToolIds"] = [reusable_id]
    loop = _dict(nodes[2])
    body = _dict(_dict(loop["config"])["body"])
    nested_nodes = _dict(body["graph"])["nodes"]
    assert isinstance(nested_nodes, list)
    nested_action = _dict(nested_nodes[0])
    _dict(nested_action["config"])["reusableToolIds"] = [reusable_id]
    SaveAgentWorkflowRequest.model_validate(payload)

    _dict(nested_action["config"])["reusableToolIds"] = [str(uuid4())]
    with pytest.raises(ValidationError):
        SaveAgentWorkflowRequest.model_validate(payload)

    payload, _ = _request_payload()
    reusable_tools = payload["reusableTools"]
    assert isinstance(reusable_tools, list)
    reusable_tools.append(dict(_dict(reusable_tools[0])))
    with pytest.raises(ValidationError):
        SaveAgentWorkflowRequest.model_validate(payload)

    payload, _ = _request_payload()
    reusable_tools = payload["reusableTools"]
    assert isinstance(reusable_tools, list)
    reusable = _dict(reusable_tools[0])
    reusable["configuration"] = {"url": _literal("https://example.com")}
    with pytest.raises(ValidationError):
        SaveAgentWorkflowRequest.model_validate(payload)

    payload, _ = _request_payload()
    workflow = _dict(payload["workflow"])
    nodes = workflow["nodes"]
    assert isinstance(nodes, list)
    loop = _dict(nodes[2])
    loop_config = _dict(loop["config"])
    body = _dict(loop_config["body"])
    del body["layout"]
    with pytest.raises(ValidationError):
        SaveAgentWorkflowRequest.model_validate(payload)


def test_script_execution_inputs_default_to_array_and_reject_null() -> None:
    configuration = ScriptExecutionConfiguration.model_validate(
        {"language": "javascript", "script": "return true;"}
    )
    assert configuration.model_dump(mode="json", by_alias=True) == {
        "language": "javascript",
        "inputs": [],
        "script": "return true;",
    }

    with pytest.raises(ValidationError):
        ScriptExecutionConfiguration.model_validate(
            {"language": "javascript", "inputs": None, "script": "return true;"}
        )
