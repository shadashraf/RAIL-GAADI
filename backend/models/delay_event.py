from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base

if TYPE_CHECKING:
    from backend.models.train import Train
    from backend.models.train_station import TrainStation


class DelayEvent(Base):
    __tablename__ = "delay_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    train_id: Mapped[int] = mapped_column(ForeignKey("trains.id"), nullable=False)
    train_station_id: Mapped[int | None] = mapped_column(ForeignKey("train_stations.id"), nullable=True)
    delay_minutes: Mapped[float] = mapped_column(Float, nullable=False)
    fresh_delay_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    cumulative_delay_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    reason_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    reason_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    event_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    train: Mapped["Train"] = relationship("Train", back_populates="delay_events")
    train_station: Mapped["TrainStation"] = relationship("TrainStation", back_populates="delay_events")
