"""Groq-primary, Anthropic-fallback category-name/icon suggestion for
POST /suggest-category-name (specs/ai-budget-wizard/spec.md US-03 Step 2B /
US-05 internal-helper subsection).

Same tool/function-calling approach as extract_service.py, through the shared
llm_tools.py / llm_fallback.py (max_tokens always explicit, only lengths,
token counts and error type/code logged, never a raw LLM error as a 500 to
the Go Backend). CategorySuggestionResponse has no nested models, so no
$ref-dereference step is needed here.
"""

from app.core.config import settings
from app.core.groq_client import get_anthropic_client, get_groq_client
from app.schemas.budget_schema import CategorySuggestionResponse
from app.services.llm_fallback import LLMUnavailableError, run_with_fallback
from app.services.llm_tools import ToolSpec, anthropic_tool_arguments, groq_tool_arguments

_TOOL_NAME = "suggest_category"
_TOOL_DESCRIPTION = "Suggest a display name, type, and emoji icon for a personal-finance spending category described in Vietnamese free text."
_LOG_LABEL = "category suggestion"

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
    try:
        return await run_with_fallback(
            lambda: _call_groq(description),
            lambda: _call_anthropic(description),
            operation=_LOG_LABEL,
            prompt_chars=len(description),
        )
    except LLMUnavailableError as exc:
        raise CategorySuggestionUnavailableError from exc


def _tool() -> ToolSpec:
    return ToolSpec(name=_TOOL_NAME, description=_TOOL_DESCRIPTION, schema=CategorySuggestionResponse.model_json_schema())


def _call_groq(description: str) -> CategorySuggestionResponse:
    arguments = groq_tool_arguments(
        get_groq_client(),
        model=settings.groq_model,
        tool=_tool(),
        system_prompt=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": description}],
        max_tokens=settings.max_tokens,
        temperature=settings.temperature,
        log_label=_LOG_LABEL,
        prompt_chars=len(description),
    )
    return CategorySuggestionResponse.model_validate(arguments)


def _call_anthropic(description: str) -> CategorySuggestionResponse:
    arguments = anthropic_tool_arguments(
        get_anthropic_client(),
        model=settings.anthropic_model,
        tool=_tool(),
        system_prompt=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": description}],
        max_tokens=settings.max_tokens,
        log_label=_LOG_LABEL,
        prompt_chars=len(description),
    )
    return CategorySuggestionResponse.model_validate(arguments)
