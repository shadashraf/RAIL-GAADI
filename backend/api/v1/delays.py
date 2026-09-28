from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.dependencies import get_db
from backend.services.delay_service import DelayService

router = APIRouter(prefix="/delays", tags=["delays"])


@router.get("/trains/{train_number}")
def get_delay_summary(train_number: str, db: Session = Depends(get_db)) -> dict:
    """Return the current delay summary for a train."""
    service = DelayService(db)
    try:
        return service.get_delay_summary(train_number)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/trains/{train_number}/reasons")
def get_delay_reasons(train_number: str, db: Session = Depends(get_db)) -> dict:
    """Return the current delay reason and confidence payload."""
    service = DelayService(db)
    try:
        return service.get_delay_summary(train_number)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
