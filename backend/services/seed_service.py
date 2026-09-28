from __future__ import annotations

import json
from datetime import datetime
from json import JSONDecoder
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from backend.models.delay_event import DelayEvent
from backend.models.live_position import LivePosition
from backend.models.route_segment import RouteSegment
from backend.models.station import Station
from backend.models.train import Train
from backend.models.train_station import TrainStation


def normalize_train_payload(raw_payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize a raw train payload into our internal backend-friendly shape."""
    payload = raw_payload.get("data", raw_payload)
    train_info = payload.get("train", {})
    source_info = train_info.get("source", {})
    destination_info = train_info.get("destination", {})
    train_number = payload.get("train_number") or payload.get("trainNumber") or payload.get("number") or train_info.get("number")
    train_name = payload.get("name") or payload.get("trainName") or train_info.get("name")
    source_station = payload.get("source_station") or payload.get("source", {}).get("code") or train_info.get("source", {}).get("code")
    destination_station = payload.get("destination_station") or payload.get("destination", {}).get("code") or train_info.get("destination", {}).get("code")

    route_entries = payload.get("route") or payload.get("stations") or []
    normalized_route: list[dict[str, Any]] = []
    for entry in route_entries:
        station_info = entry.get("station") if isinstance(entry.get("station"), dict) else {}
        normalized_route.append({
            "station_code": entry.get("stationCode") or entry.get("station_code") or entry.get("code") or station_info.get("stationCode") or station_info.get("station_code") or station_info.get("code"),
            "station_name": entry.get("stationName") or entry.get("station_name") or entry.get("name") or station_info.get("stationName") or station_info.get("station_name") or station_info.get("name"),
            "sequence": entry.get("sequence") if entry.get("sequence") is not None else entry.get("sequence_no"),
            "scheduled_arrival": entry.get("scheduledArrival") or entry.get("scheduled_arrival"),
            "scheduled_departure": entry.get("scheduledDeparture") or entry.get("scheduled_departure"),
            "actual_arrival": entry.get("actualArrival") or entry.get("actual_arrival"),
            "actual_departure": entry.get("actualDeparture") or entry.get("actual_departure"),
            "arrival_delay_minutes": entry.get("delayArrival") or entry.get("arrival_delay_minutes"),
            "departure_delay_minutes": entry.get("delayDeparture") or entry.get("departure_delay_minutes"),
            "platform_no": entry.get("platform") or entry.get("platform_no"),
            "distance_from_source_km": entry.get("distance") or entry.get("distance_from_source_km"),
            "speed_to_next_station_kmph": entry.get("speedToNextStationKmph") or entry.get("speed_to_next_station_kmph"),
            "is_halt": entry.get("isHalt") if "isHalt" in entry else entry.get("is_halt"),
            "latitude": entry.get("latitude") or entry.get("lat"),
            "longitude": entry.get("longitude") or entry.get("lng") or entry.get("lon"),
        })

    live_position = payload.get("live_position") or payload.get("currentLocation") or {}

    route_delay_minutes = max(
        (entry.get("departure_delay_minutes") or entry.get("arrival_delay_minutes") or 0 for entry in normalized_route),
        default=0,
    )

    normalized = {
        "train_number": str(train_number) if train_number is not None else None,
        "name": train_name,
        "train_type": payload.get("train_type") or train_info.get("type") or "passenger",
        "category": payload.get("category") or train_info.get("category") or "Coaching",
        "source_station": source_station,
        "destination_station": destination_station,
        "source_coordinates": {
            "latitude": source_info.get("lat"),
            "longitude": source_info.get("lng"),
        },
        "destination_coordinates": {
            "latitude": destination_info.get("lat"),
            "longitude": destination_info.get("lng"),
        },
        "status": payload.get("status") or "running",
        "delay_minutes": payload.get("delayMinutes") or payload.get("delay_minutes") or route_delay_minutes,
        "live_position": {
            "current_station_code": live_position.get("stationCode") or live_position.get("current_station_code"),
            "previous_station_code": payload.get("previousHalt", {}).get("stationCode") or payload.get("previous_halt", {}).get("station_code"),
            "next_station_code": payload.get("nextHalt", {}).get("stationCode") or payload.get("next_halt", {}).get("station_code"),
            "current_speed_kmph": live_position.get("speedKmph") or live_position.get("current_speed_kmph"),
            "latitude": live_position.get("latitude"),
            "longitude": live_position.get("longitude"),
            "updated_at": payload.get("lastUpdatedAt") or payload.get("updated_at"),
        },
        "route": normalized_route,
    }

    return normalized


def load_payload_snapshots(path: Path) -> list[dict[str, Any]]:
    """Load one JSON payload or concatenated JSON snapshots from an export."""
    text = path.read_text(encoding="utf-8")
    decoder = JSONDecoder()
    snapshots: list[dict[str, Any]] = []
    position = 0
    while position < len(text):
        while position < len(text) and text[position].isspace():
            position += 1
        start = text.find("{", position)
        if start == -1:
            break
        try:
            payload, position = decoder.raw_decode(text, start)
        except json.JSONDecodeError:
            position = start + 1
            continue
        if isinstance(payload, dict):
            snapshots.append(payload)
    return snapshots


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)


def seed_train_payload(
    db: Session,
    raw_payload: dict[str, Any],
    preserve_operational_history: bool = False,
) -> Train:
    """Upsert one normalized train payload and its current operational records."""
    normalized = normalize_train_payload(raw_payload)
    required_fields = ("train_number", "name", "source_station", "destination_station")
    missing_fields = [field for field in required_fields if not normalized.get(field)]
    if missing_fields:
        raise ValueError(f"Train payload is missing required fields: {', '.join(missing_fields)}")

    train = db.query(Train).filter(Train.train_number == normalized["train_number"]).first()
    if train is None:
        train = Train(
            train_number=normalized["train_number"],
            name=normalized["name"],
            source_station=normalized["source_station"],
            destination_station=normalized["destination_station"],
        )
        db.add(train)
        db.flush()

    incoming_updated_at = _parse_datetime(normalized["live_position"].get("updated_at"))
    latest_live_position = max((position.updated_at for position in train.live_positions), default=None)
    if preserve_operational_history and incoming_updated_at is not None and latest_live_position is not None and incoming_updated_at < latest_live_position:
        return train

    train.name = normalized["name"]
    train.train_type = normalized["train_type"]
    train.category = normalized["category"]
    train.source_station = normalized["source_station"]
    train.destination_station = normalized["destination_station"]

    for child_collection in (train.stations, train.route_segments):
        child_collection.clear()
    if not preserve_operational_history:
        for child_collection in (train.live_positions, train.delay_events):
            child_collection.clear()

    route = normalized["route"]
    for index, entry in enumerate(route):
        station_code = entry.get("station_code")
        if not station_code:
            continue
        station = db.query(Station).filter(Station.code == station_code).first()
        if station is None:
            station = Station(
                code=station_code,
                name=entry.get("station_name") or station_code,
            )
            db.add(station)
            db.flush()
        if entry.get("latitude") is not None and entry.get("longitude") is not None:
            station.latitude = entry["latitude"]
            station.longitude = entry["longitude"]
        elif station_code == normalized["source_station"]:
            station.latitude = normalized["source_coordinates"]["latitude"]
            station.longitude = normalized["source_coordinates"]["longitude"]
        elif station_code == normalized["destination_station"]:
            station.latitude = normalized["destination_coordinates"]["latitude"]
            station.longitude = normalized["destination_coordinates"]["longitude"]

        train_station = TrainStation(
            station=station,
            sequence_no=entry.get("sequence") or entry.get("sequence_no") or index + 1,
            scheduled_arrival=_parse_datetime(entry.get("scheduled_arrival")),
            scheduled_departure=_parse_datetime(entry.get("scheduled_departure")),
            actual_arrival=_parse_datetime(entry.get("actual_arrival")),
            actual_departure=_parse_datetime(entry.get("actual_departure")),
            arrival_delay_minutes=entry.get("arrival_delay_minutes"),
            departure_delay_minutes=entry.get("departure_delay_minutes"),
            platform_no=entry.get("platform_no"),
            distance_from_source_km=entry.get("distance_from_source_km"),
            is_halt=entry.get("is_halt") is True,
            is_origin=station_code == normalized["source_station"],
            is_destination=station_code == normalized["destination_station"],
        )
        train.stations.append(train_station)

    for current, following in zip(route, route[1:]):
        if not current.get("station_code") or not following.get("station_code"):
            continue
        distance = following.get("distance_from_source_km")
        previous_distance = current.get("distance_from_source_km")
        train.route_segments.append(
            RouteSegment(
                from_station_code=current["station_code"],
                to_station_code=following["station_code"],
                distance_km=distance - previous_distance if distance is not None and previous_distance is not None else None,
                avg_speed_kmph=current.get("speed_to_next_station_kmph"),
            )
        )

    live = normalized["live_position"]
    live_updated_at = _parse_datetime(live.get("updated_at")) or datetime.utcnow()
    if any(value is not None for value in live.values()) and (latest_live_position is None or live_updated_at >= latest_live_position):
        train.live_positions.append(
            LivePosition(
                current_station_code=live.get("current_station_code"),
                previous_station_code=live.get("previous_station_code"),
                next_station_code=live.get("next_station_code"),
                current_speed_kmph=live.get("current_speed_kmph"),
                latitude=live.get("latitude"),
                longitude=live.get("longitude"),
                updated_at=live_updated_at,
                source="raw_payload",
            )
        )

    delay_minutes = normalized["delay_minutes"]
    if delay_minutes:
        event_time = live_updated_at if preserve_operational_history else live_updated_at
        latest_delay_event = max((event.event_time for event in train.delay_events), default=None)
        if latest_delay_event is None or event_time >= latest_delay_event:
            train.delay_events.append(
                DelayEvent(
                    delay_minutes=delay_minutes,
                    fresh_delay_minutes=delay_minutes,
                    cumulative_delay_minutes=delay_minutes,
                    event_time=event_time,
                )
            )

    db.commit()
    db.refresh(train)
    return train


def ingest_train_snapshots(db: Session, snapshots: list[dict[str, Any]]) -> Train:
    """Seed current state and preserve older snapshots as operational history."""
    if not snapshots:
        raise ValueError("At least one train snapshot is required")

    def snapshot_time(payload: dict[str, Any]) -> datetime:
        value = payload.get("data", payload).get("lastUpdatedAt")
        return _parse_datetime(value) or datetime.min

    current = max(snapshots, key=snapshot_time)
    train = seed_train_payload(db, current)
    current_time = snapshot_time(current)

    for snapshot in snapshots:
        snapshot_timestamp = snapshot_time(snapshot)
        if snapshot_timestamp == current_time:
            continue
        normalized = normalize_train_payload(snapshot)
        live = normalized["live_position"]
        if any(value is not None for value in live.values()):
            train.live_positions.append(
                LivePosition(
                    current_station_code=live.get("current_station_code"),
                    previous_station_code=live.get("previous_station_code"),
                    next_station_code=live.get("next_station_code"),
                    current_speed_kmph=live.get("current_speed_kmph"),
                    latitude=live.get("latitude"),
                    longitude=live.get("longitude"),
                    updated_at=snapshot_timestamp,
                    source="raw_payload_history",
                )
            )
        if normalized["delay_minutes"]:
            train.delay_events.append(
                DelayEvent(
                    delay_minutes=normalized["delay_minutes"],
                    fresh_delay_minutes=normalized["delay_minutes"],
                    cumulative_delay_minutes=normalized["delay_minutes"],
                    event_time=snapshot_timestamp,
                )
            )

    db.commit()
    db.refresh(train)
    return train
