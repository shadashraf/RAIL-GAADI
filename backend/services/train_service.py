from __future__ import annotations

from sqlalchemy.orm import Session

from backend.engines.delay_reason.attribution import calculate_fresh_delay
from backend.engines.delay_reason.engine import DelayReasonEngine
from backend.repositories.delay_repository import DelayRepository
from backend.repositories.train_repository import TrainRepository


class TrainService:
    def __init__(self, db: Session):
        self.db = db
        self.train_repository = TrainRepository(db)
        self.delay_repository = DelayRepository(db)
        self.delay_reason_engine = DelayReasonEngine()

    def get_train_overview(self, train_number: str) -> dict:
        train = self.train_repository.get_by_number(train_number)
        if train is None:
            raise ValueError(f"Train {train_number} not found")

        latest_delay = self.delay_repository.get_latest_for_train(train.id)

        fresh_delay = None
        if latest_delay is not None:
            fresh_delay = calculate_fresh_delay(
                latest_delay.delay_minutes,
                latest_delay.cumulative_delay_minutes,
            )

        reason, confidence_level, confidence_score, evidence = self.delay_reason_engine.classify(
            previous_departure_delay_minutes=latest_delay.cumulative_delay_minutes if latest_delay is not None else None,
            fresh_delay_minutes=fresh_delay,
            excess_halt_minutes=latest_delay.delay_minutes if latest_delay is not None else None,
            higher_priority_train_present=False,
            timing_overlap=False,
            platform_unavailable_minutes=None,
            actual_occupancy_evidence=False,
            segment_delay_hits=1,
            speed_kmph=None,
        )

        return {
            "train_number": train.train_number,
            "train_name": train.name,
            "source": train.source_station,
            "destination": train.destination_station,
            "is_active": train.is_active,
            "latest_delay_minutes": latest_delay.delay_minutes if latest_delay is not None else 0,
            "fresh_delay_minutes": fresh_delay,
            "reason": reason.value,
            "confidence_level": confidence_level.value,
            "confidence_score": confidence_score,
            "evidence_summary": evidence.summary(),
        }
