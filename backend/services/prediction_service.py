from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.models.prediction import Prediction
from backend.repositories.prediction_repository import PredictionRepository
from backend.repositories.train_repository import TrainRepository
from backend.services.ml_prediction_service import MLPredictionService


class PredictionService:
    def __init__(self, db: Session):
        self.db = db
        self.train_repository = TrainRepository(db)
        self.prediction_repository = PredictionRepository(db)

    def _eta_minutes_between(self, from_station, to_station, live_speed_kmph: float | None, segment_speed_kmph: float | None = None) -> float:
        distance_km = None
        if from_station.distance_from_source_km is not None and to_station.distance_from_source_km is not None:
            distance_km = max(to_station.distance_from_source_km - from_station.distance_from_source_km, 0)

        if distance_km is None or distance_km <= 0:
            return 25.0

        speed = live_speed_kmph or segment_speed_kmph or 45.0
        if speed <= 0:
            speed = 45.0
        return (distance_km / speed) * 60

    def _scheduled_dwell_minutes(self, station) -> float:
        if station.scheduled_arrival is None or station.scheduled_departure is None:
            return 0.0
        return max(0.0, (station.scheduled_departure - station.scheduled_arrival).total_seconds() / 60)

    def _generate_prediction(self, train) -> Prediction:
        stations = sorted(train.stations, key=lambda station: station.sequence_no)
        if not stations:
            raise ValueError("Train route is empty")

        latest_live_position = max(train.live_positions, key=lambda position: position.updated_at, default=None)
        current_code = latest_live_position.current_station_code if latest_live_position else None
        current_index = next((index for index, station in enumerate(stations) if station.station.code == current_code), 0)

        if current_index >= len(stations) - 1:
            raise ValueError("Train is either at destination or missing future route data")

        remaining_stations = stations[current_index + 1:]
        destination_station = stations[-1]
        now = datetime.utcnow()
        remaining_minutes = 0.0
        segment_speeds = {
            segment.from_station_code: segment.avg_speed_kmph
            for segment in train.route_segments
        }
        for segment_index, (current_station, next_station) in enumerate(zip(stations[current_index:], remaining_stations)):
            live_speed = latest_live_position.current_speed_kmph if latest_live_position and segment_index == 0 else None
            remaining_minutes += self._eta_minutes_between(
                current_station,
                next_station,
                live_speed,
                segment_speeds.get(current_station.station.code),
            )
            if next_station is not destination_station:
                remaining_minutes += self._scheduled_dwell_minutes(next_station)

        destination_arrival = destination_station.scheduled_arrival or destination_station.scheduled_departure
        predicted_arrival = now + timedelta(minutes=remaining_minutes)
        predicted_delay_minutes = 0.0
        if destination_arrival is not None:
            scheduled_minutes_from_now = (destination_arrival - now).total_seconds() / 60
            predicted_delay_minutes = max(0.0, remaining_minutes - max(scheduled_minutes_from_now, 0.0))

        latest_delay = max(train.delay_events, key=lambda event: event.event_time, default=None)
        if latest_delay is not None:
            predicted_delay_minutes = max(predicted_delay_minutes, float(latest_delay.delay_minutes or 0.0))

        has_distance = all(
            station.distance_from_source_km is not None
            for station in stations[current_index:]
        )
        confidence_score = 0.82 if latest_live_position and latest_live_position.current_speed_kmph and has_distance else 0.68

        prediction = Prediction(
            train_id=train.id,
            predicted_arrival=predicted_arrival,
            predicted_departure=now + timedelta(minutes=min(remaining_minutes, 25.0)),
            predicted_delay_minutes=predicted_delay_minutes,
            confidence_score=confidence_score,
            model_version="eta-v1.1",
        )
        try:
            self.db.add(prediction)
            self.db.commit()
        except SQLAlchemyError:
            self.db.rollback()
            raise
        self.db.refresh(prediction)
        return prediction

    def get_prediction_for_train(self, train_number: str) -> dict:
        train = self.train_repository.get_by_number(train_number)
        if train is None:
            raise ValueError(f"Train {train_number} not found")

        ml_prediction = MLPredictionService(train).predict()
        if ml_prediction and ml_prediction.get("status") == "ok":
            return ml_prediction

        prediction = self.prediction_repository.get_latest_for_train(train.id)
        if prediction is None:
            try:
                prediction = self._generate_prediction(train)
            except ValueError:
                return {
                    "train_number": train.train_number,
                    "status": "no_prediction",
                    "message": "Prediction not available yet.",
                }

        return {
            "train_number": train.train_number,
            "status": "ok",
            "prediction_source": "fallback",
            "is_fallback": True,
            "predicted_arrival": prediction.predicted_arrival,
            "predicted_departure": prediction.predicted_departure,
            "predicted_delay_minutes": prediction.predicted_delay_minutes,
            "confidence_score": prediction.confidence_score,
            "model_version": prediction.model_version,
            "evidence": {
                "target": "route and speed fallback",
                "message": "The trained model was unavailable or below its reliability threshold.",
            },
        }

    def get_eta_forecast(self, train_number: str) -> dict:
        train = self.train_repository.get_by_number(train_number)
        if train is None:
            raise ValueError(f"Train {train_number} not found")

        stations = sorted(train.stations, key=lambda station: station.sequence_no)
        if not stations:
            return {
                "train_number": train.train_number,
                "status": "no_route",
                "message": "No route data available for this train.",
            }

        latest_live = max(train.live_positions, key=lambda position: position.updated_at, default=None) if train.live_positions else None
        current_station = None
        if latest_live is not None and latest_live.current_station_code:
            current_station = next((station for station in stations if station.station.code == latest_live.current_station_code), None)
        if current_station is None:
            current_station = stations[0]

        current_index = stations.index(current_station)
        upcoming = stations[current_index + 1:] if current_index < len(stations) - 1 else []
        ml_service = MLPredictionService(train)
        ml_predictions = ml_service.predict_stations(upcoming)
        entries = []
        for idx, station in enumerate(upcoming):
            previous_station = stations[current_index + idx] if current_index + idx < len(stations) else current_station
            travel_minutes = self._eta_minutes_between(
                previous_station,
                station,
                latest_live.current_speed_kmph if latest_live and idx == 0 else None,
                next((segment.avg_speed_kmph for segment in train.route_segments if segment.from_station_code == previous_station.station.code and segment.to_station_code == station.station.code), None),
            )
            ml_station = ml_predictions.get(station.station.code)
            predicted_arrival = (
                ml_station["predicted_arrival"]
                if ml_station and ml_station.get("status") == "ok"
                else (datetime.utcnow() + timedelta(minutes=travel_minutes))
            )
            entries.append({
                "station_code": station.station.code,
                "station_name": station.station.name,
                "scheduled_arrival": station.scheduled_arrival,
                "predicted_arrival": predicted_arrival,
                "travel_minutes": round(travel_minutes, 1),
                "predicted_delay_minutes": ml_station.get("predicted_delay_minutes") if ml_station else None,
                "prediction_source": ml_station.get("prediction_source") if ml_station else "fallback",
                "is_fallback": not ml_station or ml_station.get("status") != "ok",
                "confidence_score": ml_station.get("confidence_score") if ml_station else None,
                "evidence": ml_station.get("evidence") if ml_station else {"message": "Route and speed fallback."},
            })

        return {
            "train_number": train.train_number,
            "status": "ok",
            "current_station_code": current_station.station.code,
            "current_station_name": current_station.station.name,
            "forecast": entries,
        }
