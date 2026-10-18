package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/example/pfm/backend/internal/common"
)

// AIExtractImageRequest is one image reading (specs/ai-chat-image-capture
// plan §3.3). The image bytes live only in memory for this request.
type AIExtractImageRequest struct {
	Image      []byte
	MIMEType   string
	Caption    *string
	Wallets    []AIWalletContext
	Categories []AICategoryContext
	Now        time.Time
	MaxItems   int
	ReadLines  bool
}

// AIProposedImageTransaction is one entry the AI read. Untrusted, like every
// AI field: ids are raw strings, re-validated by resolveActions.
type AIProposedImageTransaction struct {
	AmountVND  int64
	TxType     string
	CategoryID string
	WalletID   *string
	Note       *string
	OccurredAt string // YYYY-MM-DD or "" when no date was visible
	Confidence float64
	// TotalVisible is false when the receipt's amount-payable line is cut
	// off or unreadable (spec EC-37).
	TotalVisible bool
	Items        []AIProposedImageItem
	Adjustments  []AIProposedImageAdjustment
}

type AIProposedImageItem struct {
	Name         string
	Quantity     int32
	UnitPriceVND *int64
	AmountVND    int64
	NeedsReview  bool
}

type AIProposedImageAdjustment struct {
	Kind        string
	Direction   string
	Label       *string
	AmountVND   int64
	NeedsReview bool
}

type AIExtractImageResponse struct {
	SourceKind   string
	Transactions []AIProposedImageTransaction
	UnreadCount  int
	Truncated    bool
}

// AIImageBusyError: the AI Service answered 429 because the provider is out
// of capacity (plan F34). RetryAfterSeconds is nil when no wait was given.
type AIImageBusyError struct {
	RetryAfterSeconds *int
}

func (e *AIImageBusyError) Error() string { return "ai image reading busy" }

type httpAIImageClient struct {
	baseURL string
	client  *http.Client
}

func NewHTTPAIImageClient(baseURL string) *httpAIImageClient {
	return &httpAIImageClient{baseURL: baseURL, client: &http.Client{Timeout: common.AIImageRequestTimeout}}
}

var _ AIImageClient = (*httpAIImageClient)(nil)

// Wire shapes — field-for-field with ai-service/app/schemas/extract_image_schema.py.
type aiImageWireRequest struct {
	ImageBase64 string           `json:"image_base64"`
	MIMEType    string           `json:"mime_type"`
	Caption     *string          `json:"caption"`
	Wallets     []aiWireWallet   `json:"wallets"`
	Categories  []aiWireCategory `json:"categories"`
	Now         string           `json:"now"`
	MaxItems    int              `json:"max_items"`
	ReadLines   bool             `json:"read_lines"`
}

type aiImageWireItem struct {
	Name         string `json:"name"`
	Quantity     int32  `json:"quantity"`
	UnitPriceVND *int64 `json:"unit_price_vnd"`
	AmountVND    int64  `json:"amount_vnd"`
	NeedsReview  bool   `json:"needs_review"`
}

type aiImageWireAdjustment struct {
	Kind        string  `json:"kind"`
	Direction   string  `json:"direction"`
	Label       *string `json:"label"`
	AmountVND   int64   `json:"amount_vnd"`
	NeedsReview bool    `json:"needs_review"`
}

type aiImageWireTransaction struct {
	AmountVND    int64                   `json:"amount_vnd"`
	TxType       string                  `json:"tx_type"`
	CategoryID   string                  `json:"category_id"`
	WalletID     *string                 `json:"wallet_id"`
	Note         *string                 `json:"note"`
	OccurredAt   *string                 `json:"occurred_at"`
	Confidence   float64                 `json:"confidence"`
	TotalVisible *bool                   `json:"total_visible"`
	Items        []aiImageWireItem       `json:"items"`
	Adjustments  []aiImageWireAdjustment `json:"adjustments"`
}

type aiImageWireResponse struct {
	SourceKind   string                   `json:"source_kind"`
	Transactions []aiImageWireTransaction `json:"transactions"`
	UnreadCount  int                      `json:"unread_count"`
	Truncated    bool                     `json:"truncated"`
}

