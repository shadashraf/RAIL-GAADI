from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class BaseSchema(BaseModel):
    class Config:
        from_attributes = True


class TimestampedSchema(BaseSchema):
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ErrorResponse(BaseSchema):
    detail: str
    error_code: str | None = None
    metadata: dict[str, Any] | None = None
