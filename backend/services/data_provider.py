from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class DataProvider(ABC):
    """Common contract for upstream railway and operational data sources."""

    @abstractmethod
    def get_weather_status(self, train: Any) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def get_network_status(self, train: Any) -> dict[str, Any]:
        raise NotImplementedError


class LocalRouteDataProvider(DataProvider):
    """Provider backed by the seeded route and live-store data already present in the project."""

    def get_weather_status(self, train: Any) -> dict[str, Any]:
        return {
            "status": "unavailable",
            "source": "local_db",
            "message": "No weather feed is configured for this installation.",
        }

    def get_network_status(self, train: Any) -> dict[str, Any]:
        latest_live = max(train.live_positions, key=lambda item: item.updated_at, default=None) if getattr(train, "live_positions", None) else None
        delay_minutes = 0.0
        if getattr(train, "delay_events", None):
            latest_delay = max(train.delay_events, key=lambda item: item.event_time, default=None)
            delay_minutes = float(latest_delay.delay_minutes or 0.0) if latest_delay is not None else 0.0
        current_speed = getattr(latest_live, "current_speed_kmph", None)
        if current_speed is None:
            current_speed = 0.0
        if delay_minutes >= 20 or current_speed < 25:
            signal_state = "restricted"
        elif delay_minutes >= 8 or current_speed < 45:
            signal_state = "watch"
        else:
            signal_state = "normal"

        return {
            "status": signal_state,
            "speed_kmph": current_speed,
            "delay_minutes": delay_minutes,
            "source": "local_db",
        }
