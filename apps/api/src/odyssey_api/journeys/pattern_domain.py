from collections.abc import Callable, Sequence
from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

from odyssey_api.journeys.dto import (
    JourneyEndRouteTarget,
    PatternConfig,
    PatternKind,
    PatternRoute,
    PatternSlot,
    SlotRouteTarget,
)


class PatternIssueCode(StrEnum):
    PATTERN_KIND_MISMATCH = "PATTERN_KIND_MISMATCH"
    SLOT_CARDINALITY_INVALID = "SLOT_CARDINALITY_INVALID"
    TOPOLOGY_ROLE_INVALID = "TOPOLOGY_ROLE_INVALID"
    SLOT_ORDER_INVALID = "SLOT_ORDER_INVALID"
    OWNED_ID_COLLISION = "OWNED_ID_COLLISION"
    AGENT_ASSIGNED_MORE_THAN_ONCE = "AGENT_ASSIGNED_MORE_THAN_ONCE"
    ROUTE_TOPOLOGY_INVALID = "ROUTE_TOPOLOGY_INVALID"


@dataclass(frozen=True, slots=True)
class PatternIssue:
    code: PatternIssueCode


PATTERN_NAMES: dict[PatternKind, str] = {
    PatternKind.SOLO_COMPONENT: "Solo Component",
    PatternKind.LINEAR_SEQUENCE: "Linear Sequence",
    PatternKind.HUB_AND_SPOKE: "Hub and Spoke",
    PatternKind.DIAMOND_LOOP: "Circular Loop",
}


def _slot(
    id_factory: Callable[[], UUID],
    label: str,
    role: str | None,
    order: int | None,
) -> PatternSlot:
    return PatternSlot(
        id=id_factory(),
        topology_role=role,
        label=label,
        order=order,
        agent_id=None,
        configuration={},
    )


def _initial_slots(kind: PatternKind, id_factory: Callable[[], UUID]) -> list[PatternSlot]:
    if kind is PatternKind.SOLO_COMPONENT:
        return [_slot(id_factory, "Agent-1", "solo", None)]
    if kind is PatternKind.LINEAR_SEQUENCE:
        return [_slot(id_factory, f"Agent-{index + 1}", None, index) for index in range(4)]
    if kind is PatternKind.HUB_AND_SPOKE:
        return [
            _slot(id_factory, "Agent-1", "hub", None),
            *[_slot(id_factory, f"Agent-{index + 2}", "spoke", None) for index in range(4)],
        ]
    return [
        _slot(id_factory, "Agent-1", "entry", 0),
        *[_slot(id_factory, f"Agent-{index + 2}", "loop", index + 1) for index in range(3)],
    ]


def _route_targets(
    kind: PatternKind, slots: Sequence[PatternSlot]
) -> list[tuple[UUID, UUID | None]]:
    if kind is PatternKind.SOLO_COMPONENT:
        return []
    if kind is PatternKind.LINEAR_SEQUENCE:
        ordered = sorted(slots, key=lambda slot: slot.order if slot.order is not None else -1)
        return [
            (slot.id, ordered[index + 1].id if index + 1 < len(ordered) else None)
            for index, slot in enumerate(ordered)
        ]
    if kind is PatternKind.HUB_AND_SPOKE:
        hub = next((slot for slot in slots if slot.topology_role == "hub"), None)
        if hub is None:
            return []
        targets: list[tuple[UUID, UUID | None]] = []
        for slot in slots:
            if slot.topology_role != "spoke":
                continue
            direction = slot.configuration.get("direction", "hub_to_spoke")
            if direction != "spoke_to_hub":
                targets.append((hub.id, slot.id))
            if direction != "hub_to_spoke":
                targets.append((slot.id, hub.id))
        return targets
    ordered = sorted(slots, key=lambda slot: slot.order if slot.order is not None else -1)
    entry_index = next(
        (index for index, slot in enumerate(ordered) if slot.topology_role == "entry"), -1
    )
    if entry_index < 0:
        return []
    cycle = [*ordered[entry_index:], *ordered[:entry_index]]
    return [(slot.id, cycle[(index + 1) % len(cycle)].id) for index, slot in enumerate(cycle)]


def _derive_routes(
    kind: PatternKind,
    slots: Sequence[PatternSlot],
    id_factory: Callable[[], UUID],
    existing: Sequence[PatternRoute] = (),
) -> list[PatternRoute]:
    previous = {
        (
            route.source_slot_id,
            route.target.slot_id if isinstance(route.target, SlotRouteTarget) else None,
        ): route.id
        for route in existing
    }
    return [
        PatternRoute(
            id=previous.get((source_id, target_id)) or id_factory(),
            source_slot_id=source_id,
            target=(
                JourneyEndRouteTarget(type="journey_end")
                if target_id is None
                else SlotRouteTarget(type="slot", slot_id=target_id)
            ),
        )
        for source_id, target_id in _route_targets(kind, slots)
    ]


