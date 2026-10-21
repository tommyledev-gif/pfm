package dto

import "github.com/google/uuid"

// AnalyticsAnomaly is the "anything unusual?" answer: the period against the
// User's own history (service/analytics_anomaly*.go). All amounts are int64
// xu. Only figures the server computed; the client formats, never derives.
type AnalyticsAnomaly struct {
	// Status: "found" (at least one rule fired), "none", or "little_history"
	// (too few past days/weeks/cycles with spending to say what usual is).
	Status string `json:"status"`
	// Unit is what one baseline sample is: "day", "week" or "cycle".
	Unit string `json:"unit"`
	// BaselineLabel names the history compared against: "8 tuần trước".
	BaselineLabel string `json:"baseline_label"`
	// Total / Count: the period's spending and number of expenses.
	Total int64 `json:"total"`
	Count int64 `json:"count"`
	// Typical is the usual spending of one sample (median over the samples
	// with spending; for a day, a usual same weekday when that is higher).
	// Nil with too little history.
	Typical      *int64 `json:"typical,omitempty"`
	TypicalLabel string `json:"typical_label,omitempty"`
	TypicalCount *int64 `json:"typical_count,omitempty"`
	// HistorySamples / HistoryMin: baseline samples with spending, and how
	// many the rules need.
	HistorySamples int  `json:"history_samples"`
	HistoryMin     int  `json:"history_min"`
	TotalSpike     bool `json:"total_spike"`
	CountSpike     bool `json:"count_spike"`
	// Categories far above their own usual, or new this period; largest
	// excess first, at most common.AnomalyMaxFindings.
	Categories []AnalyticsAnomalyCategory `json:"categories,omitempty"`
	// Income lists incomes larger than any in the baseline (the chart's Rows
	// hold the unusually large expenses).
	Income []AnalyticsTxRow `json:"income,omitempty"`
}

// AnalyticsAnomalyCategory is one Category spending far above its usual.
// Typical is nil when the Category had no spending in the whole baseline.
type AnalyticsAnomalyCategory struct {
	CategoryID   uuid.UUID `json:"category_id"`
	CategoryName string    `json:"category_name"`
	Amount       int64     `json:"amount"`
	Typical      *int64    `json:"typical,omitempty"`
}
