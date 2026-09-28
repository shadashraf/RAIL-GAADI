import re
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.dependencies import get_db
from backend.services.seed_service import normalize_train_payload, seed_train_payload
from backend.services.live_service import LiveService
from backend.services.prediction_service import PredictionService

router = APIRouter(prefix="/live", tags=["live"])


class LiveSyncRequest(BaseModel):
    url: str = Field(min_length=8, description="JSON live train API URL")
    headers: dict[str, str] = Field(default_factory=dict)


class LivePayloadRequest(BaseModel):
    payload: dict[str, Any]


class TrainNumberSyncRequest(BaseModel):
    train_number: str = Field(min_length=1, max_length=20)


def _url_for_train(train_number: str) -> str:
    template = settings.live_api_url
    if not template:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LIVE_API_URL is not configured")
    if "{train_number}" in template:
        return template.replace("{train_number}", train_number)
    updated, replacements = re.subn(r"(/trains/)[^/]+(/live(?:/)?(?:\?.*)?$)", rf"\g<1>{train_number}\g<2>", template)
    if replacements == 0:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="LIVE_API_URL must contain /trains/{train_number}/live")
    return updated


def _sync_payload(db: Session, payload: dict[str, Any]) -> dict[str, Any]:
    train = seed_train_payload(db, payload, preserve_operational_history=True)
    return {
        "status": "synced",
        "train_number": train.train_number,
        "train_name": train.name,
        "source_station": train.source_station,
        "destination_station": train.destination_station,
        "delay_minutes": train.delay_events[-1].delay_minutes if train.delay_events else 0,
        "route_url": f"/api/v1/trains/{train.train_number}/route",
    }


@router.post("/sync")
def sync_live_api(request: LiveSyncRequest, db: Session = Depends(get_db), expected_train_number: str | None = None) -> dict[str, Any]:
    """Fetch a live JSON API server-side and persist its current train state."""
    if not request.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Live API URL must use http:// or https://")

    try:
        headers = dict(request.headers)
        if "railradar.in" in request.url and settings.railradar_api_key and "Authorization" not in headers:
            headers["Authorization"] = f"Bearer {settings.railradar_api_key}"
        response = httpx.get(request.url, headers=headers, timeout=20.0, follow_redirects=True)
        response.raise_for_status()
        payload = response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Live API request timed out") from exc
    except httpx.HTTPStatusError as exc:
        provider_status = exc.response.status_code
        mapped_status = {
            401: status.HTTP_401_UNAUTHORIZED,
            403: status.HTTP_403_FORBIDDEN,
            404: status.HTTP_404_NOT_FOUND,
            429: status.HTTP_429_TOO_MANY_REQUESTS,
        }.get(provider_status, status.HTTP_502_BAD_GATEWAY)
        raise HTTPException(status_code=mapped_status, detail=f"Live provider returned HTTP {provider_status}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Live API request failed: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Live API did not return valid JSON") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Live API JSON must be an object")
    if expected_train_number is not None:
        returned_train_number = normalize_train_payload(payload).get("train_number")
        if returned_train_number != expected_train_number:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Live provider returned train {returned_train_number or 'unknown'}, expected {expected_train_number}",
            )
    try:
        return _sync_payload(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.post("/sync-by-train")
def sync_live_by_train(request: TrainNumberSyncRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Fetch the configured provider endpoint for a train number and persist its live state."""
    url = _url_for_train(request.train_number.strip())
    return sync_live_api(LiveSyncRequest(url=url), db, expected_train_number=request.train_number.strip())


@router.post("/ingest")
def ingest_live_payload(request: LivePayloadRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Persist a live payload supplied by a trusted integration or test client."""
    try:
        return _sync_payload(db, request.payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/trains/{train_number}")
def get_live_train(train_number: str, db: Session = Depends(get_db)) -> dict:
    """Return the latest known live position for a train."""
    service = LiveService(db)
    try:
        return service.get_live_train(train_number)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/trains")
def get_live_trains(db: Session = Depends(get_db)) -> dict:
    """Return current live, delay, and prediction summaries for active trains."""
    from backend.models.train import Train

    trains = db.query(Train).filter(Train.is_active.is_(True)).limit(20).all()
    prediction_service = PredictionService(db)
    summaries = []
    for train in trains:
        live = max(train.live_positions, key=lambda item: item.updated_at, default=None)
        delay = max(train.delay_events, key=lambda item: item.event_time, default=None)
        try:
            prediction = prediction_service.get_prediction_for_train(train.train_number)
        except ValueError:
            prediction = {"status": "no_prediction"}
        delay_minutes = float(delay.delay_minutes or 0) if delay else 0.0
        status_label = "Delayed" if delay_minutes > 0 else "Running" if live else "On Time"
        summaries.append({
            "train_number": train.train_number,
            "name": train.name,
            "train_type": train.train_type,
            "source_station": train.source_station,
            "destination_station": train.destination_station,
            "status": status_label,
            "current_station": live.current_station_code if live else None,
            "previous_station": live.previous_station_code if live else None,
            "next_station": live.next_station_code if live else None,
            "speed_kmph": live.current_speed_kmph if live else None,
            "delay_minutes": delay_minutes,
            "predicted_arrival": prediction.get("predicted_arrival"),
            "confidence_score": prediction.get("confidence_score"),
            "updated_at": live.updated_at if live else None,
        })
    return {"trains": summaries, "status": "ok"}
