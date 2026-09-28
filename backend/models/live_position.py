from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base

if TYPE_CHECKING:
    from backend.models.train import Train


class LivePosition(Base):
    __tablename__ = "live_positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    train_id: Mapped[int] = mapped_column(ForeignKey("trains.id"), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_speed_kmph: Mapped[float | None] = mapped_column(Float, nullable=True)
    distance_from_source_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_station_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    previous_station_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    next_station_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    source: Mapped[str | None] = mapped_column(String(80), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    train: Mapped["Train"] = relationship("Train", back_populates="live_positions")
