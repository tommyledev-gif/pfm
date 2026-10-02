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
	// lastReq is what the most recent Extract call was handed — lets a test
	// assert exactly which conversation history reached the model.
	lastReq AIExtractRequest
}

func (f *fakeAIServiceClient) Extract(_ context.Context, req AIExtractRequest) (*AIExtractResponse, error) {
	f.calls++
	f.lastReq = req
	if f.err != nil {
		return nil, f.err
	}
	return f.response, nil
}

var errFakeAIServiceUnavailable = errors.New("fake AI service unavailable")
