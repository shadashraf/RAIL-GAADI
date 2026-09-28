from __future__ import annotations

from backend.engines.delay_reason.confidence import score_confidence
from backend.engines.delay_reason.evidence import EvidenceBundle
from backend.engines.delay_reason.rules import (
    congestion_delay,
    high_priority_train,
    late_incoming_departure,
    platform_occupied,
    unexpected_halt_delay,
)
from backend.engines.delay_reason.types import ConfidenceLevel, DelayReasonType


class DelayReasonEngine:
    def classify(
        self,
        *,
        previous_departure_delay_minutes: float | None = None,
        fresh_delay_minutes: float | None = None,
        excess_halt_minutes: float | None = None,
        higher_priority_train_present: bool = False,
        timing_overlap: bool = False,
        platform_unavailable_minutes: float | None = None,
        actual_occupancy_evidence: bool = False,
        segment_delay_hits: int = 0,
        speed_kmph: float | None = None,
    ) -> tuple[DelayReasonType, ConfidenceLevel, float, EvidenceBundle]:
        evidence = EvidenceBundle()

        if late_incoming_departure(previous_departure_delay_minutes, fresh_delay_minutes):
            evidence.add("previous_departure_delay_minutes", previous_departure_delay_minutes, 5.0, "Late incoming/departure carried forward")
            evidence.add("fresh_delay_minutes", fresh_delay_minutes, 5.0, "Fresh delay stayed below the threshold")
            reason = DelayReasonType.LATE_INCOMING_DEPARTURE
        elif high_priority_train(excess_halt_minutes, higher_priority_train_present, timing_overlap):
            evidence.add("excess_halt_minutes", excess_halt_minutes, 5.0, "Excess halt indicates precedence wait")
            evidence.add("higher_priority_train_present", higher_priority_train_present, None, "Higher-priority train was present")
            evidence.add("timing_overlap", timing_overlap, None, "Timing overlap confirmed")
            reason = DelayReasonType.HIGH_PRIORITY_TRAIN
        elif platform_occupied(platform_unavailable_minutes, actual_occupancy_evidence):
            evidence.add("platform_unavailable_minutes", platform_unavailable_minutes, 5.0, "Platform was unavailable for a sustained period")
            evidence.add("actual_occupancy_evidence", actual_occupancy_evidence, None, "Occupancy evidence exists")
            reason = DelayReasonType.PLATFORM_OCCUPIED
        elif congestion_delay(fresh_delay_minutes, segment_delay_hits=segment_delay_hits, speed_kmph=speed_kmph):
            evidence.add("fresh_delay_minutes", fresh_delay_minutes, 5.0, "Repeated or sustained fresh delays suggest congestion")
            evidence.add("segment_delay_hits", segment_delay_hits, None, "Multiple segments show delay")
            evidence.add("speed_kmph", speed_kmph, 15.0, "Speed remained low enough to indicate congestion")
            reason = DelayReasonType.CONGESTION_DELAY
        elif unexpected_halt_delay(excess_halt_minutes):
            evidence.add("excess_halt_minutes", excess_halt_minutes, 5.0, "Unexpected halt exceeds threshold when stronger evidence was not available")
            reason = DelayReasonType.UNEXPECTED_HALT_DELAY
        else:
            evidence.add("fallback", True, None, "Not enough evidence to support a stronger reason")
            reason = DelayReasonType.INSUFFICIENT_EVIDENCE

        level, score = score_confidence(len(evidence.signals), rule_strength=1.0 if reason != DelayReasonType.INSUFFICIENT_EVIDENCE else 0.3)
        return reason, level, score, evidence
