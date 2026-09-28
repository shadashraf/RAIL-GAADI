from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.dependencies import get_db
from backend.repositories.train_repository import TrainRepository
from backend.services.delay_service import DelayService
from backend.services.prediction_service import PredictionService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def get_analytics_summary(db: Session = Depends(get_db)) -> dict:
    """Return a compact operations summary for the active rail network."""
    train_repository = TrainRepository(db)
    trains = train_repository.list_active(limit=50)
    metrics = []
    for train in trains:
        delay_service = DelayService(db)
        try:
            summary = delay_service.get_delay_summary(train.train_number)
        except ValueError:
            summary = {"latest_delay_minutes": 0, "reason": "No live data"}
        metrics.append({
            "train_number": train.train_number,
            "train_name": train.name,
            "delay_minutes": summary.get("latest_delay_minutes", 0),
            "reason": summary.get("reason", "No live data"),
            "source": train.source_station,
            "destination": train.destination_station,
        })
    return {
        "status": "ok",
        "active_trains": len(metrics),
        "total_delay_minutes": sum(item["delay_minutes"] for item in metrics),
        "trains": metrics,
    }


@router.get("/trains/{train_number}")
def get_train_analytics(train_number: str, db: Session = Depends(get_db)) -> dict:
    """Return the delay, confidence, ETA, and network insight for a train."""
    train_repository = TrainRepository(db)
    train = train_repository.get_by_number(train_number)
    if train is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Train {train_number} not found")

    delay_service = DelayService(db)
    prediction_service = PredictionService(db)

    try:
        delay_summary = delay_service.get_delay_summary(train_number)
    except ValueError:
        delay_summary = {"latest_delay_minutes": 0, "reason": "No live data"}

    forecast = prediction_service.get_eta_forecast(train_number)
    return {
        "train_number": train.train_number,
        "train_name": train.name,
        "delay": delay_summary,
        "forecast": forecast,
    }


@router.get("/corridors")
def get_corridor_summary(db: Session = Depends(get_db)) -> dict:
    """Group active train records into data-backed operating corridors."""
    train_repository = TrainRepository(db)
    grouped: dict[tuple[str, str], dict] = {}
    for train in train_repository.list_active(limit=50):
        key = (train.source_station, train.destination_station)
        bucket = grouped.setdefault(key, {
            "origin": train.source_station,
            "destination": train.destination_station,
            "train_numbers": [],
            "train_count": 0,
            "stations_covered": 0,
            "delay_minutes": [],
        })
        bucket["train_numbers"].append(train.train_number)
        bucket["train_count"] += 1
        bucket["stations_covered"] = max(bucket["stations_covered"], len(train.stations))
        latest = max(train.delay_events, key=lambda item: item.event_time, default=None)
        bucket["delay_minutes"].append(float(latest.delay_minutes or 0) if latest else 0.0)

    corridors = []
    for bucket in grouped.values():
        average_delay = sum(bucket["delay_minutes"]) / max(bucket["train_count"], 1)
        corridors.append({
            "origin": bucket["origin"],
            "destination": bucket["destination"],
            "train_numbers": bucket["train_numbers"],
            "train_count": bucket["train_count"],
            "stations_covered": bucket["stations_covered"],
            "average_delay_minutes": round(average_delay, 1),
            "status": "Delayed" if average_delay > 15 else "Watch" if average_delay > 5 else "Healthy",
            "density": "High" if bucket["stations_covered"] > 25 else "Medium" if bucket["stations_covered"] > 10 else "Low",
        })
    return {"status": "ok", "corridors": sorted(corridors, key=lambda item: item["average_delay_minutes"], reverse=True)}
