from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from backend.schemas.common import BaseSchema


class DelayEventRead(BaseSchema):
    id: int
    train_id: int
    train_station_id: int | None = None
    delay_minutes: float
    fresh_delay_minutes: float | None = None
    cumulative_delay_minutes: float | None = None
    reason_code: str | None = None
    reason_label: str | None = None
    event_time: datetime
    created_at: datetime


class DelayReasonRead(BaseSchema):
    reason_code: str
    reason_label: str
    confidence_score: float | None = None
    confidence_level: str | None = None
    evidence_summary: str | None = None
