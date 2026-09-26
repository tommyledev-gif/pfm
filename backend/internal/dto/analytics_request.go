package dto

import "github.com/google/uuid"

// AnalyticsQueryRequest is the body of POST /analytics/query
// (specs/ai-chat-query-spending/plan.md API table) — one complete spending
// question. Chips and follow-up chips carry this exact shape, so the client
// can re-send it verbatim; answers echo it back for that purpose.
//
// Tags cover shape only; cross-field rules (custom period needs both dates,
// compare/series need compatible periods, …) are business rules checked in
// AnalyticsService.validate and returned together in one 400.
type AnalyticsQueryRequest struct {
	Metric      string      `json:"metric" validate:"required,oneof=sum breakdown compare series top_n max_tx avg_daily budget_status"`
	GroupBy     string      `json:"group_by,omitempty" validate:"omitempty,oneof=category wallet weekday"`
	TxType      string      `json:"tx_type,omitempty" validate:"omitempty,oneof=income expense"`
	Period      string      `json:"period" validate:"required,oneof=this_cycle last_cycle last_3_cycles last_6_cycles last_30_days this_week custom"`
	From        string      `json:"from,omitempty" validate:"omitempty,datetime=2006-01-02"`
	To          string      `json:"to,omitempty" validate:"omitempty,datetime=2006-01-02"`
	CategoryIDs []uuid.UUID `json:"category_ids,omitempty" validate:"omitempty,max=20"`
	WalletID    *uuid.UUID  `json:"wallet_id,omitempty"`
	AmountMin   *int64      `json:"amount_min,omitempty" validate:"omitempty,min=1"`
	Limit       int         `json:"limit,omitempty" validate:"omitempty,min=1,max=10"`
	Currency    string      `json:"currency,omitempty" validate:"omitempty,len=3"`
}

// ConsultRequest is the body of POST /analytics/consult — one free-text
// spending question (spec.md US-03).
type ConsultRequest struct {
	Message string `json:"message" validate:"required,min=1,max=300"`
}
