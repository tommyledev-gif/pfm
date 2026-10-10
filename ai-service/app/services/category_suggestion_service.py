"""Groq-primary, Anthropic-fallback category-name/icon suggestion for
POST /suggest-category-name (specs/ai-budget-wizard/spec.md US-03 Step 2B /
US-05 internal-helper subsection).

Same tool/function-calling approach as extract_service.py (dev.md LLM Rules:
max_tokens always explicit, log only prompt length/token counts and the
failure type/message, never raw prompt content, wrap every SDK call in
try/except, never let a raw LLM error propagate as a 500 to the Go Backend).
CategorySuggestionResponse has no nested models, so no $ref-dereference step
is needed here (unlike ExtractResponse.transactions).
"""

import json
import logging

from fastapi.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.groq_client import get_anthropic_client, get_groq_client
from app.schemas.budget_schema import CategorySuggestionResponse

logger = logging.getLogger(__name__)

_TOOL_NAME = "suggest_category"
_TOOL_DESCRIPTION = "Suggest a display name, type, and emoji icon for a personal-finance spending category described in Vietnamese free text."

_SYSTEM_PROMPT = """Bạn là trợ lý gợi ý tên danh mục chi tiêu cho ứng dụng quản lý tài chính cá nhân PFM.
Người dùng sẽ mô tả một danh mục chi tiêu bằng văn bản tự do bằng tiếng Việt (ví dụ: "tiền đi chơi với người yêu").

Quy tắc bắt buộc:
1. Luôn trả về đúng schema JSON đã cho — không trả lời văn bản thuần.
2. suggested_name phải ngắn gọn (dưới 30 ký tự), tiếng Việt, phù hợp để hiển thị làm tên danh mục.
3. type phải là "income" nếu mô tả rõ ràng là một nguồn thu nhập, ngược lại mặc định là "expense" — \
hầu hết mô tả người dùng nhập vào bước này là danh mục chi tiêu.
4. icon phải là DUY NHẤT một emoji phù hợp với ý nghĩa của danh mục — không dùng text, không dùng nhiều emoji."""


class CategorySuggestionUnavailableError(Exception):
    """Raised when both Groq and Anthropic fail — the router maps this to a
    503, which the Go Backend's AIBudgetClient turns into 502
    AI_SERVICE_UNAVAILABLE (specs/ai-budget-wizard/spec.md US-05
    internal-helper subsection)."""


async def suggest_category(description: str) -> CategorySuggestionResponse:
    # Synchronous SDK calls run off the event loop (see extract_service.py).
    try:
        return await run_in_threadpool(_call_groq, description)
    except Exception as exc:  # noqa: BLE001 - any Groq failure falls back, never propagates raw
        logger.warning(
            "groq category suggestion failed, falling back to anthropic",
            extra={"prompt_chars": len(description), "error_type": type(exc).__name__, "error": str(exc)},
        )
        try:
            return await run_in_threadpool(_call_anthropic, description)
        except Exception as fallback_exc:  # noqa: BLE001
            logger.error(
                "anthropic fallback also failed",
                extra={
                    "prompt_chars": len(description),
                    "error_type": type(fallback_exc).__name__,
                    "error": str(fallback_exc),
                },
            )
            raise CategorySuggestionUnavailableError from fallback_exc


def _tool_schema() -> dict:
    return CategorySuggestionResponse.model_json_schema()


def _call_groq(description: str) -> CategorySuggestionResponse:
    client = get_groq_client()
    tool = {
        "type": "function",
        "function": {"name": _TOOL_NAME, "description": _TOOL_DESCRIPTION, "parameters": _tool_schema()},
    }
    completion = client.chat.completions.create(
        model=settings.groq_model,
        max_tokens=settings.max_tokens,
        temperature=settings.temperature,
        tools=[tool],
        tool_choice={"type": "function", "function": {"name": _TOOL_NAME}},
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": description},
        ],
    )
    tool_calls = completion.choices[0].message.tool_calls
    if not tool_calls:
        raise ValueError("groq response contained no tool call")
    completion_tokens = completion.usage.completion_tokens if completion.usage else None
    logger.info("groq category suggestion completed", extra={"prompt_chars": len(description), "completion_tokens": completion_tokens})
    return CategorySuggestionResponse.model_validate(json.loads(tool_calls[0].function.arguments))


def _call_anthropic(description: str) -> CategorySuggestionResponse:
    client = get_anthropic_client()
    tool = {"name": _TOOL_NAME, "description": _TOOL_DESCRIPTION, "input_schema": _tool_schema()}
    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=settings.max_tokens,
        temperature=settings.temperature,
        system=_SYSTEM_PROMPT,
        tools=[tool],
        tool_choice={"type": "tool", "name": _TOOL_NAME},
        messages=[{"role": "user", "content": description}],
    )
    tool_use_blocks = [block for block in response.content if block.type == "tool_use"]
    if not tool_use_blocks:
        raise ValueError("anthropic response contained no tool_use block")
    logger.info("anthropic fallback completed", extra={"prompt_chars": len(description)})
    return CategorySuggestionResponse.model_validate(tool_use_blocks[0].input)
