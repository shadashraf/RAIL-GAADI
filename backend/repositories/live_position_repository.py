from __future__ import annotations

from sqlalchemy.orm import Session

from backend.models.live_position import LivePosition


class LivePositionRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_latest_by_train(self, train_id: int) -> LivePosition | None:
        return (
            self.db.query(LivePosition)
            .filter(LivePosition.train_id == train_id)
            .order_by(LivePosition.updated_at.desc())
            .first()
        )

    def get_all_by_train(self, train_id: int) -> list[LivePosition]:
        return self.db.query(LivePosition).filter(LivePosition.train_id == train_id).order_by(LivePosition.updated_at.desc()).all()

    def create(self, live_position: LivePosition) -> LivePosition:
        self.db.add(live_position)
        self.db.commit()
        self.db.refresh(live_position)
        return live_position
