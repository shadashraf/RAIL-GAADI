from fastapi import APIRouter

from backend.api.v1.delays import router as delays_router
from backend.api.v1.analytics import router as analytics_router
from backend.api.v1.live import router as live_router
from backend.api.v1.network import router as network_router
from backend.api.v1.predictions import router as predictions_router
from backend.api.v1.trains import router as trains_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(trains_router)
api_router.include_router(live_router)
api_router.include_router(predictions_router)
api_router.include_router(delays_router)
api_router.include_router(analytics_router)
api_router.include_router(network_router)
