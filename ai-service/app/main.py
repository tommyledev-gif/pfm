"""FastAPI entrypoint — Phase 0 (health check) + Phase 1 (POST /extract) of
the AI Service roadmap (docs/features.md §6), scaffolded for
specs/ai-chat-assistant (Feature-12 US-01)."""

from fastapi import FastAPI

from app.core.logging import configure_logging
from app.routers import budget_router, extract_router

configure_logging()

app = FastAPI(title="PFM AI Service")

app.include_router(extract_router.router)
app.include_router(budget_router.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
