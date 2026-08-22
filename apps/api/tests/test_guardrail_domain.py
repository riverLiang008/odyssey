from uuid import uuid4

from odyssey_api.journeys.guardrail_domain import (
    GuardrailStateIssue,
    validate_guardrail_agent_ids,
)


def test_optional_guardrails_accept_inactive_and_distinct_active_agents() -> None:
    input_agent_id = uuid4()
    output_agent_id = uuid4()
    assert (
        validate_guardrail_agent_ids(
            input_agent_id=None,
            output_agent_id=None,
            journey_agent_ids=set(),
            pattern_agent_ids=set(),
        )
        == []
    )
    assert (
        validate_guardrail_agent_ids(
            input_agent_id=input_agent_id,
            output_agent_id=output_agent_id,
            journey_agent_ids={input_agent_id, output_agent_id},
            pattern_agent_ids=set(),
        )
        == []
    )


def test_guardrail_agents_must_exist_be_distinct_and_stay_outside_pattern() -> None:
    agent_id = uuid4()
    assert validate_guardrail_agent_ids(
        input_agent_id=agent_id,
        output_agent_id=agent_id,
        journey_agent_ids=set(),
        pattern_agent_ids={agent_id},
    ) == [
        GuardrailStateIssue.ACTIVE_AGENT_MISSING,
        GuardrailStateIssue.AGENT_REUSED,
        GuardrailStateIssue.PATTERN_AGENT_REUSED,
    ]
