from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from backend.schemas.common import BaseSchema


class PredictionRead(BaseSchema):
    id: int
    train_id: int
    predicted_arrival: datetime | None = None
    predicted_departure: datetime | None = None
    predicted_delay_minutes: float | None = None
    confidence_score: float | None = None
    model_version: str | None = None
    created_at: datetime
