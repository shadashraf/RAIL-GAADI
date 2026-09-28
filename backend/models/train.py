from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base

if TYPE_CHECKING:
    from backend.models.delay_event import DelayEvent
    from backend.models.live_position import LivePosition
    from backend.models.prediction import Prediction
    from backend.models.route_segment import RouteSegment
    from backend.models.station_event import StationEvent
    from backend.models.train_station import TrainStation


class Train(Base):
    __tablename__ = "trains"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    train_number: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    train_type: Mapped[str] = mapped_column(String(80), nullable=False, default="passenger")
    category: Mapped[str] = mapped_column(String(80), nullable=True)
    source_station: Mapped[str] = mapped_column(String(80), nullable=False)
    destination_station: Mapped[str] = mapped_column(String(80), nullable=False)
    route_length_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    schedule_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    stations: Mapped[list["TrainStation"]] = relationship(
        "TrainStation",
        back_populates="train",
        cascade="all, delete-orphan",
    )
    route_segments: Mapped[list["RouteSegment"]] = relationship(
        "RouteSegment",
        back_populates="train",
        cascade="all, delete-orphan",
    )
    live_positions: Mapped[list["LivePosition"]] = relationship(
        "LivePosition",
        back_populates="train",
        cascade="all, delete-orphan",
    )
    station_events: Mapped[list["StationEvent"]] = relationship(
        "StationEvent",
        back_populates="train",
        cascade="all, delete-orphan",
    )
    delay_events: Mapped[list["DelayEvent"]] = relationship(
        "DelayEvent",
        back_populates="train",
        cascade="all, delete-orphan",
    )
    predictions: Mapped[list["Prediction"]] = relationship(
        "Prediction",
        back_populates="train",
        cascade="all, delete-orphan",
    )
