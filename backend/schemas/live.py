from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from backend.schemas.common import BaseSchema


class LivePositionRead(BaseSchema):
    id: int
    train_id: int
    latitude: float | None = None
    longitude: float | None = None
    current_speed_kmph: float | None = None
    distance_from_source_km: float | None = None
    current_station_code: str | None = None
    previous_station_code: str | None = None
    next_station_code: str | None = None
    source: str | None = None
    updated_at: datetime
