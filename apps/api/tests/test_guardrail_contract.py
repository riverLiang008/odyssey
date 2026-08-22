from uuid import uuid4

import pytest
from pydantic import ValidationError

from odyssey_api.journeys.dto import AddGuardrailRequest, RemoveGuardrailRequest
from odyssey_api.journeys.guardrail_domain import GuardrailSide


def test_guardrail_side_is_strict() -> None:
    assert GuardrailSide("input") is GuardrailSide.INPUT
    assert GuardrailSide("output") is GuardrailSide.OUTPUT
    with pytest.raises(ValueError):
        GuardrailSide("before")


def test_guardrail_command_bodies_are_strict() -> None:
    assert AddGuardrailRequest.model_validate({"expectedRevision": 3}).expected_revision == 3
    assert (
        RemoveGuardrailRequest.model_validate(
            {"expectedRevision": 4, "expectedAgentId": str(uuid4())}
        ).expected_revision
        == 4
    )
    with pytest.raises(ValidationError):
        AddGuardrailRequest.model_validate({"expectedRevision": 3, "workspaceId": str(uuid4())})
    with pytest.raises(ValidationError):
        RemoveGuardrailRequest.model_validate({"expectedRevision": 4})
