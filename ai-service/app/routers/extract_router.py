from fastapi import APIRouter, HTTPException

from app.schemas.extract_schema import ExtractRequest, ExtractResponse
from app.services.extract_service import ExtractionUnavailableError, extract_transactions

router = APIRouter(tags=["extract"])


@router.post("/extract", response_model=ExtractResponse, status_code=200)
async def extract(req: ExtractRequest) -> ExtractResponse:
    try:
        return await extract_transactions(req)
    except ExtractionUnavailableError as exc:
        # Groq and Anthropic both failed — the Go Backend's AIServiceClient
        # turns any non-200 status into 502 AI_SERVICE_UNAVAILABLE
        # (specs/ai-chat-assistant/spec.md S-AI-10). 503, not 500 — this is
        # the AI Service itself reporting it cannot currently serve the
        # request, not an unexpected internal bug.
        raise HTTPException(status_code=503, detail="ai extraction temporarily unavailable") from exc
