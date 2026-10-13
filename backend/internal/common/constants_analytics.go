package common

import "time"

// Feature-12 US-03 Query Spending via Chat (specs/ai-chat-query-spending/,
// plan.md "Named limits"). Values marked "placeholder" are explicit
// assumptions from the design brief, to be tuned from the question log.
const (
	// AnalyticsSchemaVersion is stamped on every answer; the client falls back
	// to a plain list for a chart shape it does not know (spec.md S-AIQ-43).
	AnalyticsSchemaVersion = 1

	// AIConsultRateLimit/Window cap free-text questions only — chips and
	// follow-ups are never counted (spec.md S-AIQ-35). Placeholder.
	AIConsultRateLimit       = 20
	AIConsultRateLimitWindow = 1 * time.Hour
	// AIConsultMessageMaxLength bounds one free-text question.
	AIConsultMessageMaxLength = 300
	// AIConsultTimeout is the whole budget for one interpretation call; on
	// expiry the answer degrades instead of retrying (spec.md S-AIQ-41).
	AIConsultTimeout = 8 * time.Second
	// ConsultTokenBudgetPerMinute caps provider tokens spent on free-text
	// interpretation per rolling minute, so analysis can never starve
	// transaction recording of the shared provider quota (plan.md F13).
	// Derived from the measured org limit (docs/groq-token-baseline.md),
	// keeping the brief's §13.1 share for recording. The old placeholder
	// (4000) let only ~3 questions a minute through at ~1.8k tokens each and
	// degraded the rest before the provider was ever called (plan.md R-F27).
	ProviderOrgTokensPerMinute   = 8000
	RecordingTokenReservePercent = 15
	ConsultTokenBudgetPerMinute  = ProviderOrgTokensPerMinute * (AnalyticsPercentScale - RecordingTokenReservePercent) / AnalyticsPercentScale
	ConsultTokenBudgetWindow     = 1 * time.Minute

	// Category confidence bands for free-text matches (spec.md US-03 step 6).
	AnalyticsCategoryConfidenceHigh   = 0.8
	AnalyticsCategoryConfidenceMedium = 0.5
	// AnalyticsCategoryContextMax / Cycles: how many of the caller's
	// most-used Categories, over how many recent cycles, the interpreter sees.
	AnalyticsCategoryContextMax    = 20
	AnalyticsCategoryContextCycles = 6

	// Payload bounds (plan.md F14/BR-12): answers are stored whole in the
	// chat thread and re-synced, so every list is capped.
	AnalyticsBreakdownMaxSlices = 6
	AnalyticsListMaxRows        = 10
	AnalyticsListDefaultRows    = 5
	// Rows a ranked-list answer carries in total — the ones shown plus the
	// ones its "và N khoản khác" line expands to in place (more_rows). Still
	// a cap, under the same payload bound as every list above.
	AnalyticsListExpandMaxRows = 30
	// AnalyticsInlineRowsMax: a total or a Category breakdown over a period
	// with at most this many expenses also lists those expenses, so "what
	// did I spend on today" is answered without a second question.
	AnalyticsInlineRowsMax      = 5
	AnalyticsSeriesMaxCycles    = 6
	AnalyticsSeriesShortCycles  = 3
	AnalyticsCustomRangeMaxDays = 366
	AnalyticsLastDaysWindow     = 30
	AnalyticsWeekPatternMinDays = 7
	AnalyticsMaxCategoryFilter  = 20

	// Question-log retention (spec.md US-07). Placeholders (spec.md OQ #2).
	IntentLogRawRetention  = 30 * 24 * time.Hour
	IntentLogRetention     = 365 * 24 * time.Hour
	IntentLogPurgeInterval = 24 * time.Hour

	AnalyticsPercentScale  = 100
	AnalyticsDaysPerWeek   = 7
	AnalyticsOtherSliceKey = "other"
)
