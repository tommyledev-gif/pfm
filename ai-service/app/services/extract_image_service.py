"""POST /extract-image orchestration (specs/ai-chat-image-capture plan §3.5).

Provider-agnostic: vision_provider.py owns the SDK. This module adds the one
truncation retry (plan F40), validation (image_reading.py) and sizes-only
logging. ⚠️ Never log the image, the caption, the tool arguments or
str(exc) — a validation error's string echoes amounts and notes (plan F12).
"""

import logging

from fastapi.concurrency import run_in_threadpool

from app.core.config import settings
from app.schemas.extract_image_schema import ExtractImageRequest, ExtractImageResponse
from app.services.image_prompt_builder import build_image_system_prompt
from app.services.image_reading import InvalidImageReadingError, parse_image_reading
from app.services.vision_provider import (
    VisionBusyError,
    VisionResult,
    VisionTruncatedError,
    VisionUnavailableError,
    read_image,
)

logger = logging.getLogger(__name__)

# base64 carries 3 bytes in every 4 characters.
_BASE64_RATIO = 3 / 4


class ExtractImageUnavailableError(Exception):
    """The router maps this to 503; the Go Backend answers 502
    AI_SERVICE_UNAVAILABLE."""


async def extract_image(req: ExtractImageRequest) -> ExtractImageResponse:
    """Raises VisionBusyError (router → 429) or ExtractImageUnavailableError."""
    max_items = min(req.max_items, settings.vision_max_items)
    system_prompt = build_image_system_prompt(req.wallets, req.categories, req.now, max_items, req.read_lines)
    data_url = f"data:{req.mime_type};base64,{req.image_base64}"
    log_extra: dict[str, object] = {
        "model": settings.groq_vision_model,
        "image_bytes": int(len(req.image_base64) * _BASE64_RATIO),
        "retried": False,
    }

    try:
        result = await _read(system_prompt, req.caption, data_url, settings.vision_max_tokens)
    except VisionTruncatedError:
        log_extra["retried"] = True
        try:
            result = await _read(system_prompt, req.caption, data_url, settings.vision_retry_max_tokens)
        except VisionTruncatedError as exc:
            logger.warning("image reading cut off twice", extra={**log_extra, "error_type": "VisionTruncatedError"})
            raise ExtractImageUnavailableError from exc
        except VisionBusyError:
            logger.warning("image reading busy on retry", extra={**log_extra, "error_type": "VisionBusyError"})
            raise
        except VisionUnavailableError as exc:
            logger.warning("image reading failed on retry", extra={**log_extra, "error_type": _error_type(exc)})
            raise ExtractImageUnavailableError from exc
    except VisionBusyError as exc:
        logger.warning("image reading busy", extra={**log_extra, "retry_after_seconds": exc.retry_after_seconds})
        raise
    except VisionUnavailableError as exc:
        logger.warning("image reading failed", extra={**log_extra, "error_type": _error_type(exc)})
        raise ExtractImageUnavailableError from exc

    try:
        response = parse_image_reading(result.arguments, max_items)
    except InvalidImageReadingError as exc:
        logger.warning("image reading unusable", extra={**log_extra, "error_type": "InvalidImageReadingError"})
        raise ExtractImageUnavailableError from exc

    logger.info(
        "image reading completed",
        extra={
            **log_extra,
            "prompt_tokens": result.prompt_tokens,
            "completion_tokens": result.completion_tokens,
            "finish_reason": result.finish_reason,
            "items_count": len(response.transactions),
            "unread_count": response.unread_count,
            "truncated": response.truncated,
            "source_kind": response.source_kind,
        },
    )
    return response


def _error_type(exc: Exception) -> str:
    cause = exc.__cause__
    return type(cause).__name__ if cause is not None else type(exc).__name__


async def _read(system_prompt: str, caption: str | None, data_url: str, max_tokens: int) -> VisionResult:
    return await run_in_threadpool(read_image, system_prompt, caption, data_url, max_tokens)
