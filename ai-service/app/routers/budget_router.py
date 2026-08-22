from fastapi import APIRouter, HTTPException

from app.schemas.budget_schema import CategorySuggestionRequest, CategorySuggestionResponse
from app.services.category_suggestion_service import CategorySuggestionUnavailableError, suggest_category

router = APIRouter(tags=["budget-wizard"])


@router.post("/suggest-category-name", response_model=CategorySuggestionResponse, status_code=200)
async def suggest_category_name(req: CategorySuggestionRequest) -> CategorySuggestionResponse:
    try:
        return await suggest_category(req.description)
    except CategorySuggestionUnavailableError as exc:
        # Groq and Anthropic both failed — the Go Backend's AIBudgetClient
        # turns any non-200 status into 502 AI_SERVICE_UNAVAILABLE
        # (specs/ai-budget-wizard/spec.md US-05 internal-helper subsection).
        raise HTTPException(status_code=503, detail="category suggestion temporarily unavailable") from exc
