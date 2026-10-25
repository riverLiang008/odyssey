import pytest

from odyssey_api.errors import ApplicationError, ErrorCode
from odyssey_api.journeys.dto import ReusableKnowledgeConfiguration
from odyssey_api.journeys.router import parse_revision_etag


def test_if_match_accepts_only_quoted_positive_revision() -> None:
    assert parse_revision_etag('"12"') == 12


@pytest.mark.parametrize("value", ["12", 'W/"12"', '"0"', '"-1"', '"1","2"', ""])
def test_if_match_rejects_ambiguous_or_weak_values(value: str) -> None:
    with pytest.raises(ApplicationError) as raised:
        parse_revision_etag(value)
    assert raised.value.code is ErrorCode.VALIDATION_FAILED


def test_reusable_knowledge_response_omits_unset_optional_fields() -> None:
    configuration = ReusableKnowledgeConfiguration.model_validate(
        {
            "knowledgeSpaceId": "00000000-0000-4000-8000-000000000100",
            "query": None,
            "topK": None,
        }
    )

    assert configuration.model_dump(mode="json", by_alias=True) == {
        "knowledgeSpaceId": "00000000-0000-4000-8000-000000000100"
    }
