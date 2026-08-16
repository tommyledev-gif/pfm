package service

import (
	"context"
	"errors"
)

// fakeAIServiceClient is an in-memory stand-in for AIServiceClient, used
// instead of a real Groq/Anthropic-backed AI Service per Go Test
// Conventions. Configure response/err before calling ChatService.Chat; calls
// records whether Extract was invoked at all — used to assert the zero-Wallet
// short-circuit never spends a call (specs/ai-chat-assistant/plan.md
// Finding #9).
type fakeAIServiceClient struct {
	response *AIExtractResponse
	err      error
	calls    int
}

func (f *fakeAIServiceClient) Extract(_ context.Context, _ AIExtractRequest) (*AIExtractResponse, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	return f.response, nil
}

var errFakeAIServiceUnavailable = errors.New("fake AI service unavailable")
