package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// Savings-goal scenario: "cần 30tr vào tháng 12 thì mỗi tháng chi thế nào".
// The interpreter only extracts the target, deadline and stated monthly
// saving; every figure below is computed here (plan.md BR-11). No interest,
// inflation or forecasting — plain division against recent history.
const (
	scenarioBaselineCycles = 3
	// scenarioMaxMonths bounds a plan to something worth showing (50 years).
	scenarioMaxMonths = 600
	// scenarioRoundXu rounds the monthly amount up to whole 1.000đ.
	scenarioRoundXu = 1_000 * common.VNDToCentsFactor
	viDateFmt       = "02/01/2006"

	msgScenarioPast    = "Mốc thời gian này đã qua. Chọn một mốc trong tương lai."
	msgScenarioNoPlan  = "Các tháng gần đây chưa có khoản dư để ước tính thời gian. Thử nêu mốc thời gian hoặc số tiền để dành mỗi tháng."
	msgScenarioTooLong = "Với mức này sẽ mất quá lâu để đạt mục tiêu. Thử tăng số tiền để dành mỗi tháng."
)

// scenarioBaseline is the average monthly income/expense over the last
// completed cycles that had any activity in the answer currency.
type scenarioBaseline struct {
	cycles  int
	income  int64
	expense int64
	monthly bool
}

func (s *ConsultService) routeScenario(ctx context.Context, userID uuid.UUID, p *AIConsultParse, currency string, out consultOutcome) (consultOutcome, error) {
	base, err := s.scenarioBaseline(ctx, userID, currency)
	if err != nil {
		return consultOutcome{}, fmt.Errorf("service.ConsultService.routeScenario: %w", err)
	}
	loc := s.cycles.Location()
	today := localMidnight(s.cycles.Now(), loc)

	sc, msg := planScenario(p, base, today, loc, currency)
	if sc == nil {
		out.reply = &dto.ConsultResponse{Kind: string(model.ConsultKindUnsupported), Message: msg, Chips: starterChips(currency)[:2]}
		return out, nil
	}
	out.outcome = model.IntentOutcomeAnswered
	out.reply = &dto.ConsultResponse{
		Kind: string(model.ConsultKindScenario), Message: summaryScenario(sc, base.monthly),
		Scenario: sc, Chips: starterChips(currency)[:2],
	}
	return out, nil
}

func (s *ConsultService) scenarioBaseline(ctx context.Context, userID uuid.UUID, currency string) (scenarioBaseline, error) {
	day, err := s.cycles.plans.ActiveCycleStartDay(ctx, userID)
	if err != nil {
		return scenarioBaseline{}, err
	}
	now, loc := s.cycles.Now(), s.cycles.Location()
	base := scenarioBaseline{monthly: ResolveCycleWindow(now, day, 0, loc).Start.In(loc).Day() == budgetCycleMinDay}
	for offset := -1; offset >= -scenarioBaselineCycles; offset-- {
		w := ResolveCycleWindow(now, day, offset, loc)
		rows, err := s.analytics.reports.SumTotals(ctx, userID, repository.ReportFilter{From: w.Start, To: w.End.Add(-reportBoundResolution)})
		if err != nil {
			return scenarioBaseline{}, err
		}
		var income, expense int64
		for _, row := range rows {
			if row.Currency != currency {
				continue
			}
			switch row.Type {
			case string(model.TransactionTypeIncome):
				income += row.Amount
			case string(model.TransactionTypeExpense):
				expense += row.Amount
			}
		}
		if income == 0 && expense == 0 {
			continue
		}
		base.cycles++
		base.income += income
		base.expense += expense
	}
	if base.cycles > 0 {
		base.income /= int64(base.cycles)
		base.expense /= int64(base.cycles)
	}
	return base, nil
}

