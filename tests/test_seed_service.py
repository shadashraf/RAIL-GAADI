from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models.base import Base
from backend.models.train import Train
import httpx
import pytest
from fastapi import HTTPException
from datetime import datetime
from types import SimpleNamespace

from backend.api.v1.live import LiveSyncRequest, _url_for_train, sync_live_api
from backend.app.config import settings
from backend.services.live_sync_service import compute_backoff_delay
from backend.services.seed_service import normalize_train_payload, seed_train_payload
from backend.services.prediction_service import PredictionService
from backend.services.live_sync_service import _url_for_train as configured_url_for_train


def test_compute_backoff_delay_is_exponential_and_capped():
    assert compute_backoff_delay(1) == 2
    assert compute_backoff_delay(2) == 4
    assert compute_backoff_delay(5) == 30
    assert compute_backoff_delay(0) == 0


def test_live_url_is_generated_from_train_number(monkeypatch):
    monkeypatch.setattr(settings, "live_api_url", "https://api.railradar.in/v1/trains/20801/live")

    assert _url_for_train("12345") == "https://api.railradar.in/v1/trains/12345/live"
    assert configured_url_for_train("https://api.railradar.in/v1/trains/20801/live", "13401") == "https://api.railradar.in/v1/trains/13401/live"


def test_live_sync_maps_provider_404(monkeypatch):
    def raise_not_found(*args, **kwargs):
        request = httpx.Request("GET", "https://provider.example/trains/20801/live")
        response = httpx.Response(404, request=request)
        raise httpx.HTTPStatusError("not found", request=request, response=response)

    monkeypatch.setattr("backend.api.v1.live.httpx.get", raise_not_found)

    with pytest.raises(HTTPException) as error:
        sync_live_api(LiveSyncRequest(url="https://provider.example/trains/20801/live"), _create_test_session())

    assert error.value.status_code == 404


def test_live_sync_maps_provider_timeout(monkeypatch):
    def raise_timeout(*args, **kwargs):
        request = httpx.Request("GET", "https://provider.example/trains/20801/live")
        raise httpx.ReadTimeout("timed out", request=request)

    monkeypatch.setattr("backend.api.v1.live.httpx.get", raise_timeout)

    with pytest.raises(HTTPException) as error:
        sync_live_api(LiveSyncRequest(url="https://provider.example/trains/20801/live"), _create_test_session())

    assert error.value.status_code == 504


@pytest.mark.parametrize("provider_status", [401, 429])
def test_live_sync_maps_provider_auth_and_rate_limit(provider_status, monkeypatch):
    def raise_provider_error(*args, **kwargs):
        request = httpx.Request("GET", "https://provider.example/trains/20801/live")
        response = httpx.Response(provider_status, request=request)
        raise httpx.HTTPStatusError("provider error", request=request, response=response)

    monkeypatch.setattr("backend.api.v1.live.httpx.get", raise_provider_error)

    with pytest.raises(HTTPException) as error:
        sync_live_api(LiveSyncRequest(url="https://provider.example/trains/20801/live"), _create_test_session())

    assert error.value.status_code == provider_status


def test_live_sync_rejects_malformed_json(monkeypatch):
    def return_invalid_json(*args, **kwargs):
        request = httpx.Request("GET", "https://provider.example/trains/20801/live")
        return httpx.Response(200, request=request, content=b"not-json")

    monkeypatch.setattr("backend.api.v1.live.httpx.get", return_invalid_json)

    with pytest.raises(HTTPException) as error:
        sync_live_api(LiveSyncRequest(url="https://provider.example/trains/20801/live"), _create_test_session())

    assert error.value.status_code == 502


def test_eta_uses_live_or_segment_speed_and_scheduled_dwell():
    service = PredictionService.__new__(PredictionService)
    from_station = SimpleNamespace(distance_from_source_km=100)
    to_station = SimpleNamespace(distance_from_source_km=150)
    dwell_station = SimpleNamespace(
        scheduled_arrival=datetime(2026, 9, 24, 10, 0),
        scheduled_departure=datetime(2026, 9, 24, 10, 5),
    )

    assert service._eta_minutes_between(from_station, to_station, 50, 100) == 60
    assert service._eta_minutes_between(from_station, to_station, None, 100) == 30
    assert service._scheduled_dwell_minutes(dwell_station) == 5


