"""FastAPI entrypoint — Phase 0 (health check) + Phase 1 (POST /extract) of
the AI Service roadmap (docs/features.md §6), scaffolded for
specs/ai-chat-assistant (Feature-12 US-01).

Every route but /health requires the backend's internal token
(app/core/security.py), and the API docs are off unless
AI_SERVICE_EXPOSE_DOCS is set (specs/security-hardening-2026-10 US-07).
"""

import logging

from fastapi import Depends, FastAPI

from app.core.config import settings
from app.core.logging import configure_logging
from app.core.security import verify_internal_token
from app.routers import budget_router, consult_router, extract_image_router, extract_router

configure_logging()
logger = logging.getLogger(__name__)

_docs = settings.ai_service_expose_docs
app = FastAPI(
    title="PFM AI Service",
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)

_internal_only = [Depends(verify_internal_token)]
app.include_router(extract_router.router, dependencies=_internal_only)
app.include_router(budget_router.router, dependencies=_internal_only)
app.include_router(consult_router.router, dependencies=_internal_only)
app.include_router(extract_image_router.router, dependencies=_internal_only)

if not settings.ai_service_token:
    logger.warning("AI_SERVICE_TOKEN not set: every route accepts calls without the internal token")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
