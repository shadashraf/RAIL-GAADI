from __future__ import annotations

import logging
import pickle
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import pandas as pd


MODEL_PATH = Path(__file__).resolve().parents[2] / "ml" / "models" / "eta_delay_model.joblib"
logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def load_eta_artifact() -> dict[str, Any] | None:
    if not MODEL_PATH.exists():
        logger.warning("ETA model artifact is unavailable: %s", MODEL_PATH)
        return None
    try:
        artifact = joblib.load(MODEL_PATH)
    except (OSError, EOFError, ValueError, TypeError, AttributeError, ModuleNotFoundError, pickle.UnpicklingError):
        logger.exception("Unable to load ETA model artifact: %s", MODEL_PATH)
        return None
    if not isinstance(artifact, dict) or not callable(getattr(artifact.get("pipeline"), "predict", None)):
        logger.error("ETA model artifact has an invalid pipeline: %s", MODEL_PATH)
        return None
    return artifact


def _numeric(value: Any) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


class MLPredictionService:
    def __init__(self, train: Any):
        self.train = train
        self.artifact = load_eta_artifact()
        self.stations = sorted(train.stations, key=lambda station: station.sequence_no)
        self.live = max(train.live_positions, key=lambda position: position.updated_at, default=None)
        self.current_index = self._current_index()

    def _current_index(self) -> int:
        current_code = self.live.current_station_code if self.live else None
        if current_code:
            match = next((index for index, station in enumerate(self.stations) if station.station.code == current_code), None)
            if match is not None:
                return match
        return max(
            0,
            max(
                (index for index, station in enumerate(self.stations) if station.actual_arrival or station.actual_departure),
                default=0,
            ),
        )

    def _current_delay(self, station: Any) -> float:
        latest = max(self.train.delay_events, key=lambda event: event.event_time, default=None)
        return float(
            _numeric(latest.delay_minutes if latest else None)
            or _numeric(station.departure_delay_minutes)
            or _numeric(station.arrival_delay_minutes)
            or 0.0
        )

    def _feature_row(self, target: Any) -> dict[str, Any] | None:
        if not self.artifact or self.current_index >= len(self.stations) - 1:
            return None
        current = self.stations[self.current_index]
        scheduled = target.scheduled_arrival or target.scheduled_departure
        if scheduled is None:
            return None
        current_distance = _numeric(current.distance_from_source_km) or 0.0
        target_distance = _numeric(target.distance_from_source_km)
        destination_distance = _numeric(self.stations[-1].distance_from_source_km)
        if target_distance is None or destination_distance is None:
            return None
        average_speed = None
        if self.train.route_length_km and self.train.schedule_duration_minutes:
            average_speed = float(self.train.route_length_km) / float(self.train.schedule_duration_minutes) * 60
        dwell = 0.0
        if target.scheduled_arrival and target.scheduled_departure:
            dwell = max(0.0, (target.scheduled_departure - target.scheduled_arrival).total_seconds() / 60)
        return {
            "current_delay_minutes": self._current_delay(current),
            "current_speed_kmph": _numeric(self.live.current_speed_kmph if self.live else None),
            "train_avg_speed_kmph": average_speed,
            "remaining_distance_km": max(destination_distance - current_distance, 0.0),
            "target_distance_km": target_distance,
            "route_progress": target.sequence_no / max(len(self.stations) - 1, 1),
            "scheduled_hour": scheduled.hour + scheduled.minute / 60,
            "scheduled_weekday": scheduled.weekday(),
            "target_dwell_minutes": dwell,
            "route_station_count": len(self.stations),
            "train_number": self.train.train_number,
            "current_station_code": current.station.code,
            "target_station_code": target.station.code,
        }

    def predict_stations(self, targets: list[Any]) -> dict[str, dict[str, Any]]:
        if not self.artifact:
            return {}
        valid: list[tuple[Any, dict[str, Any]]] = []
        for target in targets:
            row = self._feature_row(target)
            if row is not None:
                valid.append((target, row))
        if not valid:
            return {}
        try:
            delays = self.artifact["pipeline"].predict(pd.DataFrame([row for _, row in valid]))
        except (ValueError, TypeError, KeyError, AttributeError, RuntimeError):
            logger.exception("ETA model batch prediction failed for train %s", self.train.train_number)
            return {}
        try:
            test_mae = float(self.artifact.get("metrics", {}).get("test", {}).get("mae_minutes", 999))
            residual_p90 = float(self.artifact.get("residual_p90_minutes", 60))
            factors = self.artifact.get("top_factors", [])[:4]
        except (TypeError, ValueError, KeyError):
            logger.exception("ETA model metadata is invalid for train %s", self.train.train_number)
            return {}
        results: dict[str, dict[str, Any]] = {}
        confidence = max(0.35, min(0.9, 1.0 - residual_p90 / 160.0))
        for (target, row), predicted in zip(valid, delays):
            scheduled_arrival = target.scheduled_arrival or target.scheduled_departure
            scheduled_departure = target.scheduled_departure or target.scheduled_arrival
            if scheduled_arrival is None:
                continue
            delay_minutes = round(float(predicted), 1)
            reliable = test_mae <= 60 and row["target_distance_km"] is not None
            results[target.station.code] = {
                "status": "ok" if reliable else "fallback_required",
                "prediction_source": "ml" if reliable else "fallback",
                "is_fallback": not reliable,
                "predicted_arrival": scheduled_arrival + timedelta(minutes=delay_minutes),
                "predicted_departure": scheduled_departure + timedelta(minutes=delay_minutes) if scheduled_departure else None,
                "predicted_delay_minutes": delay_minutes,
                "confidence_score": round(confidence, 3),
                "model_version": "eta-delay-rf-v1",
                "evidence": {
                    "target": "future station arrival delay",
                    "test_mae_minutes": test_mae,
                    "validation_residual_p90_minutes": residual_p90,
                    "factors": factors,
                    "current_station_code": self.stations[self.current_index].station.code,
                    "target_station_code": target.station.code,
                },
            }
        return results

    def predict_station(self, target: Any) -> dict[str, Any] | None:
        return self.predict_stations([target]).get(target.station.code)

    def predict(self) -> dict[str, Any] | None:
        upcoming = self.stations[self.current_index + 1 :]
        target = upcoming[-1] if upcoming else None
        if target is None:
            return None
        station_prediction = self.predict_station(target)
        if station_prediction is None:
            return None
        return {"train_number": self.train.train_number, **station_prediction}
