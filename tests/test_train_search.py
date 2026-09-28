import asyncio
from urllib.parse import urlsplit

import httpx
import pytest
from fastapi import HTTPException

from backend.app.config import settings
from backend.services.train_search_service import search_live_stations, search_live_trains, search_trains_between


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code
        self.request = httpx.Request("GET", "https://api.railradar.in/test")

    def raise_for_status(self):
        if self.status_code >= 400:
            response = httpx.Response(self.status_code, request=self.request)
            raise httpx.HTTPStatusError("provider error", request=self.request, response=response)

    def json(self):
        return self.payload


class _FakeAsyncClient:
    responses = {}
    calls = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def get(self, url, params=None, headers=None):
        path = urlsplit(url).path
        self.calls.append({"url": url, "params": params or {}, "headers": headers or {}})
        response = self.responses[path]
        if isinstance(response, Exception):
            raise response
        return response


def _set_provider(monkeypatch, responses):
    monkeypatch.setattr(settings, "live_api_url", "https://api.railradar.in/v1/trains/20801/live")
    monkeypatch.setattr("backend.services.train_search_service.httpx.AsyncClient", _FakeAsyncClient)
    _FakeAsyncClient.responses = responses
    _FakeAsyncClient.calls = []


def _between_payload(trains):
    return {
        "success": True,
        "data": {
            "from": {"code": "GAYA", "name": "Gaya Jn"},
            "to": {"code": "HWH", "name": "Howrah Jn"},
            "count": len(trains),
            "trains": trains,
        },
        "meta": {"source": "database"},
    }


def _train(number, from_code="GAYA", to_code="HWH", from_sequence=1, to_sequence=150):
    return {
        "train": {"number": number, "name": f"Train {number}", "type": "Express"},
        "from": {
            "code": from_code,
            "name": "Gaya Jn",
            "sequence": from_sequence,
            "departure": "12:10",
        },
        "to": {
            "code": to_code,
            "name": "Howrah Jn",
            "sequence": to_sequence,
            "arrival": "03:15",
        },
        "live": {"type": "running", "delayMinutes": 6},
        "distance": 656.8,
        "duration": 905,
        "totalHaltsBetween": 35,
    }


def test_station_autocomplete_uses_live_lookup_and_preserves_provider_codes(monkeypatch):
    _set_provider(monkeypatch, {
        "/v1/lookup/search/stations": _FakeResponse({
            "success": True,
            "data": [
                {"code": "GAYA", "name": "Gaya Jn", "city": "Gaya", "isActive": True},
                {"code": "MDE", "name": "Makhdumpur Gaya", "city": "Jehanabad", "isActive": True},
            ],
            "meta": {},
        }),
    })

    stations = asyncio.run(search_live_stations("  Gaya  "))

    assert [station["station_code"] for station in stations] == ["GAYA", "MDE"]
    assert stations[0]["station_name"] == "Gaya Jn"
    assert _FakeAsyncClient.calls[0]["params"] == {"q": "Gaya", "limit": 10}


def test_train_autocomplete_uses_live_lookup_response_fields(monkeypatch):
    _set_provider(monkeypatch, {
        "/v1/lookup/search/trains": _FakeResponse({
            "success": True,
            "data": [{
                "number": "13024",
                "name": "Gaya - Howrah Express",
                "source": "GAYA",
                "dest": "HWH",
                "type": "Mail/Express",
            }],
            "meta": {},
        }),
    })

    trains = asyncio.run(search_live_trains("13024"))

    assert trains == [{
        "train_number": "13024",
        "name": "Gaya - Howrah Express",
        "source_station": "GAYA",
        "destination_station": "HWH",
        "train_type": "Mail/Express",
    }]
    assert _FakeAsyncClient.calls[0]["params"] == {"q": "13024", "limit": 10}


def test_between_search_keeps_only_api_routes_with_matching_codes_and_order(monkeypatch):
    payload = _between_payload([
        _train("13024"),
        _train("19999", from_sequence=151, to_sequence=10),
        _train("19998", from_code="PNBE"),
    ])
    _set_provider(monkeypatch, {"/v1/trains/between/GAYA/HWH": _FakeResponse(payload)})

    result = asyncio.run(search_trains_between("GAYA", "HWH"))

    assert result["found"] is True
    assert result["message"] is None
    assert [train["train_number"] for train in result["trains"]] == ["13024"]
    train = result["trains"][0]
    assert train["from_station"] == {"station_code": "GAYA", "station_name": "Gaya Jn"}
    assert train["to_station"] == {"station_code": "HWH", "station_name": "Howrah Jn"}
    assert train["scheduled_departure"] == "12:10"
    assert train["scheduled_arrival"] == "03:15"
    assert train["status"] == "running"
    assert train["delay_minutes"] == 6
    assert _FakeAsyncClient.calls[0]["params"] == {"live": "true"}


def test_empty_live_between_response_returns_explicit_no_trains_message(monkeypatch):
    _set_provider(monkeypatch, {"/v1/trains/between/HWH/GAYA": _FakeResponse({
        "success": True,
        "data": {
            "from": {"code": "HWH", "name": "Howrah Jn"},
            "to": {"code": "GAYA", "name": "Gaya Jn"},
            "count": 0,
            "trains": [],
        },
        "meta": {},
    })})

    result = asyncio.run(search_trains_between("HWH", "GAYA"))

    assert result == {
        "found": False,
        "message": "No trains found between Howrah Jn and Gaya Jn",
        "trains": [],
    }


def test_between_search_rejects_same_station_before_provider_request(monkeypatch):
    _set_provider(monkeypatch, {})

    with pytest.raises(HTTPException) as error:
        asyncio.run(search_trains_between("GAYA", " gaya "))

    assert error.value.status_code == 400
    assert _FakeAsyncClient.calls == []


def test_between_search_rejects_provider_station_pair_mismatch(monkeypatch):
    payload = _between_payload([_train("13024")])
    payload["data"]["from"]["code"] = "PNBE"
    _set_provider(monkeypatch, {"/v1/trains/between/GAYA/HWH": _FakeResponse(payload)})

    with pytest.raises(HTTPException) as error:
        asyncio.run(search_trains_between("GAYA", "HWH"))

    assert error.value.status_code == 502


def test_station_search_maps_provider_error_envelope(monkeypatch):
    _set_provider(monkeypatch, {"/v1/lookup/search/stations": _FakeResponse({
        "success": False,
        "error": {"message": "Station lookup unavailable"},
    })})

    with pytest.raises(HTTPException) as error:
        asyncio.run(search_live_stations("Gaya"))

    assert error.value.status_code == 502
    assert error.value.detail == "Station lookup unavailable"


def test_live_search_maps_provider_rate_limit(monkeypatch):
    _set_provider(monkeypatch, {"/v1/trains/between/GAYA/HWH": _FakeResponse({}, status_code=429)})

    with pytest.raises(HTTPException) as error:
        asyncio.run(search_trains_between("GAYA", "HWH"))

    assert error.value.status_code == 429