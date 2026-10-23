package service

import (
	"context"
	"time"
)

// aiBudgetClientRequestTimeout bounds a single call to the AI Service's
// suggest-category-name endpoint — a single Groq-primary/Anthropic-fallback
// call, same reasoning as aiServiceRequestTimeout.
const aiBudgetClientRequestTimeout = 15 * time.Second

// AISuggestCategoryNameResponse is BudgetWizardService's view of the AI
// Service's suggestion — Type is "income"|"expense", mirroring
// model.CategoryType's string values (specs/ai-budget-wizard/spec.md US-05
// internal-helper subsection).
type AISuggestCategoryNameResponse struct {
	SuggestedName string
	Type          string
	Icon          string
}

// httpAIBudgetClient is the real AIBudgetClient implementation — a thin HTTP
// client over the internal-only AI Service, same convention as
// httpAIServiceClient (POST {baseURL}/suggest-category-name, never a
// host-mapped port).
type httpAIBudgetClient struct {
	http aiHTTP
}

func NewHTTPAIBudgetClient(endpoint AIServiceEndpoint) *httpAIBudgetClient {
	return &httpAIBudgetClient{http: newAIHTTP(endpoint, aiBudgetClientRequestTimeout)}
}

// Wire-level request/response shapes — field-for-field with the AI Service's
// Pydantic schemas (ai-service/app/schemas/budget_schema.py). Never exposed
// outside this file.
type aiBudgetWireRequest struct {
	Description string `json:"description"`
}

type aiBudgetWireResponse struct {
	SuggestedName string `json:"suggested_name"`
	Type          string `json:"type"`
	Icon          string `json:"icon"`
}

// SuggestCategoryName calls the AI Service's /suggest-category-name endpoint.
// Any transport failure, non-200 status, or malformed response body is
// returned as a plain error — BudgetWizardService wraps it as
// common.ErrAIServiceUnavailable, never propagating the raw error to the
// client (specs/ai-budget-wizard/spec.md US-05 internal-helper subsection).
func (c *httpAIBudgetClient) SuggestCategoryName(ctx context.Context, description string) (*AISuggestCategoryNameResponse, error) {
	var wireResp aiBudgetWireResponse
	if err := c.http.postJSON(ctx, "ai_budget_client.SuggestCategoryName", "/suggest-category-name", aiBudgetWireRequest{Description: description}, &wireResp); err != nil {
		return nil, err
	}
	return &AISuggestCategoryNameResponse{
		SuggestedName: wireResp.SuggestedName,
		Type:          wireResp.Type,
		Icon:          wireResp.Icon,
	}, nil
}
