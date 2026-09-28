from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import quote, urlsplit, urlunsplit

import httpx
from fastapi import HTTPException, status

from backend.app.config import settings
from backend.services.live_sync_service import _headers_for_url

logger = logging.getLogger(__name__)


def _http_error_for_provider(exc: httpx.HTTPStatusError) -> HTTPException:
    provider_status = exc.response.status_code
    mapped_status = {
        401: status.HTTP_401_UNAUTHORIZED,
        403: status.HTTP_403_FORBIDDEN,
        404: status.HTTP_404_NOT_FOUND,
        429: status.HTTP_429_TOO_MANY_REQUESTS,
    }.get(provider_status, status.HTTP_502_BAD_GATEWAY)
    return HTTPException(
        status_code=mapped_status,
        detail=f"Live provider returned HTTP {provider_status}",
    )


def _safe_url_for_logging(url: str) -> str:
    parts = urlsplit(url)
    host = parts.netloc.rsplit("@", 1)[-1]
    return urlunsplit((parts.scheme, host, parts.path, "<redacted>" if parts.query else "", ""))


def _provider_api_root() -> str:
    template = settings.live_api_url
    if not template:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LIVE_API_URL is not configured.")
    parts = urlsplit(template)
    match = re.search(r"/trains/[^/]+/live/?$", parts.path, flags=re.IGNORECASE)
    if match is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="LIVE_API_URL must use the provider's /v1/trains/{train_number}/live endpoint.",
        )
    root_path = parts.path[:match.start()].rstrip("/")
    return urlunsplit((parts.scheme, parts.netloc, root_path, "", ""))


async def _provider_data(url: str, params: dict[str, Any] | None = None) -> Any:
    logger.info("Live API request url=%s params=%s", _safe_url_for_logging(url), params or {})
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.get(url, params=params, headers=_headers_for_url(url))
            response.raise_for_status()
            payload = response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Live API request timed out.") from exc
    except httpx.HTTPStatusError as exc:
        raise _http_error_for_provider(exc) from exc
    except httpx.HTTPError as exc:
        logger.warning("Live API request failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Unable to reach the live API.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Live API returned invalid JSON.") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Live API returned an invalid response envelope.")
    if payload.get("success") is False:
        error = payload.get("error")
        message = error.get("message") if isinstance(error, dict) else None
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=message or "Live API reported a request error.")
    if "data" not in payload:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Live API response is missing data.")
    return payload["data"]


