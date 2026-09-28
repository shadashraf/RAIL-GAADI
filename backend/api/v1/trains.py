from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.dependencies import get_db
from backend.services.train_service import TrainService
from backend.services.train_search_service import search_live_stations, search_live_trains, search_trains_between

router = APIRouter(prefix="/trains", tags=["trains"])


@router.get("/stations")
async def search_stations(
    query: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=10, ge=1, le=50),
) -> list[dict]:
    """Proxy station autocomplete to the configured live provider."""
    return await search_live_stations(query, limit)


@router.get("/search")
async def search_trains(
    query: str | None = None,
    from_station: str | None = Query(default=None, alias="from"),
    to_station: str | None = Query(default=None, alias="to"),
) -> list[dict] | dict:
    """Search live train names or services between two API-returned stations."""
    if from_station is not None or to_station is not None:
        if from_station is None or to_station is None:
            raise HTTPException(status_code=422, detail="Both from and to stations are required.")
        return await search_trains_between(from_station, to_station)
    return await search_live_trains(query) if query and query.strip() else []


@router.get("/{train_number}")
def get_train_by_number(train_number: str, db: Session = Depends(get_db)) -> dict:
    """Return a basic train record lookup."""
    service = TrainService(db)
    train = service.train_repository.get_by_number(train_number)
    if train is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Train {train_number} not found")

    return {
        "train_number": train.train_number,
        "name": train.name,
        "train_type": train.train_type,
        "category": train.category,
        "source_station": train.source_station,
        "destination_station": train.destination_station,
        "is_active": train.is_active,
    }


@router.get("/{train_number}/overview")
def get_train_overview(train_number: str, db: Session = Depends(get_db)) -> dict:
    """Return the overview payload used for the future Train Detail page."""
    service = TrainService(db)
    try:
        return service.get_train_overview(train_number)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{train_number}/route")
def get_train_route(train_number: str, db: Session = Depends(get_db)) -> dict:
    """Return scheduled/actual station timings and station-to-station segments."""
    service = TrainService(db)
    train = service.train_repository.get_by_number(train_number)
    if train is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Train {train_number} not found")

    stations = sorted(train.stations, key=lambda station: station.sequence_no)
    return {
        "train_number": train.train_number,
        "stations": [
            {
                "sequence": station.sequence_no,
                "station_code": station.station.code,
                "station_name": station.station.name,
                "latitude": station.station.latitude,
                "longitude": station.station.longitude,
                "scheduled_arrival": station.scheduled_arrival,
                "scheduled_departure": station.scheduled_departure,
                "actual_arrival": station.actual_arrival,
                "actual_departure": station.actual_departure,
                "arrival_delay_minutes": station.arrival_delay_minutes,
                "departure_delay_minutes": station.departure_delay_minutes,
                "platform_no": station.platform_no,
                "is_halt": station.is_halt,
            }
            for station in stations
        ],
        "segments": [
            {
                "from_station_code": segment.from_station_code,
                "to_station_code": segment.to_station_code,
                "distance_km": segment.distance_km,
                "avg_speed_kmph": segment.avg_speed_kmph,
            }
            for segment in train.route_segments
        ],
    }
