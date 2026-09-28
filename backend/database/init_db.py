from sqlalchemy import inspect, text

from backend.database.engine import Base, engine


def init_db() -> None:
    """Create all database tables for the current model metadata."""
    Base.metadata.create_all(bind=engine)
    columns = {column["name"] for column in inspect(engine).get_columns("train_stations")}
    if "is_halt" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE train_stations ADD COLUMN is_halt BOOLEAN NOT NULL DEFAULT 0"))
