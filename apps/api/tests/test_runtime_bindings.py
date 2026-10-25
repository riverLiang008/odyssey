import copy
import json
from pathlib import Path
from uuid import UUID

import pytest
from pydantic import ValidationError

from odyssey_api.journeys.dto import AgentTemplateSnapshot, SaveAgentWorkflowRequest
from odyssey_api.journeys.workflow_domain import extract_knowledge_space_references


def fixture() -> dict:
    path = Path(__file__).resolve().parents[3] / "packages/schemas/fixtures/runtime-bindings.json"
    return json.loads(path.read_text(encoding="utf-8"))


def test_cross_language_system_binding_round_trip_and_fixed_reference_extraction() -> None:
    data = fixture()
    snapshot = AgentTemplateSnapshot.model_validate(data)
    dumped = snapshot.model_dump(mode="json", by_alias=True, exclude_none=True)
    assert dumped["workflow"] == data["workflow"]
    assert dumped["reusableTools"][0]["configuration"] == data["reusableTools"][0]["configuration"]
    references = extract_knowledge_space_references(snapshot.workflow, snapshot.reusable_tools)
    assert [reference.knowledge_space_id for reference in references] == [
        UUID("00000000-0000-4000-8000-000000000099")
    ]
    request = SaveAgentWorkflowRequest.model_validate({"expectedRevision": 1, **data})
    assert request.workflow == snapshot.workflow


@pytest.mark.parametrize("version", ["1.0.0", "1.1.0"])
def test_old_versions_cannot_contain_system_bindings(version: str) -> None:
    data = fixture()
    data["workflow"]["schemaVersion"] = version
    with pytest.raises(ValidationError, match="System bindings require"):
        AgentTemplateSnapshot.model_validate(data)


@pytest.mark.parametrize("key", ["missing", "document_id"])
def test_system_resource_keys_are_strict(key: str) -> None:
    data = fixture()
    data["workflow"]["nodes"][2]["config"]["knowledgeSpaceIds"][1]["key"] = key
    with pytest.raises(ValidationError):
        AgentTemplateSnapshot.model_validate(data)


def test_reusable_only_binding_also_requires_new_version() -> None:
    data = fixture()
    data["workflow"]["nodes"] = data["workflow"]["nodes"][:2]
    data["workflow"]["schemaVersion"] = "1.1.0"
    with pytest.raises(ValidationError, match="System bindings require"):
        AgentTemplateSnapshot.model_validate(data)


def test_literal_json_looking_like_binding_is_preserved() -> None:
    data = fixture()
    data["workflow"]["schemaVersion"] = "1.1.0"
    data["workflow"]["nodes"][2]["config"].update(
        goal={"kind": "literal", "value": {"kind": "system", "key": "custom"}},
        knowledgeSpaceIds=[],
        reusableToolIds=[],
    )
    data["reusableTools"] = []
    original = copy.deepcopy(data)
    snapshot = AgentTemplateSnapshot.model_validate(data)
    assert (
        snapshot.workflow.nodes[2].configuration.goal.value
        == original["workflow"]["nodes"][2]["config"]["goal"]["value"]
    )
