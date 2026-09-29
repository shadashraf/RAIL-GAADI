import asyncio
from contextlib import asynccontextmanager
from hmac import compare_digest
import logging
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from backend.api.v1.router import api_router
from backend.app.config import settings
from backend.database.init_db import init_db
from backend.services.live_sync_service import get_last_live_sync_status

logger = logging.getLogger("backend.request")

if not settings.is_development and settings.secret_key == "change-me-in-production":
    raise RuntimeError("SECRET_KEY must be changed before running in production")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    logger.info("Database schema initialized")
    try:
        yield
    except asyncio.CancelledError:
        logger.info("Application shutdown requested")
        raise
    finally:
        logger.info("Application shutdown complete")


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Backend for dynamic ETA and delay intelligence for coaching trains.",
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_host_list)


@app.middleware("http")
async def protect_api_and_log_requests(request: Request, call_next):
    started_at = time.perf_counter()
    if (
        settings.api_access_key
        and request.method != "OPTIONS"
        and request.url.path.startswith("/api/")
    ):
        provided_key = request.headers.get("X-API-Key", "")
        if not compare_digest(provided_key, settings.api_access_key):
            return JSONResponse(status_code=401, content={"detail": "Invalid or missing API key"})

    try:
        response = await call_next(request)
    except asyncio.CancelledError:
        logger.info("Request cancelled during server shutdown: %s %s", request.method, request.url.path)
        raise
    except Exception:
        logger.exception("Unhandled request failure: %s %s", request.method, request.url.path)
        raise
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if not settings.is_development:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    logger.info("%s %s -> %s (%.1f ms)", request.method, request.url.path, response.status_code, elapsed_ms)
    return response

app.include_router(api_router)


@app.get("/health")
def healthcheck() -> dict[str, str | int | bool | None]:
    last_sync = get_last_live_sync_status()
    return {
        "status": "ok",
        "app": settings.app_name,
        "env": settings.app_env,
        "live_sync_enabled": bool(settings.live_api_url),
        "live_sync_mode": "manual",
        "api_key_protection": bool(settings.api_access_key),
        "last_live_sync_success_at": last_sync["success_at"].isoformat()
        if last_sync["success_at"]
        else None,
        "last_live_sync_error": last_sync["error"],
    }
