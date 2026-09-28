from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.base import Base

if TYPE_CHECKING:
    pass


class DelayEvidence(Base):
    __tablename__ = "delay_evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    reason_type: Mapped[str] = mapped_column(String(80), nullable=False)
    train_number: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    station_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    evidence_key: Mapped[str] = mapped_column(String(120), nullable=False)
    evidence_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    threshold_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    evidence_detail: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
