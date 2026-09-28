from __future__ import annotations

from sqlalchemy.orm import Session

from backend.repositories.live_position_repository import LivePositionRepository
from backend.repositories.train_repository import TrainRepository


class LiveService:
    def __init__(self, db: Session):
        self.db = db
        self.train_repository = TrainRepository(db)
        self.live_position_repository = LivePositionRepository(db)

    def get_live_train(self, train_number: str) -> dict:
        train = self.train_repository.get_by_number(train_number)
        if train is None:
            raise ValueError(f"Train {train_number} not found")

        live_position = self.live_position_repository.get_latest_by_train(train.id)
        if live_position is None:
            return {
                "train_number": train.train_number,
                "status": "no_live_position",
                "message": "Live position not available yet.",
            }

        return {
            "train_number": train.train_number,
            "train_name": train.name,
            "current_station_code": live_position.current_station_code,
            "previous_station_code": live_position.previous_station_code,
            "next_station_code": live_position.next_station_code,
            "current_speed_kmph": live_position.current_speed_kmph,
            "latitude": live_position.latitude,
            "longitude": live_position.longitude,
            "updated_at": live_position.updated_at,
        }
