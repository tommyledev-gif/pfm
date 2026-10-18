package dto

// ChatImageResponse is the body of POST /transactions/image-proposals' 200
// response (specs/ai-chat-image-capture plan §3.3). Intent is
// "create_transaction" or "ambiguous"; Actions is never null. Nothing is
// saved by this endpoint — every action still needs its own confirm.
type ChatImageResponse struct {
	Message      string               `json:"message"`
	Intent       string               `json:"intent"`
	Actions      []ChatActionResponse `json:"actions"`
	Truncated    bool                 `json:"truncated"`
	SkippedCount int                  `json:"skipped_count"`
}
