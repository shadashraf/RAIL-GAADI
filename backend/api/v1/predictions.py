from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.dependencies import get_db
from backend.services.prediction_service import PredictionService

router = APIRouter(prefix="/predictions", tags=["predictions"])


class ETAPredictRequest(BaseModel):
    train_number: str = Field(min_length=1, max_length=32)
    current_station_code: str | None = None


@router.get("/trains/{train_number}")
def get_prediction(train_number: str, db: Session = Depends(get_db)) -> dict:
    """Return the latest ETA prediction payload for a train."""
    service = PredictionService(db)
    try:
        return service.get_prediction_for_train(train_number)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/predict-eta")
def predict_eta(request: ETAPredictRequest, db: Session = Depends(get_db)) -> dict:
    """Run the persisted ETA model for the train's latest known route state."""
    service = PredictionService(db)
    try:
        result = service.get_prediction_for_train(request.train_number.strip())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    result["requested_current_station_code"] = request.current_station_code
    return result


@router.get("/trains/{train_number}/forecast")
def get_prediction_forecast(train_number: str, db: Session = Depends(get_db)) -> dict:
    """Return a station-by-station forecast for the remainder of the route."""
    service = PredictionService(db)
    try:
        return service.get_eta_forecast(train_number)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/summary")
def get_prediction_summary(db: Session = Depends(get_db)) -> dict:
    """Return a summary of all active train predictions."""
    from backend.models.train import Train

    records = db.query(Train).filter(Train.is_active.is_(True)).limit(20).all()
    service = PredictionService(db)
    result = []
    for train in records:
        try:
            record = service.get_prediction_for_train(train.train_number)
        except ValueError:
            continue
        result.append(record)
    return {"status": "ok", "trains": result}
