from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base

if TYPE_CHECKING:
    from backend.models.train import Train


class RouteSegment(Base):
    __tablename__ = "route_segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    train_id: Mapped[int] = mapped_column(ForeignKey("trains.id"), nullable=False)
    from_station_code: Mapped[str] = mapped_column(String(20), nullable=False)
    to_station_code: Mapped[str] = mapped_column(String(20), nullable=False)
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    scheduled_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_speed_kmph: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    train: Mapped["Train"] = relationship("Train", back_populates="route_segments")
