package service

import (
	"sort"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// The "anything unusual?" rules. Pure: bucketed rows in, findings out, no
// I/O and no language model. Every amount is integer xu; ratios are only
// compared as integer cross-products (a*100 >= usual*pct), never floats.
//
// "Usual" is always the MEDIAN over the baseline samples that had spending
// (a day the User spent nothing says nothing about a spending day), so one
// big day in the history cannot drag the yardstick up the way a mean would.
// A rule fires only when ALL of its conditions hold:
//
//   - History: at least unit.minHistory baseline samples with spending
//     (10 days of 56, 4 weeks of 8, 3 cycles of 6); otherwise status
//     little_history and no rule runs.
//   - Total: total >= 2x usual, AND total - usual >= unit.minExcess
//     (200.000đ day, 500.000đ week, 1.000.000đ cycle), AND total above the
//     baseline's 90th percentile. For a day, usual is the higher of a usual
//     day and a usual same weekday (when 3+ same-weekday days had spending),
//     so a habitually big Saturday is not flagged every Saturday.
//   - Category: the Category had spending in 3+ baseline samples, AND its
//     period amount >= 3x (day) / 2x (week, cycle) its usual (for a day, the
//     higher of its usual day and usual same weekday), AND the excess
//     >= unit.minExcess. A Category with NO spending in the whole baseline is
//     "new" when its period amount >= unit.minNew (500.000đ day, 1.000.000đ
//     week, 2.000.000đ cycle). One or two past samples: not judged.
//   - Large expense: with 5+ baseline expenses in its Category, amount >= 3x
//     their median AND above their 90th percentile AND >= 200.000đ. With
//     fewer, against all baseline expenses (10+ needed): same ratios, and
//     >= 500.000đ.
//   - Count: number of expenses >= 2x the usual count AND at least 5 more.
//   - Income: 3+ baseline incomes, AND an income above every one of them
//     AND >= 2x their median AND >= 1.000.000đ.
//
// Only rises are reported. A period still in progress is compared as it
// stands, never projected, so "less than usual so far" is not news.

type anomalyCategory struct {
	id      uuid.UUID
	name    string
	amount  int64
	typical *int64 // nil: no spending in the whole baseline
}

type anomalyTx struct {
	row        model.AnalyticsExpense
	typical    int64
	ofCategory bool // typical is the row's own Category's usual expense
}

type anomalyFindings struct {
	status       string
	total, count int64
	history      int
	typical      *int64
	weekday      bool // typical is the usual same weekday
	typicalCount *int64
	totalSpike   bool
	countSpike   bool
	categories   []anomalyCategory
	large        []anomalyTx
	income       []model.AnalyticsExpense
}

const (
	anomalyStatusFound  = "found"
	anomalyStatusNone   = "none"
	anomalyStatusLittle = "little_history"
)

func evaluateAnomaly(d anomalyData, currency string) anomalyFindings {
	f := anomalyFindings{status: anomalyStatusNone, count: int64(len(d.period))}
	for _, r := range d.period {
		f.total += r.Amount
	}
	totals, counts, weekday := anomalySampleTotals(d)
	f.history = len(totals)
	if f.history < d.unit.minHistory {
		f.status = anomalyStatusLittle
		return f
	}

	typical := medianOf(totals)
	if len(weekday) >= common.AnomalyMinWeekdaySamples {
		if w := medianOf(weekday); w > typical {
			typical, f.weekday = w, true
		}
	}
	typicalCount := medianOf(counts)
	f.typical, f.typicalCount = &typical, &typicalCount

	f.totalSpike = f.total*common.AnalyticsPercentScale >= typical*common.AnomalyTotalRatioPct &&
		f.total-typical >= anomalyMin(d.unit.minExcess, currency) && f.total > p90Of(totals)
	f.countSpike = f.count*common.AnalyticsPercentScale >= typicalCount*common.AnomalyCountRatioPct &&
		f.count-typicalCount >= common.AnomalyCountMinExcess
	f.categories = anomalyCategories(d, currency)
	f.large = anomalyLargeExpenses(d, currency)
	f.income = anomalyIncome(d, currency)

	if f.totalSpike || f.countSpike || len(f.categories) > 0 || len(f.large) > 0 || len(f.income) > 0 {
		f.status = anomalyStatusFound
	}
	return f
}

// anomalySampleTotals: total and count per baseline sample with spending,
// and the totals of the same-weekday ones among them.
func anomalySampleTotals(d anomalyData) (totals, counts, weekday []int64) {
	for i, sample := range d.baseline {
		var total int64
		for _, r := range sample {
			total += r.Amount
		}
		if total <= 0 {
			continue
		}
		totals = append(totals, total)
		counts = append(counts, int64(len(sample)))
		if d.sameWeekday != nil && d.sameWeekday[i] {
			weekday = append(weekday, total)
		}
	}
	return totals, counts, weekday
}

func anomalyCategories(d anomalyData, currency string) []anomalyCategory {
	amounts, names, order := map[uuid.UUID]int64{}, map[uuid.UUID]string{}, []uuid.UUID{}
	for _, r := range d.period {
		if _, seen := amounts[r.CategoryID]; !seen {
			order = append(order, r.CategoryID)
		}
		amounts[r.CategoryID] += r.Amount
		names[r.CategoryID] = r.CategoryName
	}
	// Per Category: its total in each sample with spending in it, and in
	// those of them on the period's weekday.
	past, pastWeekday := map[uuid.UUID][]int64{}, map[uuid.UUID][]int64{}
	for i, sample := range d.baseline {
		perSample := map[uuid.UUID]int64{}
		for _, r := range sample {
			perSample[r.CategoryID] += r.Amount
		}
		for id, amount := range perSample {
			if amount <= 0 {
				continue
			}
			past[id] = append(past[id], amount)
			if d.sameWeekday != nil && d.sameWeekday[i] {
				pastWeekday[id] = append(pastWeekday[id], amount)
			}
		}
	}
	var out []anomalyCategory
	for _, id := range order {
		amount, samples := amounts[id], past[id]
		switch {
		case len(samples) == 0 && amount >= anomalyMin(d.unit.minNew, currency):
			out = append(out, anomalyCategory{id: id, name: names[id], amount: amount})
		case len(samples) >= common.AnomalyCategoryMinSamples:
			typical := medianOf(samples)
			// The same yardstick as the total: a habitually big weekday is
			// not news through its Category either.
			if wd := pastWeekday[id]; len(wd) >= common.AnomalyMinWeekdaySamples {
				typical = max(typical, medianOf(wd))
			}
			if amount*common.AnalyticsPercentScale >= typical*d.unit.categoryRatioPct &&
				amount-typical >= anomalyMin(d.unit.minExcess, currency) {
				out = append(out, anomalyCategory{id: id, name: names[id], amount: amount, typical: &typical})
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].excess() > out[j].excess() })
	return capFindings(out)
}

func (c anomalyCategory) excess() int64 {
	if c.typical == nil {
		return c.amount
	}
	return c.amount - *c.typical
}

func anomalyLargeExpenses(d anomalyData, currency string) []anomalyTx {
	byCategory := map[uuid.UUID][]int64{}
	var all []int64
	for _, sample := range d.baseline {
		for _, r := range sample {
			byCategory[r.CategoryID] = append(byCategory[r.CategoryID], r.Amount)
			all = append(all, r.Amount)
		}
	}
	var out []anomalyTx
	for _, r := range d.period {
		if own := byCategory[r.CategoryID]; len(own) >= common.AnomalyTxMinSamples {
			if typical, ok := anomalyStandsOut(r.Amount, own, anomalyMin(common.AnomalyMinLargeTxXu, currency)); ok {
				out = append(out, anomalyTx{row: r, typical: typical, ofCategory: true})
			}
		} else if len(all) >= common.AnomalyTxFallbackSamples {
			if typical, ok := anomalyStandsOut(r.Amount, all, anomalyMin(common.AnomalyMinLargeTxFallbackXu, currency)); ok {
				out = append(out, anomalyTx{row: r, typical: typical})
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].row.Amount > out[j].row.Amount })
	return capFindings(out)
}

// anomalyStandsOut: amount >= 3x the median of past, above their 90th
// percentile, and at least minimum. Returns the median it was judged by.
func anomalyStandsOut(amount int64, past []int64, minimum int64) (int64, bool) {
	typical := medianOf(past)
	ok := amount >= minimum && amount > p90Of(past) &&
		amount*common.AnalyticsPercentScale >= typical*common.AnomalyTxRatioPct
	return typical, ok
}

func anomalyIncome(d anomalyData, currency string) []model.AnalyticsExpense {
	if len(d.baselineIncome) < common.AnomalyIncomeMinSamples {
		return nil
	}
	largest, typical := maxOf(d.baselineIncome), medianOf(d.baselineIncome)
	var out []model.AnalyticsExpense
	for _, r := range d.periodIncome {
		if r.Amount > largest && r.Amount >= anomalyMin(common.AnomalyMinIncomeXu, currency) &&
			r.Amount*common.AnalyticsPercentScale >= typical*common.AnomalyIncomeRatioPct {
			out = append(out, r)
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Amount > out[j].Amount })
	return capFindings(out)
}
