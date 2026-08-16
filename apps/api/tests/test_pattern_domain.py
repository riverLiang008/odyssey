from copy import deepcopy
from uuid import UUID

import pytest

from odyssey_api.journeys.dto import PatternKind, SlotRouteTarget
from odyssey_api.journeys.pattern_domain import instantiate_pattern, validate_pattern


class SequentialIds:
    def __init__(self) -> None:
        self.value = 1

    def __call__(self) -> UUID:
        result = UUID(f"00000000-0000-4000-8000-{self.value:012d}")
        self.value += 1
        return result


@pytest.mark.parametrize("kind", list(PatternKind))
def test_all_built_in_patterns_instantiate_as_valid_canonical_config(kind: PatternKind) -> None:
    pattern = instantiate_pattern(kind, SequentialIds())
    assert validate_pattern(pattern) == []
    assert pattern.kind is kind
    assert pattern.template_key is kind


def test_circular_loop_is_a_directed_cycle_with_one_entry() -> None:
    pattern = instantiate_pattern(PatternKind.DIAMOND_LOOP, SequentialIds())
    assert [slot.topology_role for slot in pattern.slots] == ["entry", "loop", "loop", "loop"]
    assert [slot.order for slot in pattern.slots] == [0, 1, 2, 3]
    assert len(pattern.routes) == len(pattern.slots)
    last_target = pattern.routes[-1].target
    assert isinstance(last_target, SlotRouteTarget)
    assert last_target.slot_id == pattern.slots[0].id


def test_validation_does_not_mutate_input() -> None:
    pattern = instantiate_pattern(PatternKind.LINEAR_SEQUENCE, SequentialIds())
    before = deepcopy(pattern)
    validate_pattern(pattern)
    assert pattern == before
