from __future__ import annotations

from sqlalchemy.orm import Session

from backend.engines.delay_reason.engine import DelayReasonEngine
from backend.repositories.delay_repository import DelayRepository
from backend.repositories.train_repository import TrainRepository


class DelayService:
    def __init__(self, db: Session):
        self.db = db
        self.train_repository = TrainRepository(db)
        self.delay_repository = DelayRepository(db)
        self.engine = DelayReasonEngine()

    def get_delay_summary(self, train_number: str) -> dict:
        train = self.train_repository.get_by_number(train_number)
        if train is None:
            raise ValueError(f"Train {train_number} not found")

        delay_events = self.delay_repository.list_for_train(train.id, limit=10)

        if not delay_events:
            return {
                "train_number": train.train_number,
                "status": "no_delay_event",
                "message": "No delay events recorded yet.",
            }

        latest = delay_events[0]
        reason, level, score, evidence = self.engine.classify(
            previous_departure_delay_minutes=latest.cumulative_delay_minutes,
            fresh_delay_minutes=latest.fresh_delay_minutes,
            excess_halt_minutes=latest.delay_minutes,
            higher_priority_train_present=False,
            timing_overlap=False,
            platform_unavailable_minutes=None,
            actual_occupancy_evidence=False,
            segment_delay_hits=1,
            speed_kmph=None,
        )

        return {
            "train_number": train.train_number,
            "latest_delay_minutes": latest.delay_minutes,
            "fresh_delay_minutes": latest.fresh_delay_minutes,
            "cumulative_delay_minutes": latest.cumulative_delay_minutes,
            "reason": reason.value,
            "confidence_level": level.value,
            "confidence_score": score,
            "evidence_summary": evidence.summary(),
        }
