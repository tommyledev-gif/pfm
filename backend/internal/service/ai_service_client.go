package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// aiServiceRequestTimeout bounds a single call to the AI Service — Groq
// primary + one Anthropic fallback attempt both happen inside that one call
// (ai-service/app/services/extract_service.py), so this must comfortably
// cover two LLM round-trips.
const aiServiceRequestTimeout = 15 * time.Second

// AIWalletContext/AICategoryContext are the caller's own Wallets/Categories,
// injected as context for the AI Service to resolve against — never another
// user's (specs/ai-chat-assistant/spec.md Main Flow step 3).
type AIWalletContext struct {
	ID        uuid.UUID
	Name      string
	IsDefault bool
	Currency  string
}

type AICategoryContext struct {
	ID   uuid.UUID
	Name string
	Type string
}

// AIChatTurn is one prior message in the conversation, given to the AI
// Service as context so a short follow-up ("20k" after "mua cà phê ở
// highlands") can be disambiguated using what was already said instead of
// being judged in isolation. Role is "user" or "assistant" — mirrors
// model.ChatRole's own string values.
type AIChatTurn struct {
	Role    string
	Content string
}

type AIExtractRequest struct {
	Message    string
	History    []AIChatTurn
	Wallets    []AIWalletContext
	Categories []AICategoryContext
	Now        time.Time
}

// AIProposedTransaction's CategoryID/WalletID are raw strings, not uuid.UUID
// — the AI Service is untrusted input (specs/ai-chat-assistant/spec.md
// Resolved design decision #4); a malformed or hallucinated ID is ChatService's
// job to detect and drop, not this client's job to reject as a transport error.
type AIProposedTransaction struct {
	AmountVND  int64
	TxType     string
	CategoryID string
	WalletID   *string
	Note       *string
	OccurredAt string // YYYY-MM-DD, parsed by ChatService
	Confidence float64
}

// AIExtractResponse.Intent is "create_transaction" or "ambiguous" for
// Feature-12's original scope (spec.md Resolved design decision #2), plus
// "budget_wizard" (specs/ai-budget-wizard/spec.md US-02, BWZ-T13) — the
// Python service never returns edit_transaction/query_spending/
// general_advice here.
type AIExtractResponse struct {
	Intent       string
	Transactions []AIProposedTransaction
}

// httpAIServiceClient is the real AIServiceClient implementation — a thin
// HTTP client over the internal-only AI Service (specs/ai-chat-assistant/
// plan.md Finding #1: POST {baseURL}/extract, reachable only on the internal
// Docker network, never a host-mapped port).
type httpAIServiceClient struct {
	baseURL string
	client  *http.Client
}

func NewHTTPAIServiceClient(baseURL string) *httpAIServiceClient {
	return &httpAIServiceClient{
		baseURL: baseURL,
		client:  &http.Client{Timeout: aiServiceRequestTimeout},
	}
}

var _ AIServiceClient = (*httpAIServiceClient)(nil)

// Wire-level request/response shapes — field-for-field with the AI Service's
// Pydantic schemas (ai-service/app/schemas/extract_schema.py). Never exposed
// outside this file; ChatService only ever sees the Go-native types above.
type aiWireWallet struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	IsDefault bool   `json:"is_default"`
	Currency  string `json:"currency"`
}

type aiWireCategory struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

type aiWireChatTurn struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type aiWireRequest struct {
	Message    string           `json:"message"`
	History    []aiWireChatTurn `json:"history"`
	Wallets    []aiWireWallet   `json:"wallets"`
	Categories []aiWireCategory `json:"categories"`
	Now        string           `json:"now"`
}

type aiWireTransaction struct {
	AmountVND  int64   `json:"amount_vnd"`
	TxType     string  `json:"tx_type"`
	CategoryID string  `json:"category_id"`
	WalletID   *string `json:"wallet_id"`
	Note       *string `json:"note"`
	OccurredAt string  `json:"occurred_at"`
	Confidence float64 `json:"confidence"`
}

type aiWireResponse struct {
	Intent       string              `json:"intent"`
	Transactions []aiWireTransaction `json:"transactions"`
}

// Extract calls the AI Service's /extract endpoint. Any transport failure,
// non-200 status, or malformed response body is returned as a plain error —
// ChatService wraps it as common.ErrAIServiceUnavailable, never propagating
// the raw error to the client (spec.md S-AI-10).
func (c *httpAIServiceClient) Extract(ctx context.Context, req AIExtractRequest) (*AIExtractResponse, error) {
	if c.baseURL == "" {
		return nil, fmt.Errorf("ai_service_client.Extract: AI_SERVICE_URL not configured")
	}

	body, err := json.Marshal(toWireRequest(req))
	if err != nil {
		return nil, fmt.Errorf("ai_service_client.Extract: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/extract", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("ai_service_client.Extract: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ai_service_client.Extract: %w", err)
	}
	defer resp.Body.Close() //nolint:errcheck // best-effort close, response already read

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ai_service_client.Extract: unexpected status %d", resp.StatusCode)
	}

	var wireResp aiWireResponse
	if err := json.NewDecoder(resp.Body).Decode(&wireResp); err != nil {
		return nil, fmt.Errorf("ai_service_client.Extract: %w", err)
	}
	return fromWireResponse(wireResp), nil
}

func toWireRequest(req AIExtractRequest) aiWireRequest {
	wallets := make([]aiWireWallet, 0, len(req.Wallets))
	for _, w := range req.Wallets {
		wallets = append(wallets, aiWireWallet{ID: w.ID.String(), Name: w.Name, IsDefault: w.IsDefault, Currency: w.Currency})
	}
	categories := make([]aiWireCategory, 0, len(req.Categories))
	for _, c := range req.Categories {
		categories = append(categories, aiWireCategory{ID: c.ID.String(), Name: c.Name, Type: c.Type})
	}
	history := make([]aiWireChatTurn, 0, len(req.History))
	for _, h := range req.History {
		history = append(history, aiWireChatTurn{Role: h.Role, Content: h.Content})
	}
	return aiWireRequest{
		Message:    req.Message,
		History:    history,
		Wallets:    wallets,
		Categories: categories,
		Now:        req.Now.UTC().Format(time.RFC3339),
	}
}

func fromWireResponse(resp aiWireResponse) *AIExtractResponse {
	items := make([]AIProposedTransaction, 0, len(resp.Transactions))
	for _, t := range resp.Transactions {
		items = append(items, AIProposedTransaction{
			AmountVND:  t.AmountVND,
			TxType:     t.TxType,
			CategoryID: t.CategoryID,
			WalletID:   t.WalletID,
			Note:       t.Note,
			OccurredAt: t.OccurredAt,
			Confidence: t.Confidence,
		})
	}
	return &AIExtractResponse{Intent: resp.Intent, Transactions: items}
}
