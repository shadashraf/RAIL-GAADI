from __future__ import annotations

from sqlalchemy.orm import Session, selectinload

from backend.models.train import Train
from backend.models.train_station import TrainStation


class TrainRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_number(self, train_number: str) -> Train | None:
        return (
            self.db.query(Train)
            .options(
                selectinload(Train.stations).selectinload(TrainStation.station),
                selectinload(Train.route_segments),
                selectinload(Train.live_positions),
                selectinload(Train.delay_events),
            )
            .filter(Train.train_number == train_number)
            .first()
        )

    def list_active(self, limit: int = 50) -> list[Train]:
        return self.db.query(Train).filter(Train.is_active.is_(True)).limit(limit).all()

    def create(self, train: Train) -> Train:
        self.db.add(train)
        self.db.commit()
        self.db.refresh(train)
        return train
