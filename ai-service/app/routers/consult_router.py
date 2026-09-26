from fastapi import APIRouter, HTTPException

from app.schemas.consult_schema import ConsultRequest, ConsultResponse
from app.services.consult_service import ConsultUnavailableError, consult

router = APIRouter(tags=["consult"])


@router.post("/consult", response_model=ConsultResponse, status_code=200)
async def consult_question(req: ConsultRequest) -> ConsultResponse:
    try:
        return await consult(req)
    except ConsultUnavailableError as exc:
        # The Go backend turns any non-200 into a degraded reply with
        # suggestion chips (specs/ai-chat-query-spending/spec.md S-AIQ-40).
        raise HTTPException(status_code=503, detail="consult interpretation temporarily unavailable") from exc
