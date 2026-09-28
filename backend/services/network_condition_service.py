from __future__ import annotations

from sqlalchemy.orm import Session

from backend.repositories.train_repository import TrainRepository
from backend.services.data_provider import LocalRouteDataProvider


class NetworkConditionService:
    def __init__(self, db: Session):
        self.db = db
        self.train_repository = TrainRepository(db)
        self.provider = LocalRouteDataProvider()

    def get_train_network_conditions(self, train_number: str) -> dict:
        train = self.train_repository.get_by_number(train_number)
        if train is None:
            raise ValueError(f"Train {train_number} not found")

        latest_delay = max(train.delay_events, key=lambda item: item.event_time, default=None) if train.delay_events else None
        latest_live = max(train.live_positions, key=lambda item: item.updated_at, default=None) if train.live_positions else None
        signal = self.provider.get_network_status(train)
        weather = self.provider.get_weather_status(train)

        current_speed = getattr(latest_live, "current_speed_kmph", None)
        delay_minutes = float(latest_delay.delay_minutes or 0.0) if latest_delay is not None else 0.0
        if current_speed is None:
            current_speed = signal.get("speed_kmph") or 0.0

        section_length = max(len(train.stations), 1)
        route_density = {
            "low": section_length <= 10,
            "medium": 11 <= section_length <= 25,
            "high": section_length > 25,
        }
        bottleneck = "no active bottleneck reported" if delay_minutes < 10 else "sectional delay pattern" if delay_minutes < 25 else "persistent congestion pattern"

        return {
            "train_number": train.train_number,
            "train_name": train.name,
            "signal_status": signal.get("status", "normal"),
            "speed_kmph": float(current_speed) if current_speed is not None else None,
            "delay_minutes": delay_minutes,
            "congestion_level": "low" if delay_minutes < 10 else "moderate" if delay_minutes < 25 else "high",
            "bottleneck": bottleneck,
            "route_density": next(key for key, value in route_density.items() if value),
            "weather": weather,
            "source": "local_route_data",
        }
