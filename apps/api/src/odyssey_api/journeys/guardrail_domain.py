from enum import StrEnum
from uuid import UUID


class GuardrailSide(StrEnum):
    INPUT = "input"
    OUTPUT = "output"


class GuardrailStateIssue(StrEnum):
    ACTIVE_AGENT_MISSING = "ACTIVE_AGENT_MISSING"
    AGENT_REUSED = "AGENT_REUSED"
    PATTERN_AGENT_REUSED = "PATTERN_AGENT_REUSED"


def validate_guardrail_agent_ids(
    *,
    input_agent_id: UUID | None,
    output_agent_id: UUID | None,
    journey_agent_ids: set[UUID],
    pattern_agent_ids: set[UUID],
) -> list[GuardrailStateIssue]:
    issues: list[GuardrailStateIssue] = []
    active_ids = [
        agent_id for agent_id in (input_agent_id, output_agent_id) if agent_id is not None
    ]
    if any(agent_id not in journey_agent_ids for agent_id in active_ids):
        issues.append(GuardrailStateIssue.ACTIVE_AGENT_MISSING)
    if len(active_ids) != len(set(active_ids)):
        issues.append(GuardrailStateIssue.AGENT_REUSED)
    if any(agent_id in pattern_agent_ids for agent_id in active_ids):
        issues.append(GuardrailStateIssue.PATTERN_AGENT_REUSED)
    return issues
