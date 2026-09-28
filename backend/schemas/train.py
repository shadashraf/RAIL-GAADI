from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from backend.schemas.common import BaseSchema


class TrainCreate(BaseSchema):
    train_number: str
    name: str
    train_type: str = "passenger"
    category: str | None = None
    source_station: str
    destination_station: str
    route_length_km: float | None = None
    schedule_duration_minutes: int | None = None


class TrainRead(BaseSchema):
    id: int
    train_number: str
    name: str
    train_type: str
    category: str | None = None
    source_station: str
    destination_station: str
    route_length_km: float | None = None
    schedule_duration_minutes: int | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
