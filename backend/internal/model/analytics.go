package model

import (
	"time"

	"github.com/google/uuid"
)

// AnalyticsMetric is what a spending question measures (specs/
// ai-chat-query-spending/spec.md US-02 "Supported questions"). Named
// Analytics* so it never collides with ChatIntent, which classifies
// transaction-recording messages at a different layer.
type AnalyticsMetric string

const (
	AnalyticsMetricSum          AnalyticsMetric = "sum"           // Q1, Q10
	AnalyticsMetricBreakdown    AnalyticsMetric = "breakdown"     // Q2, Q8, Q13
	AnalyticsMetricCompare      AnalyticsMetric = "compare"       // Q4
	AnalyticsMetricSeries       AnalyticsMetric = "series"        // Q3, Q12
	AnalyticsMetricTopN         AnalyticsMetric = "top_n"         // Q5, Q6
	AnalyticsMetricMaxTx        AnalyticsMetric = "max_tx"        // Q14
	AnalyticsMetricAvgDaily     AnalyticsMetric = "avg_daily"     // Q11
	AnalyticsMetricBudgetStatus AnalyticsMetric = "budget_status" // Q9
)

// AnalyticsGroupBy is the breakdown dimension.
type AnalyticsGroupBy string

const (
	AnalyticsGroupByCategory AnalyticsGroupBy = "category"
	AnalyticsGroupByWallet   AnalyticsGroupBy = "wallet"
	AnalyticsGroupByWeekday  AnalyticsGroupBy = "weekday"
)

// AnalyticsPeriod is a named period. Months are spending cycles, never
// calendar months (spec.md A-02); there is deliberately no "this_month".
type AnalyticsPeriod string

const (
	AnalyticsPeriodThisCycle   AnalyticsPeriod = "this_cycle"
	AnalyticsPeriodLastCycle   AnalyticsPeriod = "last_cycle"
	AnalyticsPeriodLast3Cycles AnalyticsPeriod = "last_3_cycles"
	AnalyticsPeriodLast6Cycles AnalyticsPeriod = "last_6_cycles"
	AnalyticsPeriodLast30Days  AnalyticsPeriod = "last_30_days"
	AnalyticsPeriodThisWeek    AnalyticsPeriod = "this_week"
	AnalyticsPeriodCustom      AnalyticsPeriod = "custom"
)

// AnalyticsChartType is the visual an answer asks the client to draw.
// Unknown types fall back to a plain list on the client (spec.md S-AIQ-43).
type AnalyticsChartType string

const (
	AnalyticsChartNone     AnalyticsChartType = "none"
	AnalyticsChartNumber   AnalyticsChartType = "number"
	AnalyticsChartDonut    AnalyticsChartType = "donut"
	AnalyticsChartBar      AnalyticsChartType = "bar"
	AnalyticsChartCompare  AnalyticsChartType = "compare"
	AnalyticsChartTable    AnalyticsChartType = "table"
	AnalyticsChartProgress AnalyticsChartType = "progress"
	AnalyticsChartLine     AnalyticsChartType = "line"
	AnalyticsChartWeekday  AnalyticsChartType = "weekday"
)

// AnalyticsQuery is one fully-specified spending question, however it was
// produced (chip, follow-up, or free-text interpretation). From/To are local
// calendar dates, used only when Period is custom.
type AnalyticsQuery struct {
	Metric      AnalyticsMetric
	GroupBy     AnalyticsGroupBy
	TxType      string
	Period      AnalyticsPeriod
	From        *time.Time
	To          *time.Time
	CategoryIDs []uuid.UUID
	WalletID    *uuid.UUID
	AmountMin   *int64
	Limit       int
	Currency    string
}

// AnalyticsWindow is one resolved [Start, End) interval in UTC, with Partial
// set when it has not finished yet (spec.md US-02 Edge Case: "so far").
type AnalyticsWindow struct {
	Start   time.Time
	End     time.Time
	Partial bool
}

// AnalyticsExpense is one expense row in a ranked list (Q5/Q6/Q14).
type AnalyticsExpense struct {
	ID           uuid.UUID
	Amount       int64
	OccurredAt   time.Time
	CategoryID   uuid.UUID
	CategoryName string
	WalletName   string
}

// AnalyticsKeyedAmount is one total keyed by an entity (Q8's Wallets).
type AnalyticsKeyedAmount struct {
	Key    uuid.UUID
	Label  string
	Amount int64
}

// AnalyticsDayAmount is one local calendar day's expense total (Q11/Q13).
// Day is that local date at UTC midnight.
type AnalyticsDayAmount struct {
	Day    time.Time
	Amount int64
}

// CategoryUsage is a Category with its recent Transaction count — the
// context a free-text question is interpreted against.
type CategoryUsage struct {
	ID      uuid.UUID
	Name    string
	Type    string
	TxCount int64
}

// IntentParseLog is one free-text question record (spec.md US-07).
type IntentParseLog struct {
	UserID         uuid.UUID
	RawText        string
	NormalizedText string
	ParsedIntent   []byte
	Method         string
	Kind           string
	Outcome        string
	Confidence     *float32
	LatencyMs      int32
	TokenIn        *int32
	TokenOut       *int32
	CachedTokens   *int32
}

// ConsultKind is what a free-text reply shows (spec.md US-03). Only
// ConsultKindAnswer carries figures.
type ConsultKind string

const (
	ConsultKindAnswer          ConsultKind = "answer"
	ConsultKindClarifyCategory ConsultKind = "clarify_category"
	ConsultKindUnsupported     ConsultKind = "unsupported"
	ConsultKindNeedsContext    ConsultKind = "needs_context"
	ConsultKindComingLater     ConsultKind = "coming_later"
	ConsultKindSwitchMode      ConsultKind = "switch_mode"
	ConsultKindDegraded        ConsultKind = "degraded"
)

// Interpreter verdicts from the AI Service (spec.md brief §II.4 boundaries).
const (
	ParseKindQuery           = "query"
	ParseKindEvaluate        = "evaluate"
	ParseKindScenario        = "scenario"
	ParseKindUnsupported     = "unsupported"
	ParseKindNeedsContext    = "needs_context"
	ParseKindTransactionLike = "transaction_like"
	ParseCoverageFull        = "full"
)

// Question-log method/outcome values (021_intent_parse_log.sql CHECKs).
const (
	IntentMethodLLM         = "llm"
	IntentOutcomeAnswered   = "answered"
	IntentOutcomeClarify    = "clarify"
	IntentOutcomeUnsupport  = "unsupported"
	IntentOutcomeDegraded   = "degraded"
	IntentOutcomeError      = "error"
	IntentKindUninterpreted = "none"
)
