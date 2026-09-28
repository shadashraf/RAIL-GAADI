from __future__ import annotations

import json
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parents[2]
SAMPLES_DIR = BASE_DIR / "data" / "samples"


def load_sample_json(filename: str) -> dict[str, Any]:
    path = SAMPLES_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Sample data not found: {path}")

    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_train_13024_sample() -> dict[str, Any]:
    return load_sample_json("train_13024_sample.json")


def load_delay_reason_rules() -> dict[str, Any]:
    return load_sample_json("delay_reason_v1_rules.json")
