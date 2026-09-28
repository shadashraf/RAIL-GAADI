from __future__ import annotations

import argparse
import gc
import json
import math
from datetime import datetime
from json import JSONDecoder
from pathlib import Path
from typing import Any, Iterator

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

NUMERIC_FEATURES = [
    "current_delay_minutes",
    "current_speed_kmph",
    "train_avg_speed_kmph",
    "remaining_distance_km",
    "target_distance_km",
    "route_progress",
    "scheduled_hour",
    "scheduled_weekday",
    "target_dwell_minutes",
    "route_station_count",
]
CATEGORICAL_FEATURES = ["train_number", "current_station_code", "target_station_code"]
FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
MAX_REASONABLE_DELAY_MINUTES = 30 * 24


def iter_snapshots(path: Path) -> Iterator[dict[str, Any]]:
    """Yield concatenated JSON objects from one file at a time."""
    decoder = JSONDecoder()
    text = path.read_text(encoding="utf-8")
    position = 0
    try:
        while position < len(text):
            while position < len(text) and text[position].isspace():
                position += 1
            start = text.find("{", position)
            if start < 0:
                return
            try:
                payload, position = decoder.raw_decode(text, start)
            except json.JSONDecodeError:
                position = start + 1
                continue
            if isinstance(payload, dict):
                yield payload
    finally:
        del text


