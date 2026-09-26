package dto

import (
	"time"

	"github.com/google/uuid"
)

// AnalyticsAnswerResponse is one answered spending question
// (specs/ai-chat-query-spending/spec.md US-02). The client stores it whole in
// the chat thread and redraws it later without recomputing (US-06), so every
// list inside is bounded (plan.md BR-12). All amounts are int64 xu.
type AnalyticsAnswerResponse struct {
	SchemaVersion int                     `json:"schema_version"`
	Query         AnalyticsQueryRequest   `json:"query"`
	Period        AnalyticsPeriodResponse `json:"period"`
	Currency      string                  `json:"currency"`
	// Summary is built from a fixed template, never from model output
	// (plan.md BR-11).
	Summary   string              `json:"summary"`
	Chart     AnalyticsChart      `json:"chart"`
	Notices   []AnalyticsNotice   `json:"notices"`
	TxCount   int64               `json:"tx_count"`
	FollowUps []AnalyticsFollowUp `json:"follow_ups"`
}

// AnalyticsPeriodResponse is the resolved window: exact UTC bounds plus the
// local first/last calendar day for the label, and whether it is still open.
type AnalyticsPeriodResponse struct {
	Key      string    `json:"key"`
	Label    string    `json:"label"`
	From     time.Time `json:"from"`
	To       time.Time `json:"to"`
	FromDate string    `json:"from_date"`
	ToDate   string    `json:"to_date"`
	Partial  bool      `json:"partial"`
}

// AnalyticsChart is a flat union keyed by Type — only the fields that type
// uses are set. Kept flat (not an interface) so it round-trips through the
// client's opaque thread payload without a custom decoder.
type AnalyticsChart struct {
	Type         string                `json:"type"`
	Value        *int64                `json:"value,omitempty"`
	Days         *int                  `json:"days,omitempty"`
	Items        []AnalyticsChartItem  `json:"items,omitempty"`
	Compare      *AnalyticsCompare     `json:"compare,omitempty"`
	Rows         []AnalyticsTxRow      `json:"rows,omitempty"`
	TotalMatched *int64                `json:"total_matched,omitempty"`
	Budgets      []AnalyticsBudgetItem `json:"budgets,omitempty"`
}

// AnalyticsChartItem is one slice, bar, line point or weekday.
type AnalyticsChartItem struct {
	Key    string `json:"key"`
	Label  string `json:"label"`
	Amount int64  `json:"amount"`
}

// AnalyticsCompare is Q4's two periods. ChangePct is nil when the previous
// period is zero — never a division by zero (spec.md S-AIQ-08).
type AnalyticsCompare struct {
	Current       int64  `json:"current"`
	Previous      int64  `json:"previous"`
	ChangePct     *int64 `json:"change_pct"`
	CurrentLabel  string `json:"current_label"`
	PreviousLabel string `json:"previous_label"`
}

// AnalyticsTxRow is one Transaction in a ranked list — no note, by design
// (plan.md BR-22).
type AnalyticsTxRow struct {
	ID           uuid.UUID `json:"id"`
	OccurredAt   time.Time `json:"occurred_at"`
	Amount       int64     `json:"amount"`
	CategoryName string    `json:"category_name"`
	WalletName   string    `json:"wallet_name"`
}

// AnalyticsBudgetItem is one Budget's standing in the answer currency —
// the same numbers the Budgets screen shows (spec.md S-AIQ-09).
type AnalyticsBudgetItem struct {
	BudgetID     uuid.UUID `json:"budget_id"`
	CategoryName string    `json:"category_name"`
	Limit        int64     `json:"limit"`
	Spent        int64     `json:"spent"`
	Remaining    int64     `json:"remaining"`
	Exceeded     bool      `json:"exceeded"`
}

// AnalyticsNotice is a caveat shown under the summary.
type AnalyticsNotice struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// AnalyticsFollowUp is a chip carrying a complete question (spec.md US-04).
type AnalyticsFollowUp struct {
	Label string                `json:"label"`
	Query AnalyticsQueryRequest `json:"query"`
}

// ConsultResponse is the reply to a free-text question (spec.md US-03/US-05).
// Kind decides what the client renders; Answer is set only for "answer".
// Degraded replies are 200 by design (plan.md BR-18): the client must show
// the message and chips, not a generic error.
type ConsultResponse struct {
	Kind              string                   `json:"kind"`
	Message           string                   `json:"message"`
	Answer            *AnalyticsAnswerResponse `json:"answer,omitempty"`
	BannerCategories  []ConsultCategoryRef     `json:"banner_categories,omitempty"`
	CategoryChoices   []ConsultCategoryRef     `json:"category_choices,omitempty"`
	PendingQuery      *AnalyticsQueryRequest   `json:"pending_query,omitempty"`
	Chips             []AnalyticsFollowUp      `json:"chips"`
	SwitchToRecording bool                     `json:"switch_to_recording,omitempty"`
}

// ConsultCategoryRef names a Category in a banner or a choice list.
type ConsultCategoryRef struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}
