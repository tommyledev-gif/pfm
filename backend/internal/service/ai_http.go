package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/example/pfm/backend/internal/common"
)

// AIServiceEndpoint is where the internal AI Service listens and the shared
// secret it expects (AI_SERVICE_URL, AI_SERVICE_TOKEN). An empty BaseURL means
// "not configured": every call fails and each AI feature degrades on its own
// terms (502 AI_SERVICE_UNAVAILABLE, a degraded consult reply). An empty Token
// sends no credential, which an AI Service without a token configured accepts.
type AIServiceEndpoint struct {
	BaseURL string
	Token   string
}

// aiHTTP is the transport the AI Service clients share
// (specs/security-hardening-2026-10 US-07, US-12): a JSON request, the internal
// token, and a size-capped response read. Each client keeps its own timeout,
// wire types and status handling.
type aiHTTP struct {
	endpoint AIServiceEndpoint
	client   *http.Client
}

func newAIHTTP(endpoint AIServiceEndpoint, timeout time.Duration) aiHTTP {
	return aiHTTP{endpoint: endpoint, client: &http.Client{Timeout: timeout}}
}

// post sends body as JSON to path and returns the raw response; the caller
// closes its body. op prefixes every error (e.g. "ai_service_client.Extract").
func (h aiHTTP) post(ctx context.Context, op, path string, body any) (*http.Response, error) {
	if h.endpoint.BaseURL == "" {
		return nil, fmt.Errorf("%s: AI_SERVICE_URL not configured", op)
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", op, err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.endpoint.BaseURL+path, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("%s: %w", op, err)
	}
	req.Header.Set("Content-Type", "application/json")
	if h.endpoint.Token != "" {
		req.Header.Set(common.HeaderInternalToken, h.endpoint.Token)
	}
	resp, err := h.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", op, err)
	}
	return resp, nil
}

// postJSON is post for the common case: any status but 200 is an error (its
// body is never read: an error body can echo the request), and a 200 body is
// decoded into out.
func (h aiHTTP) postJSON(ctx context.Context, op, path string, body, out any) error {
	resp, err := h.post(ctx, op, path, body)
	if err != nil {
		return err
	}
	defer resp.Body.Close() //nolint:errcheck // best-effort close, response already read

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s: unexpected status %d", op, resp.StatusCode)
	}
	return decodeAIResponse(op, resp.Body, out)
}

// decodeAIResponse reads at most common.AIServiceResponseMaxBytes, so a
// misbehaving AI Service cannot make the API buffer an unbounded body; a
// longer one is cut and fails to decode.
func decodeAIResponse(op string, body io.Reader, out any) error {
	if err := json.NewDecoder(io.LimitReader(body, common.AIServiceResponseMaxBytes)).Decode(out); err != nil {
		return fmt.Errorf("%s: %w", op, err)
	}
	return nil
}
