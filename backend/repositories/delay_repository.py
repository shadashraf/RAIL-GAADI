from __future__ import annotations

from sqlalchemy.orm import Session

from backend.models.delay_event import DelayEvent


class DelayRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_latest_for_train(self, train_id: int) -> DelayEvent | None:
        return (
            self.db.query(DelayEvent)
            .filter(DelayEvent.train_id == train_id)
            .order_by(DelayEvent.event_time.desc())
            .first()
        )

    def list_for_train(self, train_id: int, limit: int = 20) -> list[DelayEvent]:
        return (
            self.db.query(DelayEvent)
            .filter(DelayEvent.train_id == train_id)
            .order_by(DelayEvent.event_time.desc())
            .limit(limit)
            .all()
        )

    def create(self, delay_event: DelayEvent) -> DelayEvent:
        self.db.add(delay_event)
        self.db.commit()
        self.db.refresh(delay_event)
        return delay_event
