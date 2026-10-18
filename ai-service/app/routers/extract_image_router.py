from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.schemas.extract_image_schema import ExtractImageBusyResponse, ExtractImageRequest, ExtractImageResponse
from app.services.extract_image_service import ExtractImageUnavailableError, extract_image
from app.services.vision_provider import VisionBusyError

router = APIRouter(tags=["extract-image"])

_HTTP_TOO_MANY_REQUESTS = 429


@router.post("/extract-image", response_model=ExtractImageResponse, status_code=200)
async def extract_image_route(req: ExtractImageRequest) -> ExtractImageResponse | JSONResponse:
    try:
        return await extract_image(req)
    except VisionBusyError as exc:
        # The Go Backend maps this to 503 AI_IMAGE_BUSY with the wait time
        # (specs/ai-chat-image-capture plan F34, spec BR-19).
        body = ExtractImageBusyResponse(retry_after_seconds=exc.retry_after_seconds)
        return JSONResponse(status_code=_HTTP_TOO_MANY_REQUESTS, content=body.model_dump())
    except ExtractImageUnavailableError as exc:
        raise HTTPException(status_code=503, detail="image reading temporarily unavailable") from exc
