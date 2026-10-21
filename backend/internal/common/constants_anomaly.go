package common

// "Anything unusual?" answers (consult metric anomaly, owner item 9; rules in
// service/analytics_anomaly_rules.go). Every threshold exists to keep noise
// out: a rule fires only when the period is BOTH far above the User's own
// usual AND above a minimum absolute amount, and only with enough history to
// know what usual is. Amounts are xu (1 đồng = 100 xu).
const (
	// Baseline length per unit. 56 days = 8 whole weeks, so every weekday
	// appears exactly 8 times for the same-weekday comparison.
	AnomalyBaselineDays   = 56
	AnomalyBaselineWeeks  = 8
	AnomalyBaselineCycles = 6

	// Baseline samples (days/weeks/cycles) that must have spending before
	// anything is called unusual; fewer and the answer says so instead.
	AnomalyMinHistoryDays   = 10
	AnomalyMinHistoryWeeks  = 4
	AnomalyMinHistoryCycles = 3
	// AnomalyMinWeekdaySamples: same-weekday days with spending needed before
	// "a usual Saturday" may replace "a usual day" as the yardstick.
	AnomalyMinWeekdaySamples = 3

	// Ratios in percent of the usual (median) value.
	AnomalyTotalRatioPct        = 200 // period total ≥ 2× usual
	AnomalyCategoryRatioPctDay  = 300 // one day's Category ≥ 3× its usual day
	AnomalyCategoryRatioPctLong = 200 // a week's/cycle's Category ≥ 2× its usual
	AnomalyTxRatioPct           = 300 // one expense ≥ 3× a usual one of its kind
	AnomalyCountRatioPct        = 200 // number of expenses ≥ 2× usual
	AnomalyIncomeRatioPct       = 200 // one income ≥ 2× a usual income

	// Minimum history per comparison.
	AnomalyCategoryMinSamples = 3  // baseline samples with spending in that Category
	AnomalyTxMinSamples       = 5  // baseline expenses in that Category
	AnomalyTxFallbackSamples  = 10 // baseline expenses overall, when the Category has fewer
	AnomalyIncomeMinSamples   = 3  // baseline incomes
	// AnomalyCountMinExcess: at least this many more expenses than usual.
	AnomalyCountMinExcess = 5

	// Minimum absolute amounts, VND xu. A day 3× a usual 20.000đ is still
	// only 60.000đ: not worth a word.
	AnomalyMinExcessDayXu       = 200_000 * VNDToCentsFactor
	AnomalyMinExcessWeekXu      = 500_000 * VNDToCentsFactor
	AnomalyMinExcessCycleXu     = 1_000_000 * VNDToCentsFactor
	AnomalyMinNewDayXu          = 500_000 * VNDToCentsFactor
	AnomalyMinNewWeekXu         = 1_000_000 * VNDToCentsFactor
	AnomalyMinNewCycleXu        = 2_000_000 * VNDToCentsFactor
	AnomalyMinLargeTxXu         = 200_000 * VNDToCentsFactor
	AnomalyMinLargeTxFallbackXu = 500_000 * VNDToCentsFactor
	AnomalyMinIncomeXu          = 1_000_000 * VNDToCentsFactor
	// AnomalyForeignDivisor scales the VND minimums to another currency's
	// minor units: 200.000đ → 10.00 of a dollar-sized unit.
	AnomalyForeignDivisor = 20_000

	// AnomalyMaxFindings caps each list in the answer (payload bound,
	// plan.md BR-12).
	AnomalyMaxFindings = 3
	// AnomalyMaxRows bounds one listing of the period plus its baseline. When
	// it is reached, the oldest baseline samples are dropped rather than
	// judged on partial data (service.anomalyTrimBaseline).
	AnomalyMaxRows = 5000
)