type aiImageWireBusy struct {
	RetryAfterSeconds *int `json:"retry_after_seconds"`
}

// ExtractImage calls POST {baseURL}/extract-image. ⚠️ Never reads or logs a
// non-200 body except the bounded 429 wait time: error bodies can echo the
// request (plan F12).
func (c *httpAIImageClient) ExtractImage(ctx context.Context, req AIExtractImageRequest) (*AIExtractImageResponse, error) {
	if c.baseURL == "" {
		return nil, fmt.Errorf("ai_image_client.ExtractImage: AI_SERVICE_URL not configured")
	}
	body, err := json.Marshal(toImageWireRequest(req))
	if err != nil {
		return nil, fmt.Errorf("ai_image_client.ExtractImage: %w", err)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/extract-image", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("ai_image_client.ExtractImage: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("ai_image_client.ExtractImage: %w", err)
	}
	defer resp.Body.Close() //nolint:errcheck // best-effort close, response already read

	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusTooManyRequests:
		var busy aiImageWireBusy
		if err := json.NewDecoder(io.LimitReader(resp.Body, common.AIImageBusyBodyMaxBytes)).Decode(&busy); err != nil {
			return nil, &AIImageBusyError{}
		}
		return nil, &AIImageBusyError{RetryAfterSeconds: busy.RetryAfterSeconds}
	default:
		return nil, fmt.Errorf("ai_image_client.ExtractImage: unexpected status %d", resp.StatusCode)
	}

	var wire aiImageWireResponse
	if err := json.NewDecoder(resp.Body).Decode(&wire); err != nil {
		return nil, fmt.Errorf("ai_image_client.ExtractImage: %w", err)
	}
	return fromImageWireResponse(wire), nil
}

// isAIImageBusy reports whether err is the provider-busy outcome.
func isAIImageBusy(err error) (*AIImageBusyError, bool) {
	var busy *AIImageBusyError
	ok := errors.As(err, &busy)
	return busy, ok
}

func toImageWireRequest(req AIExtractImageRequest) aiImageWireRequest {
	base := toWireRequest(AIExtractRequest{Wallets: req.Wallets, Categories: req.Categories, Now: req.Now})
	return aiImageWireRequest{
		ImageBase64: base64.StdEncoding.EncodeToString(req.Image),
		MIMEType:    req.MIMEType,
		Caption:     req.Caption,
		Wallets:     base.Wallets,
		Categories:  base.Categories,
		Now:         base.Now,
		MaxItems:    req.MaxItems,
		ReadLines:   req.ReadLines,
	}
}

func fromImageWireResponse(wire aiImageWireResponse) *AIExtractImageResponse {
	out := &AIExtractImageResponse{
		SourceKind:   wire.SourceKind,
		Transactions: make([]AIProposedImageTransaction, 0, len(wire.Transactions)),
		UnreadCount:  wire.UnreadCount,
		Truncated:    wire.Truncated,
	}
	for _, t := range wire.Transactions {
		occurredAt := ""
		if t.OccurredAt != nil {
			occurredAt = *t.OccurredAt
		}
		tx := AIProposedImageTransaction{
			AmountVND: t.AmountVND, TxType: t.TxType, CategoryID: t.CategoryID, WalletID: t.WalletID,
			Note: t.Note, OccurredAt: occurredAt, Confidence: t.Confidence,
			// Absent means visible: only an explicit false lowers confidence.
			TotalVisible: t.TotalVisible == nil || *t.TotalVisible,
		}
		for _, l := range t.Items {
			tx.Items = append(tx.Items, AIProposedImageItem{
				Name: l.Name, Quantity: l.Quantity, UnitPriceVND: l.UnitPriceVND, AmountVND: l.AmountVND, NeedsReview: l.NeedsReview,
			})
		}
		for _, a := range t.Adjustments {
			tx.Adjustments = append(tx.Adjustments, AIProposedImageAdjustment{
				Kind: a.Kind, Direction: a.Direction, Label: a.Label, AmountVND: a.AmountVND, NeedsReview: a.NeedsReview,
			})
		}
		out.Transactions = append(out.Transactions, tx)
	}
	return out
}
