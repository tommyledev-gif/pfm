"""Pydantic v2 request/response schemas for POST /suggest-category-name.

Field-for-field mirror of the Go Backend's wire types
(backend/internal/service/ai_budget_client.go's aiBudgetWireRequest/
aiBudgetWireResponse) — keep the two in sync by hand if either side changes,
same convention as extract_schema.py.

No BudgetPreference/BudgetProposalRequest/Response exist on the Python side
at all — the allocation-proposal math runs entirely in the Go Backend
(specs/ai-budget-wizard/plan.md Finding #6); this is the only wizard-adjacent
endpoint that is actually AI-Service-backed.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CategorySuggestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str = Field(min_length=1, max_length=200)


class CategorySuggestionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    suggested_name: str
    type: Literal["income", "expense"]
    icon: str
