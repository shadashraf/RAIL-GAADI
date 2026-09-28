from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base

if TYPE_CHECKING:
    from backend.models.train_station import TrainStation


class OccupancyEvent(Base):
    __tablename__ = "occupancy_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    train_station_id: Mapped[int] = mapped_column(ForeignKey("train_stations.id"), nullable=False)
    section_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    occupancy_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    route_constrained: Mapped[bool] = mapped_column(default=False, nullable=False)
    evidence_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    train_station: Mapped["TrainStation"] = relationship("TrainStation", back_populates="occupancy_events")
