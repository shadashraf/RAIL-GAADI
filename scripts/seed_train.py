from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

from backend.database.init_db import init_db
from backend.database.session import SessionLocal
from backend.services.seed_service import ingest_train_snapshots, load_payload_snapshots, normalize_train_payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed a raw train JSON payload into SQLite.")
    parser.add_argument("payload", type=Path, help="Path to a raw train JSON file")
    args = parser.parse_args()

    snapshots = load_payload_snapshots(args.payload)
    if not snapshots:
        raise ValueError(f"No JSON payloads found in {args.payload}")

    def snapshot_time(payload: dict) -> datetime:
        value = payload.get("data", payload).get("lastUpdatedAt")
        return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else datetime.min

    payload = max(snapshots, key=snapshot_time)
    normalized = normalize_train_payload(payload)

    init_db()
    with SessionLocal() as db:
        train = ingest_train_snapshots(db, snapshots)
        print(f"Seeded train {train.train_number}: {train.name}")
        print(f"Snapshots read: {len(snapshots)}; selected: {normalized['train_number']}")
        print(f"Stations: {len(train.stations)}; route segments: {len(train.route_segments)}")
        print(f"Live positions: {len(train.live_positions)}; delay events: {len(train.delay_events)}")


if __name__ == "__main__":
    main()