def parse_time(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


def number(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def build_rows(data_dir: Path) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for path in sorted(data_dir.iterdir()):
        if path.suffix.lower() != ".json":
            continue
        for raw in iter_snapshots(path):
            data = raw.get("data", raw)
            train = data.get("train", {})
            train_number = str(data.get("trainNumber") or train.get("number") or "").strip()
            snapshot_time = parse_time(data.get("lastUpdatedAt") or data.get("updated_at"))
            route = data.get("route") or []
            current_location = data.get("currentLocation") or data.get("live_position") or {}
            live_code = str(current_location.get("stationCode") or current_location.get("current_station_code") or "").strip()
            if not train_number or snapshot_time is None:
                continue

            destination_distance = number(route[-1].get("distance")) if route else None
            current_speed = number(current_location.get("speedKmph") or current_location.get("current_speed_kmph"))
            avg_speed = number(train.get("avgSpeed"))
            route_count = len(route)
            for target_index, station in enumerate(route[1:], start=1):
                current_station = route[target_index - 1]
                current_code = str(current_station.get("stationCode") or "").strip()
                target_code = str(station.get("stationCode") or "").strip()
                target_delay = number(station.get("delayArrival"))
                scheduled = parse_time(station.get("scheduledArrival"))
                if not target_code or target_delay is None or scheduled is None:
                    continue
                if abs(target_delay) > MAX_REASONABLE_DELAY_MINUTES:
                    continue
                key = (train_number, snapshot_time.isoformat(), target_code)
                if key in seen:
                    continue
                seen.add(key)
                current_distance = number(current_station.get("distance"))
                current_delay = number(
                    current_station.get("delayDeparture")
                    or current_station.get("delayArrival")
                    or data.get("delayMinutes")
                    or data.get("delay_minutes")
                )
                target_distance = number(station.get("distance"))
                dwell_arrival = parse_time(station.get("scheduledArrival"))
                dwell_departure = parse_time(station.get("scheduledDeparture"))
                dwell = (dwell_departure - dwell_arrival).total_seconds() / 60 if dwell_arrival and dwell_departure else 0.0
                rows.append({
                    "snapshot_time": snapshot_time,
                    "target_delay_minutes": target_delay,
                    "current_delay_minutes": current_delay,
                    "current_speed_kmph": current_speed if current_code == live_code else number(current_station.get("speedToNextStationKmph")),
                    "train_avg_speed_kmph": avg_speed,
                    "remaining_distance_km": max((destination_distance or 0) - (current_distance or 0), 0),
                    "target_distance_km": target_distance,
                    "route_progress": target_index / max(route_count - 1, 1),
                    "scheduled_hour": scheduled.hour + scheduled.minute / 60,
                    "scheduled_weekday": scheduled.weekday(),
                    "target_dwell_minutes": max(dwell, 0),
                    "route_station_count": route_count,
                    "train_number": train_number,
                    "current_station_code": current_code,
                    "target_station_code": target_code,
                })
        del path
        gc.collect()
    return pd.DataFrame(rows)


def make_pipeline() -> Pipeline:
    numeric = Pipeline([("imputer", SimpleImputer(strategy="median"))])
    categorical = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore")),
    ])
    preprocessor = ColumnTransformer([
        ("numeric", numeric, NUMERIC_FEATURES),
        ("categorical", categorical, CATEGORICAL_FEATURES),
    ])
    model = RandomForestRegressor(
        n_estimators=180,
        max_depth=22,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    return Pipeline([("preprocessor", preprocessor), ("model", model)])


def evaluate(model: Pipeline, features: pd.DataFrame, target: pd.Series) -> dict[str, float]:
    prediction = model.predict(features)
    return {
        "mae_minutes": round(float(mean_absolute_error(target, prediction)), 3),
        "rmse_minutes": round(float(mean_squared_error(target, prediction) ** 0.5), 3),
        "samples": int(len(target)),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the production ETA delay model from raw train snapshots.")
    parser.add_argument("--data-dir", type=Path, default=Path("data/raw"))
    parser.add_argument("--output", type=Path, default=Path("ml/models/eta_delay_model.joblib"))
    args = parser.parse_args()

    frame = build_rows(args.data_dir)
    if len(frame) < 100:
        raise RuntimeError(f"Only {len(frame)} usable rows found; refusing to train an unreliable model.")
    frame = frame.sort_values("snapshot_time").reset_index(drop=True)
    unique_times = frame["snapshot_time"].drop_duplicates().sort_values().tolist()
    train_cut = unique_times[max(1, int(len(unique_times) * 0.70) - 1)]
    validation_cut = unique_times[max(1, int(len(unique_times) * 0.85) - 1)]
    train_frame = frame[frame["snapshot_time"] <= train_cut]
    validation_frame = frame[(frame["snapshot_time"] > train_cut) & (frame["snapshot_time"] <= validation_cut)]
    test_frame = frame[frame["snapshot_time"] > validation_cut]
    if min(len(train_frame), len(validation_frame), len(test_frame)) < 10:
        raise RuntimeError("Chronological split does not contain enough samples in every partition.")

    x_train = train_frame[FEATURES]
    y_train = train_frame["target_delay_minutes"]
    q1, q3 = y_train.quantile([0.01, 0.99])
    clipped_train = y_train.clip(lower=q1, upper=q3)
    model = make_pipeline()
    model.fit(x_train, clipped_train)
    metrics = {
        "train": evaluate(model, x_train, y_train),
        "validation": evaluate(model, validation_frame[FEATURES], validation_frame["target_delay_minutes"]),
        "test": evaluate(model, test_frame[FEATURES], test_frame["target_delay_minutes"]),
    }
    validation_residual = np.abs(validation_frame["target_delay_minutes"] - model.predict(validation_frame[FEATURES]))
    transformed_names = model.named_steps["preprocessor"].get_feature_names_out().tolist()
    importances = model.named_steps["model"].feature_importances_
    top_factors = sorted(zip(transformed_names, importances), key=lambda item: item[1], reverse=True)[:12]
    artifact = {
        "pipeline": model,
        "features": FEATURES,
        "metrics": metrics,
        "residual_p90_minutes": float(np.quantile(validation_residual, 0.90)),
        "target": "future station arrival delay in minutes",
        "split": {
            "train_through": train_cut.isoformat(),
            "validation_through": validation_cut.isoformat(),
            "train_rows": len(train_frame),
            "validation_rows": len(validation_frame),
            "test_rows": len(test_frame),
        },
        "top_factors": [{"feature": name, "importance": round(float(value), 6)} for name, value in top_factors],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, args.output)
    metrics_path = args.output.with_suffix(".metrics.json")
    metrics_path.write_text(json.dumps({k: v for k, v in artifact.items() if k != "pipeline"}, indent=2, default=str), encoding="utf-8")
    print(json.dumps({"rows": len(frame), "metrics": metrics, "artifact": str(args.output), "metrics_file": str(metrics_path)}, indent=2))


if __name__ == "__main__":
    main()
