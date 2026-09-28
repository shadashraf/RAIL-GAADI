from __future__ import annotations

from sqlalchemy.orm import Session

from backend.models.station import Station


class StationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_code(self, code: str) -> Station | None:
        return self.db.query(Station).filter(Station.code == code).first()

    def get_many_by_codes(self, codes: list[str]) -> list[Station]:
        if not codes:
            return []
        return self.db.query(Station).filter(Station.code.in_(codes)).all()

    def create(self, station: Station) -> Station:
        self.db.add(station)
        self.db.commit()
        self.db.refresh(station)
        return station
