package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
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
	baseURL string
	client  *http.Client
}

func NewHTTPAIBudgetClient(baseURL string) *httpAIBudgetClient {
	return &httpAIBudgetClient{
		baseURL: baseURL,
		client:  &http.Client{Timeout: aiBudgetClientRequestTimeout},
	}
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
	if c.baseURL == "" {
		return nil, fmt.Errorf("ai_budget_client.SuggestCategoryName: AI_SERVICE_URL not configured")
	}

	body, err := json.Marshal(aiBudgetWireRequest{Description: description})
	if err != nil {
		return nil, fmt.Errorf("ai_budget_client.SuggestCategoryName: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/suggest-category-name", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("ai_budget_client.SuggestCategoryName: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ai_budget_client.SuggestCategoryName: %w", err)
	}
	defer resp.Body.Close() //nolint:errcheck // best-effort close, response already read

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ai_budget_client.SuggestCategoryName: unexpected status %d", resp.StatusCode)
	}

	var wireResp aiBudgetWireResponse
	if err := json.NewDecoder(resp.Body).Decode(&wireResp); err != nil {
		return nil, fmt.Errorf("ai_budget_client.SuggestCategoryName: %w", err)
	}
	return &AISuggestCategoryNameResponse{
		SuggestedName: wireResp.SuggestedName,
		Type:          wireResp.Type,
		Icon:          wireResp.Icon,
	}, nil
}
