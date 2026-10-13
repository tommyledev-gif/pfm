package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// AIConsultRequest is one free-text question plus the caller's own context
// to interpret it against (specs/ai-chat-query-spending/plan.md API table,
// internal POST /consult). Never another User's Categories or Wallets.
type AIConsultRequest struct {
	Message    string
	Categories []AICategoryContext
	Wallets    []AIWalletContext
	Today      string // local YYYY-MM-DD
	Timezone   string
}

// AIConsultParse is the interpreter's structured reading of a question. It
// carries no amounts other than a parsed threshold, and the backend never
// forwards any text from it to the User (plan.md BR-11).
type AIConsultParse struct {
	Kind               string
	Coverage           string
	Metric             string
	GroupBy            string
	TxType             string
	Period             string
	From               string
	To                 string
	CategoryIDs        []uuid.UUID
	WalletID           *uuid.UUID
	AmountMinVND       *int64
	Limit              int
	CategoryConfidence *float64
	// Goal* / MonthlySaveVND are a savings-goal scenario, in đồng; set only
	// when Kind is scenario and the question named a target amount.
	GoalAmountVND  *int64
	GoalDeadline   string // local YYYY-MM-DD, may be empty
	MonthlySaveVND *int64
	NormalizedText string
	// InvalidOutput: the model answered but its output did not fit the
	// catalog. The reply is "unsupported", never "degraded" (plan.md BR-26).
	InvalidOutput    bool
	PromptTokens     int
	CompletionTokens int
	CachedTokens     int
	// Method is how the question was read: model.IntentMethodRegex for the
	// AI Service's phrase rules, else model.IntentMethodLLM.
	Method string
}

type httpAIConsultClient struct {
	baseURL string
	client  *http.Client
}

// NewHTTPAIConsultClient uses its own short timeout and never retries
// (spec.md S-AIQ-41): a slow interpretation degrades the answer instead.
func NewHTTPAIConsultClient(baseURL string) *httpAIConsultClient {
	return &httpAIConsultClient{baseURL: baseURL, client: &http.Client{Timeout: common.AIConsultTimeout}}
}

var _ AIConsultClient = (*httpAIConsultClient)(nil)

type consultWireRequest struct {
	Message    string           `json:"message"`
	Categories []aiWireCategory `json:"categories"`
	Wallets    []aiWireWallet   `json:"wallets"`
	Today      string           `json:"today"`
	Timezone   string           `json:"timezone"`
}

type consultWireQuery struct {
	Metric       string   `json:"metric"`
	GroupBy      *string  `json:"group_by"`
	TxType       *string  `json:"tx_type"`
	Period       string   `json:"period"`
	From         *string  `json:"from"`
	To           *string  `json:"to"`
	CategoryIDs  []string `json:"category_ids"`
	WalletID     *string  `json:"wallet_id"`
	AmountMinVND *int64   `json:"amount_min_vnd"`
	Limit        *int     `json:"limit"`
}

type consultWireScenario struct {
	GoalAmountVND  int64   `json:"goal_amount_vnd"`
	GoalDeadline   *string `json:"goal_deadline"`
	MonthlySaveVND *int64  `json:"monthly_save_vnd"`
}

type consultWireUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	CachedTokens     int `json:"cached_tokens"`
}

type consultWireResponse struct {
	Kind               string               `json:"kind"`
	Coverage           string               `json:"coverage"`
	Query              *consultWireQuery    `json:"query"`
	Scenario           *consultWireScenario `json:"scenario"`
	CategoryConfidence *float64             `json:"category_confidence"`
	NormalizedText     string               `json:"normalized_text"`
	Usage              consultWireUsage     `json:"usage"`
	InvalidOutput      bool                 `json:"invalid_output"`
	// Method is "regex" when the AI Service read the question with its phrase
	// rules and no model call; absent (older service) or "llm" otherwise.
	Method string `json:"method"`
}

// Parse calls the AI Service's /consult endpoint. Any transport failure,
// non-200 status, malformed body, or an id that is not a UUID is a plain
// error — ConsultService turns every error into a degraded reply.
func (c *httpAIConsultClient) Parse(ctx context.Context, req AIConsultRequest) (*AIConsultParse, error) {
	if c.baseURL == "" {
		return nil, fmt.Errorf("ai_consult_client.Parse: AI_SERVICE_URL not configured")
	}
	body, err := json.Marshal(toConsultWire(req))
	if err != nil {
		return nil, fmt.Errorf("ai_consult_client.Parse: %w", err)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/consult", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("ai_consult_client.Parse: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ai_consult_client.Parse: %w", err)
	}
	defer resp.Body.Close() //nolint:errcheck // best-effort close, response already read

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ai_consult_client.Parse: unexpected status %d", resp.StatusCode)
	}
	var wire consultWireResponse
	if err := json.NewDecoder(resp.Body).Decode(&wire); err != nil {
		return nil, fmt.Errorf("ai_consult_client.Parse: %w", err)
	}
	return fromConsultWire(wire)
}

func toConsultWire(req AIConsultRequest) consultWireRequest {
	wallets := make([]aiWireWallet, 0, len(req.Wallets))
	for _, w := range req.Wallets {
		wallets = append(wallets, aiWireWallet{ID: w.ID.String(), Name: w.Name, IsDefault: w.IsDefault, Currency: w.Currency})
	}
	categories := make([]aiWireCategory, 0, len(req.Categories))
	for _, c := range req.Categories {
		categories = append(categories, aiWireCategory{ID: c.ID.String(), Name: c.Name, Type: c.Type})
	}
	return consultWireRequest{Message: req.Message, Categories: categories, Wallets: wallets, Today: req.Today, Timezone: req.Timezone}
}

func fromConsultWire(w consultWireResponse) (*AIConsultParse, error) {
	out := &AIConsultParse{
		Kind: w.Kind, Coverage: w.Coverage, CategoryConfidence: w.CategoryConfidence,
		NormalizedText: w.NormalizedText, InvalidOutput: w.InvalidOutput, PromptTokens: w.Usage.PromptTokens,
		CompletionTokens: w.Usage.CompletionTokens, CachedTokens: w.Usage.CachedTokens, Method: model.IntentMethodLLM,
	}
	if w.Method == model.IntentMethodRegex {
		out.Method = model.IntentMethodRegex
	}
	if sc := w.Scenario; sc != nil {
		goal := sc.GoalAmountVND
		out.GoalAmountVND, out.GoalDeadline, out.MonthlySaveVND = &goal, deref(sc.GoalDeadline), sc.MonthlySaveVND
	}
	if w.Query == nil {
		return out, nil
	}
	q := w.Query
	out.Metric, out.Period, out.AmountMinVND = q.Metric, q.Period, q.AmountMinVND
	out.GroupBy, out.TxType, out.From, out.To = deref(q.GroupBy), deref(q.TxType), deref(q.From), deref(q.To)
	if q.Limit != nil {
		out.Limit = *q.Limit
	}
	for _, raw := range q.CategoryIDs {
		id, err := uuid.Parse(raw)
		if err != nil {
			return nil, fmt.Errorf("ai_consult_client.Parse: category id: %w", err)
		}
		out.CategoryIDs = append(out.CategoryIDs, id)
	}
	if q.WalletID != nil {
		id, err := uuid.Parse(*q.WalletID)
		if err != nil {
			return nil, fmt.Errorf("ai_consult_client.Parse: wallet id: %w", err)
		}
		out.WalletID = &id
	}
	return out, nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