def _first_value(item: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = item.get(key)
        if value is not None and value != "":
            return value
    return None


def _station_code(item: dict[str, Any]) -> str | None:
    nested = item.get("station")
    station = nested if isinstance(nested, dict) else {}
    value = _first_value(item, "code", "stationCode", "station_code")
    if value is None:
        value = _first_value(station, "code", "stationCode", "station_code")
    return str(value).strip() if value is not None else None


def _station_name(item: dict[str, Any]) -> str | None:
    nested = item.get("station")
    station = nested if isinstance(nested, dict) else {}
    value = _first_value(item, "name", "stationName", "station_name")
    if value is None:
        value = _first_value(station, "name", "stationName", "station_name")
    return str(value).strip() if value is not None else None


async def search_live_stations(query: str, limit: int = 10) -> list[dict[str, Any]]:
    search_query = query.strip()
    if not search_query:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Station search query is required.")
    root = _provider_api_root()
    data = await _provider_data(f"{root}/lookup/search/stations", {"q": search_query, "limit": min(limit, 50)})
    if not isinstance(data, list):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Live API returned an invalid station search result.")

    stations = []
    for item in data:
        if not isinstance(item, dict):
            continue
        code = _station_code(item)
        name = _station_name(item)
        if not code or not name:
            continue
        stations.append({
            "station_code": code,
            "station_name": name,
            "city": item.get("city"),
            "is_active": item.get("isActive", item.get("is_active")),
        })
    logger.info("Live station autocomplete query=%r returned=%s", search_query, len(stations))
    return stations


async def search_live_trains(query: str, limit: int = 10) -> list[dict[str, Any]]:
    search_query = query.strip()
    if not search_query:
        return []
    root = _provider_api_root()
    data = await _provider_data(f"{root}/lookup/search/trains", {"q": search_query, "limit": min(limit, 50)})
    if not isinstance(data, list):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Live API returned an invalid train search result.")

    trains = []
    for item in data:
        if not isinstance(item, dict):
            continue
        number = _first_value(item, "number", "trainNumber", "train_number")
        name = _first_value(item, "name", "trainName", "train_name")
        if number is None or name is None:
            continue
        trains.append({
            "train_number": str(number),
            "name": str(name),
            "source_station": _first_value(item, "source", "sourceStation", "source_station") or "",
            "destination_station": _first_value(item, "dest", "destination", "destinationStation", "destination_station") or "",
            "train_type": _first_value(item, "type", "category") or "",
        })
    logger.info("Live train autocomplete query=%r returned=%s", search_query, len(trains))
    return trains


def _sequence(item: dict[str, Any]) -> float | None:
    value = _first_value(item, "sequence", "sequenceNo", "sequence_no")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


async def search_trains_between(from_code: str, to_code: str) -> dict[str, Any]:
    requested_from = from_code.strip()
    requested_to = to_code.strip()
    if not requested_from or not requested_to:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Both station codes are required.")
    if requested_from.casefold() == requested_to.casefold():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="From and to stations must be different.")

    root = _provider_api_root()
    logger.info("Live trains-between requested from_code=%s to_code=%s", requested_from, requested_to)
    data = await _provider_data(
        f"{root}/trains/between/{quote(requested_from, safe='')}/{quote(requested_to, safe='')}",
        {"live": "true"},
    )
    if not isinstance(data, dict):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Live API returned an invalid trains-between result.")

    api_from = data.get("from") if isinstance(data.get("from"), dict) else {}
    api_to = data.get("to") if isinstance(data.get("to"), dict) else {}
    api_from_code = _station_code(api_from)
    api_to_code = _station_code(api_to)
    if (api_from_code and api_from_code.casefold() != requested_from.casefold()) or (
        api_to_code and api_to_code.casefold() != requested_to.casefold()
    ):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Live API returned a different station pair.")

    provider_trains = data.get("trains")
    if not isinstance(provider_trains, list):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Live API returned an invalid train list.")

    results: list[dict[str, Any]] = []
    routes_with_from = 0
    routes_with_to = 0
    for item in provider_trains:
        if not isinstance(item, dict):
            continue
        from_stop = item.get("from") if isinstance(item.get("from"), dict) else {}
        to_stop = item.get("to") if isinstance(item.get("to"), dict) else {}
        stop_from_code = _station_code(from_stop)
        stop_to_code = _station_code(to_stop)
        if stop_from_code is not None and stop_from_code.casefold() != requested_from.casefold():
            continue
        if stop_to_code is not None and stop_to_code.casefold() != requested_to.casefold():
            continue
        if stop_from_code is None and not api_from_code:
            continue
        if stop_to_code is None and not api_to_code:
            continue
        routes_with_from += 1
        routes_with_to += 1
        from_sequence = _sequence(from_stop)
        to_sequence = _sequence(to_stop)
        if from_sequence is None or to_sequence is None or from_sequence >= to_sequence:
            continue

        train = item.get("train") if isinstance(item.get("train"), dict) else item
        train_number = _first_value(train, "number", "trainNumber", "train_number")
        train_name = _first_value(train, "name", "trainName", "train_name")
        if train_number is None or train_name is None:
            continue
        live = item.get("live") if isinstance(item.get("live"), dict) else {}
        from_name = _station_name(from_stop) or _station_name(api_from) or requested_from
        to_name = _station_name(to_stop) or _station_name(api_to) or requested_to
        current = live.get("currentStation") or live.get("current_station") or live.get("currentLocation")
        current = current if isinstance(current, dict) else {}
        route_stations = [
            {
                "station_code": stop_from_code or api_from_code,
                "station_name": from_name,
                "sequence": from_sequence,
                "scheduled_departure": _first_value(from_stop, "departure", "scheduledDeparture", "scheduled_departure"),
            },
            {
                "station_code": stop_to_code or api_to_code,
                "station_name": to_name,
                "sequence": to_sequence,
                "scheduled_arrival": _first_value(to_stop, "arrival", "scheduledArrival", "scheduled_arrival"),
            },
        ]
        results.append({
            "train_number": str(train_number),
            "name": str(train_name),
            "train_name": str(train_name),
            "train_type": _first_value(train, "type", "category"),
            "source_station": from_name,
            "destination_station": to_name,
            "from_station": {"station_code": stop_from_code or api_from_code, "station_name": from_name},
            "to_station": {"station_code": stop_to_code or api_to_code, "station_name": to_name},
            "current_station_code": _station_code(current),
            "current_station_name": _station_name(current),
            "status": _first_value(live, "type", "status"),
            "delay_minutes": _first_value(live, "delayMinutes", "delay_minutes"),
            "scheduled_departure": route_stations[0]["scheduled_departure"],
            "scheduled_arrival": route_stations[1]["scheduled_arrival"],
            "ai_predicted_eta": _first_value(live, "eta", "predictedArrival", "estimatedArrival"),
            "route_stations": route_stations,
            "route_station_names": [from_name, to_name],
            "duration_minutes": _first_value(item, "duration", "durationMinutes"),
            "distance_km": item.get("distance"),
            "total_halts_between": item.get("totalHaltsBetween"),
        })

    from_name = _station_name(api_from) or requested_from
    to_name = _station_name(api_to) or requested_to
    logger.info(
        "Live trains-between response from=%s to=%s received=%s routes_with_from=%s routes_with_to=%s matches=%s",
        requested_from,
        requested_to,
        len(provider_trains),
        routes_with_from,
        routes_with_to,
        len(results),
    )
    return {
        "found": bool(results),
        "message": None if results else f"No trains found between {from_name} and {to_name}",
        "trains": results,
    }