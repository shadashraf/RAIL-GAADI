from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base

if TYPE_CHECKING:
    from backend.models.train import Train
    from backend.models.train_station import TrainStation


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    train_id: Mapped[int] = mapped_column(ForeignKey("trains.id"), nullable=False)
    train_station_id: Mapped[int | None] = mapped_column(ForeignKey("train_stations.id"), nullable=True)
    predicted_arrival: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    predicted_departure: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    predicted_delay_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    train: Mapped["Train"] = relationship("Train", back_populates="predictions")
    train_station: Mapped["TrainStation"] = relationship("TrainStation")
