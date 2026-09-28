from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.dependencies import get_db
from backend.services.network_condition_service import NetworkConditionService

router = APIRouter(prefix="/network", tags=["network"])


@router.get("/trains/{train_number}/conditions")
def get_train_network_conditions(train_number: str, db: Session = Depends(get_db)) -> dict:
    """Return signal, congestion, weather, and route-density intelligence."""
    service = NetworkConditionService(db)
    try:
        return service.get_train_network_conditions(train_number)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
