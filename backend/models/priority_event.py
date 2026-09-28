from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base

if TYPE_CHECKING:
    from backend.models.train_station import TrainStation


class PriorityEvent(Base):
    __tablename__ = "priority_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    train_station_id: Mapped[int] = mapped_column(ForeignKey("train_stations.id"), nullable=False)
    higher_priority_train_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    overlap_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    wait_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    evidence_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    train_station: Mapped["TrainStation"] = relationship("TrainStation", back_populates="priority_events")
