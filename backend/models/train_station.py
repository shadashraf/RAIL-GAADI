from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base

if TYPE_CHECKING:
    from backend.models.delay_event import DelayEvent
    from backend.models.platform_event import PlatformEvent
    from backend.models.priority_event import PriorityEvent
    from backend.models.occupancy_event import OccupancyEvent
    from backend.models.station import Station
    from backend.models.train import Train


class TrainStation(Base):
    __tablename__ = "train_stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    train_id: Mapped[int] = mapped_column(ForeignKey("trains.id"), nullable=False)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), nullable=False)
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False)
    scheduled_arrival: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    scheduled_departure: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    actual_arrival: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    actual_departure: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    arrival_delay_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    departure_delay_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    platform_no: Mapped[str | None] = mapped_column(String(20), nullable=True)
    distance_from_source_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_halt: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_origin: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_destination: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    train: Mapped["Train"] = relationship("Train", back_populates="stations")
    station: Mapped["Station"] = relationship("Station", back_populates="train_links")
    delay_events: Mapped[list["DelayEvent"]] = relationship(
        "DelayEvent",
        back_populates="train_station",
        cascade="all, delete-orphan",
    )
    priority_events: Mapped[list["PriorityEvent"]] = relationship(
        "PriorityEvent",
        back_populates="train_station",
        cascade="all, delete-orphan",
    )
    platform_events: Mapped[list["PlatformEvent"]] = relationship(
        "PlatformEvent",
        back_populates="train_station",
        cascade="all, delete-orphan",
    )
    occupancy_events: Mapped[list["OccupancyEvent"]] = relationship(
        "OccupancyEvent",
        back_populates="train_station",
        cascade="all, delete-orphan",
    )
