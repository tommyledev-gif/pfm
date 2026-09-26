package service

import (
	"sync"
	"time"
)

// ConsultTokenBudget caps provider tokens spent on free-text interpretation
// per rolling window, across all Users (specs/ai-chat-query-spending/plan.md
// F13). The provider's rate limit is per organisation and shared with
// transaction recording; Fiber's per-user limiter cannot see it, so without
// this guard heavy analysis use could exhaust the shared quota and break
// recording — exactly what spec.md S-AIQ-37 forbids. In-memory is enough:
// the backend runs as a single instance.
type ConsultTokenBudget struct {
	mu      sync.Mutex
	limit   int
	window  time.Duration
	entries []tokenSpend
	now     func() time.Time
}

type tokenSpend struct {
	at     time.Time
	tokens int
}

func NewConsultTokenBudget(limit int, window time.Duration) *ConsultTokenBudget {
	return &ConsultTokenBudget{limit: limit, window: window, now: time.Now}
}

// Allow reports whether one more interpretation may start now.
func (b *ConsultTokenBudget) Allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.spentLocked() < b.limit
}

// Record adds the tokens an interpretation actually used.
func (b *ConsultTokenBudget) Record(tokens int) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.entries = append(b.entries, tokenSpend{at: b.now(), tokens: tokens})
}

// spentLocked drops expired entries and sums the rest. Caller holds mu.
func (b *ConsultTokenBudget) spentLocked() int {
	cutoff := b.now().Add(-b.window)
	kept := b.entries[:0]
	total := 0
	for _, e := range b.entries {
		if e.at.After(cutoff) {
			kept = append(kept, e)
			total += e.tokens
		}
	}
	b.entries = kept
	return total
}