def instantiate_pattern(
    kind: PatternKind,
    id_factory: Callable[[], UUID],
) -> PatternConfig:
    slots = _initial_slots(kind, id_factory)
    return PatternConfig(
        schema_version="1.0.0",
        id=id_factory(),
        template_key=kind,
        kind=kind,
        name=PATTERN_NAMES[kind],
        slots=slots,
        routes=_derive_routes(kind, slots, id_factory),
        configuration={},
    )


def remove_slot(
    pattern: PatternConfig, slot_id: UUID, id_factory: Callable[[], UUID]
) -> PatternConfig:
    slots = [slot.model_copy(deep=True) for slot in pattern.slots if slot.id != slot_id]
    if pattern.kind in (PatternKind.LINEAR_SEQUENCE, PatternKind.DIAMOND_LOOP):
        slots.sort(key=lambda slot: slot.order if slot.order is not None else -1)
    if (
        pattern.kind is PatternKind.DIAMOND_LOOP
        and slots
        and not any(slot.topology_role == "entry" for slot in slots)
    ):
        removed = next(slot for slot in pattern.slots if slot.id == slot_id)
        successor = next(
            (slot for slot in slots if (slot.order or 0) > (removed.order or 0)), slots[0]
        )
        successor.topology_role = "entry"
    for index, slot in enumerate(slots):
        if slot.order is not None:
            slot.order = index
    return pattern.model_copy(
        update={
            "slots": slots,
            "routes": _derive_routes(pattern.kind, slots, id_factory, pattern.routes),
        }
    )


def validate_pattern(pattern: PatternConfig) -> list[PatternIssue]:
    issues: list[PatternIssue] = []
    if pattern.template_key is not pattern.kind:
        issues.append(PatternIssue(PatternIssueCode.PATTERN_KIND_MISMATCH))
    roles = [slot.topology_role for slot in pattern.slots]
    orders = sorted(slot.order for slot in pattern.slots if slot.order is not None)
    if pattern.kind is PatternKind.SOLO_COMPONENT:
        if len(pattern.slots) != 1:
            issues.append(PatternIssue(PatternIssueCode.SLOT_CARDINALITY_INVALID))
        if roles != ["solo"]:
            issues.append(PatternIssue(PatternIssueCode.TOPOLOGY_ROLE_INVALID))
        if orders:
            issues.append(PatternIssue(PatternIssueCode.SLOT_ORDER_INVALID))
    elif pattern.kind is PatternKind.LINEAR_SEQUENCE:
        if not pattern.slots:
            issues.append(PatternIssue(PatternIssueCode.SLOT_CARDINALITY_INVALID))
        if any(role is not None for role in roles):
            issues.append(PatternIssue(PatternIssueCode.TOPOLOGY_ROLE_INVALID))
        if orders != list(range(len(pattern.slots))):
            issues.append(PatternIssue(PatternIssueCode.SLOT_ORDER_INVALID))
    elif pattern.kind is PatternKind.HUB_AND_SPOKE:
        if len(pattern.slots) < 2:
            issues.append(PatternIssue(PatternIssueCode.SLOT_CARDINALITY_INVALID))
        if roles.count("hub") != 1 or roles.count("spoke") != len(pattern.slots) - 1:
            issues.append(PatternIssue(PatternIssueCode.TOPOLOGY_ROLE_INVALID))
        if orders:
            issues.append(PatternIssue(PatternIssueCode.SLOT_ORDER_INVALID))
    else:
        if len(pattern.slots) < 2:
            issues.append(PatternIssue(PatternIssueCode.SLOT_CARDINALITY_INVALID))
        if roles.count("entry") != 1 or roles.count("loop") != len(pattern.slots) - 1:
            issues.append(PatternIssue(PatternIssueCode.TOPOLOGY_ROLE_INVALID))
        if orders != list(range(len(pattern.slots))):
            issues.append(PatternIssue(PatternIssueCode.SLOT_ORDER_INVALID))

    owned_ids = [
        pattern.id,
        *[slot.id for slot in pattern.slots],
        *[route.id for route in pattern.routes],
    ]
    if len(set(owned_ids)) != len(owned_ids):
        issues.append(PatternIssue(PatternIssueCode.OWNED_ID_COLLISION))
    assigned = [slot.agent_id for slot in pattern.slots if slot.agent_id is not None]
    if len(set(assigned)) != len(assigned):
        issues.append(PatternIssue(PatternIssueCode.AGENT_ASSIGNED_MORE_THAN_ONCE))

    expected = sorted(
        (str(source), str(target) if target is not None else "journey_end")
        for source, target in _route_targets(pattern.kind, pattern.slots)
    )
    actual = sorted(
        (
            str(route.source_slot_id),
            str(route.target.slot_id)
            if isinstance(route.target, SlotRouteTarget)
            else "journey_end",
        )
        for route in pattern.routes
    )
    if expected != actual:
        issues.append(PatternIssue(PatternIssueCode.ROUTE_TOPOLOGY_INVALID))
    return issues
