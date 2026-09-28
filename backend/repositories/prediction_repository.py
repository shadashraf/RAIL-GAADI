from __future__ import annotations

from sqlalchemy.orm import Session

from backend.models.prediction import Prediction


class PredictionRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_latest_for_train(self, train_id: int) -> Prediction | None:
        return (
            self.db.query(Prediction)
            .filter(Prediction.train_id == train_id)
            .order_by(Prediction.created_at.desc())
            .first()
        )

    def list_for_train(self, train_id: int, limit: int = 10) -> list[Prediction]:
        return (
            self.db.query(Prediction)
            .filter(Prediction.train_id == train_id)
            .order_by(Prediction.created_at.desc())
            .limit(limit)
            .all()
        )

    def create(self, prediction: Prediction) -> Prediction:
        self.db.add(prediction)
        self.db.commit()
        self.db.refresh(prediction)
        return prediction
