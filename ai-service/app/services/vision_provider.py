"""The only module that knows which provider reads images
(specs/ai-chat-image-capture plan §3.5, F41). Swapping providers later
touches this file and config.py only — extract_image_service.py sees three
typed errors and a VisionResult, never an SDK type.

Forced tool call against ImageReading's own JSON schema (project LLM rule).
If Phase 0 ever forces strict json_schema instead (plan F33), only
read_image() changes.
"""

import json
import math
from dataclasses import dataclass

import groq

from app.core.config import settings
from app.core.groq_client import get_groq_vision_client
from app.schemas.extract_image_schema import ImageReading, require_every_field
from app.services.extract_service import _dereference_schema
from app.services.image_prompt_builder import TOOL_DESCRIPTION, TOOL_NAME

_TOOL_USE_FAILED = "tool_use_failed"
_FINISH_LENGTH = "length"


class VisionBusyError(Exception):
    """The provider's shared capacity is used up (HTTP 429). Never retried
    here (spec BR-19)."""

    def __init__(self, retry_after_seconds: int | None) -> None:
        super().__init__("vision provider busy")
        self.retry_after_seconds = retry_after_seconds


class VisionTruncatedError(Exception):
    """The answer was cut off before the tool call was complete."""


class VisionUnavailableError(Exception):
    """Timeout, outage, withdrawn model, auth failure or unusable output."""


@dataclass(frozen=True)
class VisionResult:
    arguments: object
    prompt_tokens: int | None
    completion_tokens: int | None
    finish_reason: str | None


def read_image(system_prompt: str, caption: str | None, image_data_url: str, max_tokens: int) -> VisionResult:
    tool = {
        "type": "function",
        "function": {"name": TOOL_NAME, "description": TOOL_DESCRIPTION, "parameters": _tool_schema()},
    }
    try:
        completion = get_groq_vision_client().chat.completions.create(
            model=settings.groq_vision_model,
            temperature=settings.temperature,
            max_tokens=max_tokens,
            reasoning_effort=settings.groq_vision_reasoning_effort,
            tools=[tool],
            tool_choice={"type": "function", "function": {"name": TOOL_NAME}},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": [
                    {"type": "text", "text": _caption_text(caption)},
                    {"type": "image_url", "image_url": {"url": image_data_url}},
                ]},
            ],
        )
    except groq.RateLimitError as exc:
        raise VisionBusyError(_retry_after_seconds(exc)) from exc
    except groq.BadRequestError as exc:
        if _provider_error_code(exc) == _TOOL_USE_FAILED:
            raise VisionTruncatedError from exc
        raise VisionUnavailableError from exc
    except Exception as exc:  # noqa: BLE001 - every other provider failure is "unavailable", never raw
        raise VisionUnavailableError from exc

    choice = completion.choices[0]
    usage = completion.usage
    if choice.finish_reason == _FINISH_LENGTH:
        raise VisionTruncatedError
    tool_calls = choice.message.tool_calls or []
    if not tool_calls:
        raise VisionUnavailableError("no tool call")
    try:
        arguments = json.loads(tool_calls[0].function.arguments)
    except json.JSONDecodeError as exc:
        raise VisionUnavailableError("tool arguments are not JSON") from exc
    return VisionResult(
        arguments=arguments,
        prompt_tokens=usage.prompt_tokens if usage else None,
        completion_tokens=usage.completion_tokens if usage else None,
        finish_reason=choice.finish_reason,
    )


def _tool_schema() -> dict:
    return require_every_field(_dereference_schema(ImageReading.model_json_schema()))


def _caption_text(caption: str | None) -> str:
    # The caption is untrusted User text; the system prompt's rule 1 limits
    # it to naming a Wallet (spec BR-20).
    return f"Chú thích của người dùng: {caption}" if caption else "Chú thích của người dùng: (không có)"


def _retry_after_seconds(exc: groq.RateLimitError) -> int | None:
    value = exc.response.headers.get("retry-after") if exc.response is not None else None
    try:
        return max(0, math.ceil(float(value))) if value is not None else None
    except ValueError:
        return None


def _provider_error_code(exc: Exception) -> str | None:
    """Only Groq's error code — the body's failed_generation echoes the model's
    reading of the image and must never reach a log."""
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        error = body.get("error", body)
        if isinstance(error, dict):
            return error.get("code")
    return None