def _create_test_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def test_seed_train_payload_ignores_stale_live_updates():
    session = _create_test_session()

    newer_payload = {
        "train_number": "20801",
        "name": "Delhi-Howrah Express",
        "source_station": "NDLS",
        "destination_station": "HWH",
        "status": "running",
        "lastUpdatedAt": "2026-09-24T00:30:00Z",
        "currentLocation": {"stationCode": "MZP", "speedKmph": 42},
        "delayMinutes": 83,
        "route": [
            {"stationCode": "NDLS", "distance_from_source_km": 0},
            {"stationCode": "MZP", "distance_from_source_km": 430},
            {"stationCode": "HWH", "distance_from_source_km": 1450},
        ],
    }
    stale_payload = {
        "train_number": "20801",
        "name": "Delhi-Howrah Express",
        "source_station": "NDLS",
        "destination_station": "HWH",
        "status": "running",
        "lastUpdatedAt": "2026-09-24T00:20:00Z",
        "currentLocation": {"stationCode": "DDU", "speedKmph": 36},
        "delayMinutes": 85,
        "route": [
            {"stationCode": "NDLS", "distance_from_source_km": 0},
            {"stationCode": "DDU", "distance_from_source_km": 410},
            {"stationCode": "HWH", "distance_from_source_km": 1450},
        ],
    }

    seed_train_payload(session, newer_payload, preserve_operational_history=True)
    seed_train_payload(session, stale_payload, preserve_operational_history=True)

    train = session.query(Train).filter(Train.train_number == "20801").one()
    assert train.live_positions[-1].current_station_code == "MZP"
    assert train.delay_events[-1].delay_minutes == 83
    assert [station.station.code for station in sorted(train.stations, key=lambda item: item.sequence_no)] == ["NDLS", "MZP", "HWH"]


def test_normalize_train_payload_from_sample_file():
    payload = {
        "train_number": 13024,
        "name": "Gaya-Howrah Express",
        "train_type": "Express",
        "category": "Coaching",
        "source_station": "GAYA",
        "destination_station": "HWH",
        "route": [
            {"station_code": "GAYA", "distance_from_source_km": 0, "departure_delay_minutes": 3},
            {"station_code": "JHU", "distance_from_source_km": 68, "departure_delay_minutes": 7},
        ],
        "live_position": {"current_station_code": "MOKA", "current_speed_kmph": 32},
        "delay_minutes": 40,
    }

    normalized = normalize_train_payload(payload)

    assert normalized["train_number"] == "13024"
    assert normalized["name"] == "Gaya-Howrah Express"
    assert normalized["source_station"] == "GAYA"
    assert normalized["destination_station"] == "HWH"
    assert normalized["status"] == "running"
    assert normalized["live_position"]["current_station_code"] == "MOKA"
    assert len(normalized["route"]) == 2


def test_normalize_preserves_is_halt_flag():
    normalized = normalize_train_payload({
        "train_number": "20801",
        "name": "Magadh Express",
        "source_station": "IPR",
        "destination_station": "NDLS",
        "route": [
            {"stationCode": "IPR", "isHalt": True},
            {"stationCode": "KYT", "isHalt": False},
        ],
    })

    assert normalized["route"][0]["is_halt"] is True
    assert normalized["route"][1]["is_halt"] is False


def test_normalize_preserves_route_coordinates():
    normalized = normalize_train_payload({
        "train_number": "12345",
        "name": "Coordinate Test",
        "source_station": "AAA",
        "destination_station": "BBB",
        "route": [{"stationCode": "AAA", "lat": 25.1, "lng": 85.2}],
    })

    assert normalized["route"][0]["latitude"] == 25.1
    assert normalized["route"][0]["longitude"] == 85.2


def test_normalize_nested_api_payload():
    normalized = normalize_train_payload(
        {
            "success": True,
            "data": {
                "trainNumber": "15658",
                "trainName": "Brahmaputra Mail",
                "status": "running",
                "train": {
                    "number": "15658",
                    "type": "Mail/Express",
                    "category": "Express",
                    "source": {"code": "KYQ"},
                    "destination": {"code": "DLI"},
                },
                "currentLocation": {"stationCode": "MRE"},
                "delayMinutes": 273,
                "route": [{"sequence": 1, "stationCode": "KYQ", "stationName": "Kamakhya"}],
            },
        }
    )

    assert normalized["train_number"] == "15658"
    assert normalized["name"] == "Brahmaputra Mail"
    assert normalized["source_station"] == "KYQ"
    assert normalized["destination_station"] == "DLI"
    assert normalized["delay_minutes"] == 273
    assert normalized["live_position"]["current_station_code"] == "MRE"
