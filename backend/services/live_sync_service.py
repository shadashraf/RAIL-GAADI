from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Any

import httpx

from backend.app.config import settings
from backend.database.session import SessionLocal
from backend.services.seed_service import seed_train_payload
from backend.models.train import Train

logger = logging.getLogger(__name__)

_LAST_SYNC_STATUS: dict[str, Any] = {"success_at": None, "error": None}


def get_last_live_sync_status() -> dict[str, Any]:
    return {"success_at": _LAST_SYNC_STATUS["success_at"], "error": _LAST_SYNC_STATUS["error"]}


def compute_backoff_delay(attempt: int, base_seconds: int = 2, max_seconds: int = 30) -> float:
    """Return an exponential backoff delay for a failed sync attempt."""
    if attempt <= 0:
        return 0.0
    return min(base_seconds * (2 ** (attempt - 1)), max_seconds)


def _headers_for_url(url: str) -> dict[str, str]:
    headers: dict[str, str] = {}
    if "railradar.in" in url and settings.railradar_api_key:
        headers["Authorization"] = f"Bearer {settings.railradar_api_key}"
    return headers


def _url_for_train(template: str, train_number: str) -> str:
    if "{train_number}" in template:
        return template.replace("{train_number}", train_number)
    updated, replacements = re.subn(r"(/trains/)[^/]+(/live(?:/)?(?:\?.*)?$)", rf"\g<1>{train_number}\g<2>", template)
    return updated if replacements else template


async def sync_configured_live_api(train_number: str | None = None, max_retries: int = 3, base_backoff_seconds: int = 2) -> dict[str, Any] | None:
    """Fetch and persist the configured live API payload, retrying transient failures with backoff."""
    if not settings.live_api_url:
        return None

    url = _url_for_train(settings.live_api_url, train_number) if train_number else settings.live_api_url
    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                response = await client.get(url, headers=_headers_for_url(url))
                response.raise_for_status()
                payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("Live API JSON must be an object")

            with SessionLocal() as db:
                train = seed_train_payload(db, payload, preserve_operational_history=True)
                result = {"train_number": train.train_number, "delay_minutes": train.delay_events[-1].delay_minutes if train.delay_events else 0}
            _LAST_SYNC_STATUS["success_at"] = datetime.now(timezone.utc)
            _LAST_SYNC_STATUS["error"] = None
            logger.info("Configured live sync completed: train=%s delay=%s", result["train_number"], result["delay_minutes"])
            return result
        except (httpx.HTTPError, ValueError) as exc:
            if attempt < max_retries:
                delay = compute_backoff_delay(attempt + 1, base_backoff_seconds)
                logger.warning(
                    "Configured live sync failed attempt %s/%s: %s. Retrying in %.1f seconds.",
                    attempt + 1,
                    max_retries + 1,
                    exc,
                    delay,
                )
                await asyncio.sleep(delay)
                continue

            _LAST_SYNC_STATUS["success_at"] = None
            _LAST_SYNC_STATUS["error"] = str(exc)
            logger.warning("Configured live sync failed permanently after %s attempts: %s", max_retries + 1, exc)
            return None

    return None
