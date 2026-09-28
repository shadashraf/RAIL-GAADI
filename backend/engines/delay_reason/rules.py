from __future__ import annotations

from backend.engines.delay_reason.types import DelayReasonType


def late_incoming_departure(previous_departure_delay_minutes: float | None, fresh_delay_minutes: float | None, threshold_minutes: float = 5.0) -> bool:
    if previous_departure_delay_minutes is None or fresh_delay_minutes is None:
        return False
    return previous_departure_delay_minutes >= threshold_minutes and fresh_delay_minutes < threshold_minutes


def high_priority_train(excess_halt_minutes: float | None, higher_priority_train_present: bool, timing_overlap: bool, threshold_minutes: float = 5.0) -> bool:
    if excess_halt_minutes is None:
        return False
    return excess_halt_minutes >= threshold_minutes and higher_priority_train_present and timing_overlap


def platform_occupied(platform_unavailable_minutes: float | None, actual_occupancy_evidence: bool, threshold_minutes: float = 5.0) -> bool:
    if platform_unavailable_minutes is None:
        return False
    return platform_unavailable_minutes >= threshold_minutes and actual_occupancy_evidence


def congestion_delay(fresh_delay_minutes: float | None, segment_delay_hits: int = 0, speed_kmph: float | None = None, threshold_minutes: float = 5.0) -> bool:
    if fresh_delay_minutes is None:
        return False
    if segment_delay_hits >= 2:
        return True
    if speed_kmph is not None and fresh_delay_minutes >= 10 and speed_kmph < 15:
        return True
    return fresh_delay_minutes >= threshold_minutes and segment_delay_hits >= 1


def unexpected_halt_delay(excess_halt_minutes: float | None, threshold_minutes: float = 5.0) -> bool:
    if excess_halt_minutes is None:
        return False
    return excess_halt_minutes >= threshold_minutes


RULES = {
    DelayReasonType.LATE_INCOMING_DEPARTURE: late_incoming_departure,
    DelayReasonType.HIGH_PRIORITY_TRAIN: high_priority_train,
    DelayReasonType.PLATFORM_OCCUPIED: platform_occupied,
    DelayReasonType.CONGESTION_DELAY: congestion_delay,
    DelayReasonType.UNEXPECTED_HALT_DELAY: unexpected_halt_delay,
}