// planScenario returns the plan, or nil and the reason it cannot be made.
func planScenario(p *AIConsultParse, base scenarioBaseline, today time.Time, loc *time.Location, currency string) (*dto.ConsultScenario, string) {
	goal := *p.GoalAmountVND * common.VNDToCentsFactor
	sc := &dto.ConsultScenario{Currency: currency, Goal: goal, BaselineCycles: base.cycles}

	switch deadline, err := time.ParseInLocation(common.DateOnlyLayout, p.GoalDeadline, loc); {
	case p.GoalDeadline != "" && err == nil:
		if !deadline.After(today) {
			return nil, msgScenarioPast
		}
		sc.Deadline = p.GoalDeadline
		sc.Months = monthsUntil(today, deadline)
		sc.MonthlySave = roundUpXu(divCeil(goal, int64(sc.Months)))
	case p.MonthlySaveVND != nil:
		sc.MonthlySave = *p.MonthlySaveVND * common.VNDToCentsFactor
		sc.Months = int(divCeil(goal, sc.MonthlySave))
	case base.cycles > 0 && base.income > base.expense:
		sc.MonthlySave = base.income - base.expense
		sc.Months = int(divCeil(goal, sc.MonthlySave))
	default:
		return nil, msgScenarioNoPlan
	}
	if sc.Months > scenarioMaxMonths {
		return nil, msgScenarioTooLong
	}

	if base.cycles > 0 {
		income, expense := base.income, base.expense
		spendCap := income - sc.MonthlySave
		cut := max(expense-spendCap, 0)
		feasible := income-expense >= sc.MonthlySave
		sc.AvgIncome, sc.AvgExpense, sc.SpendCap, sc.CutNeeded, sc.Feasible = &income, &expense, &spendCap, &cut, &feasible
	}
	return sc, ""
}

// monthsUntil counts the saving months from today to the deadline: whole
// calendar months, plus the deadline's own month when it falls later in the
// month than today. Always at least 1.
func monthsUntil(today, deadline time.Time) int {
	months := (deadline.Year()-today.Year())*12 + int(deadline.Month()-today.Month())
	if deadline.Day() > today.Day() {
		months++
	}
	return max(months, 1)
}

func divCeil(a, b int64) int64 { return (a + b - 1) / b }

func roundUpXu(x int64) int64 { return divCeil(x, scenarioRoundXu) * scenarioRoundXu }

func summaryScenario(sc *dto.ConsultScenario, monthly bool) string {
	m := func(x int64) string { return common.FormatCentsVI(x, sc.Currency) }
	var head string
	switch {
	case sc.Deadline != "":
		d, _ := time.Parse(common.DateOnlyLayout, sc.Deadline)
		head = fmt.Sprintf("Để có %s trước %s (còn %d tháng), mỗi tháng cần để dành %s.", m(sc.Goal), d.Format(viDateFmt), sc.Months, m(sc.MonthlySave))
	default:
		head = fmt.Sprintf("Để dành %s mỗi tháng thì khoảng %d tháng nữa sẽ có %s.", m(sc.MonthlySave), sc.Months, m(sc.Goal))
	}
	if sc.AvgIncome == nil {
		return head + " Chưa đủ dữ liệu thu chi các tháng trước để gợi ý mức chi."
	}
	span := fmt.Sprintf("%d %s qua", sc.BaselineCycles, cycleUnit(monthly))
	if *sc.SpendCap <= 0 {
		return head + fmt.Sprintf(" Thu nhập trung bình %s là %s, chưa đủ để dành mức này. Thử lùi mốc hoặc giảm mục tiêu.", span, m(*sc.AvgIncome))
	}
	avg := fmt.Sprintf(" Trung bình %s thu %s, chi %s", span, m(*sc.AvgIncome), m(*sc.AvgExpense))
	if *sc.Feasible {
		return head + avg + fmt.Sprintf(". Giữ chi tiêu dưới %s/tháng là đạt.", m(*sc.SpendCap))
	}
	return head + avg + fmt.Sprintf(". Để đạt mục tiêu, mỗi tháng chi tối đa %s, tức giảm khoảng %s so với hiện tại.", m(*sc.SpendCap), m(*sc.CutNeeded))
}
