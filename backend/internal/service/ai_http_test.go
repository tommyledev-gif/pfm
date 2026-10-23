package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/example/pfm/backend/internal/common"
)

const testAIToken = "0123456789abcdef0123456789abcdef"

// S-HRD-35: every AI Service call carries the internal token when one is set,
// and none when it is not.
func TestAIHTTP_SendsTheInternalToken(t *testing.T) {
	var got []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = append(got, r.Header.Get(common.HeaderInternalToken))
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("Content-Type = %q", ct)
		}
		_, _ = w.Write([]byte(`{"suggested_name":"Ăn uống","type":"expense","icon":"x"}`))
	}))
	defer server.Close()

	withToken := NewHTTPAIBudgetClient(AIServiceEndpoint{BaseURL: server.URL, Token: testAIToken})
	if _, err := withToken.SuggestCategoryName(context.Background(), "ăn"); err != nil {
		t.Fatalf("with token: %v", err)
	}
	withoutToken := NewHTTPAIBudgetClient(AIServiceEndpoint{BaseURL: server.URL})
	if _, err := withoutToken.SuggestCategoryName(context.Background(), "ăn"); err != nil {
		t.Fatalf("without token: %v", err)
	}
	if len(got) != 2 || got[0] != testAIToken || got[1] != "" {
		t.Fatalf("tokens seen = %q", got)
	}
}

func TestAIHTTP_RefusalsAndOversizedBodiesAreErrors(t *testing.T) {
	status := http.StatusUnauthorized
	body := `{}`
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	defer server.Close()
	h := newAIHTTP(AIServiceEndpoint{BaseURL: server.URL, Token: testAIToken}, 5*time.Second)
	var out map[string]any

	// S-HRD-29/30 as the backend sees them: a 401 is an error, never decoded.
	if err := h.postJSON(context.Background(), "op", "/x", struct{}{}, &out); err == nil || !strings.Contains(err.Error(), "401") {
		t.Fatalf("401 must be an error, got %v", err)
	}

	status = http.StatusOK
	body = `{"pad":"` + strings.Repeat("a", common.AIServiceResponseMaxBytes) + `"}`
	if err := h.postJSON(context.Background(), "op", "/x", struct{}{}, &out); err == nil {
		t.Fatal("a body past the cap must fail to decode, not be buffered whole")
	}

	body = `{"ok":true}`
	if err := h.postJSON(context.Background(), "op", "/x", struct{}{}, &out); err != nil || out["ok"] != true {
		t.Fatalf("normal body: out=%v err=%v", out, err)
	}
}

func TestAIHTTP_UnconfiguredURLFailsWithoutACall(t *testing.T) {
	h := newAIHTTP(AIServiceEndpoint{}, time.Second)
	if _, err := h.post(context.Background(), "op", "/x", struct{}{}); err == nil || !strings.Contains(err.Error(), "AI_SERVICE_URL") {
		t.Fatalf("got %v", err)
	}
}
