package service

import (
	"strings"
	"time"
	"unicode/utf8"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/repository"
)

// intentionField is one failing field of a spending intention, in the shape of
// the other 400 responses' `details` entries.
type intentionField struct {
	Field string `json:"field"`
	Rule  string `json:"rule"`
}

// Rules named in intentionField.Rule. The client maps each field to its own
// copy; the rule says what to fix.
const (
	intentionRuleRequired   = "required"
	intentionRuleRange      = "range"
	intentionRuleNotAllowed = "not_allowed"
	intentionRuleFormat     = "format"
	intentionRulePast       = "past"
	intentionRuleTooFar     = "too_far"
	intentionRuleMax        = "max"
	intentionRuleUnknown    = "unknown"
)

// intentionRules is where the rules about one intention live, so a save from
// the form, an edit and a draft read from a sentence cannot disagree
// (spec.md BR-09…BR-14).
type intentionRules struct {
	// currency is the plan's currency, already resolved.
	currency string
	// currentMonth is the first day of the current cycle's month.
	currentMonth time.Time
	// movePast: a month before the current one is moved to it (a draft read
	// from a sentence, spec.md EC-01) instead of refused (a save, S-INT-22).
	movePast bool
	// lenient: a draft may still miss what a save needs (an instalment with no
	// month count, spec.md EC-02); the card asks for it in the edit form.
	lenient bool
}

// normalizedIntention is a checked intention with every amount resolved.
type normalizedIntention struct {
	params repository.SpendingIntentionParams
	// monthMoved is set when a past month was replaced by the current one.
	monthMoved bool
}

// normalize checks the editable set and works out the amounts it leaves open.
// Every independent problem is returned, not just the first (spec.md BR-17).
func (r intentionRules) normalize(in dto.SpendingIntentionRequest) (normalizedIntention, []intentionField) {
	var problems []intentionField
	add := func(field, rule string) { problems = append(problems, intentionField{Field: field, Rule: rule}) }
	out := normalizedIntention{params: repository.SpendingIntentionParams{Kind: in.Kind, CategoryID: in.CategoryID, Currency: r.currency}}

	title := strings.TrimSpace(in.Title)
	switch {
	case title == "":
		add("title", intentionRuleRequired)
	case utf8.RuneCountInString(title) > common.IntentionTitleMaxLen:
		add("title", intentionRuleMax)
	}
	out.params.Title = title
	out.params.Note = trimmedNote(in.Note)

	total, monthly, months := in.TotalAmount, in.MonthlyAmount, in.InstallmentMonths
	if total != nil && !amountInRange(*total) {
		add("total_amount", intentionRuleRange)
	}
	if monthly != nil && !amountInRange(*monthly) {
		add("monthly_amount", intentionRuleRange)
	}

	switch in.Kind {
	case common.IntentionKindOneTime:
		if months != nil {
			add("installment_months", intentionRuleNotAllowed)
		}
		if monthly != nil {
			add("monthly_amount", intentionRuleNotAllowed)
		}
		out.params.TotalAmount = total
	case common.IntentionKindInstallment:
		total, monthly = r.resolveInstallment(total, monthly, months, add)
		if r.lenient && months != nil && (*months < common.IntentionInstallmentMinMonths || *months > common.IntentionInstallmentMaxMonths) {
			months = nil // the card asks for a usable count in the edit form
		}
		out.params.TotalAmount, out.params.MonthlyAmount, out.params.InstallmentMonths = total, monthly, months
	default:
		add("kind", intentionRuleUnknown)
	}

	out.params.TargetMonth, out.monthMoved = r.targetMonth(in.TargetMonth, add)
	if r.lenient {
		problems = lenientProblems(problems)
	}
	return out, problems
}

// resolveInstallment works out the missing one of total and monthly payment
// (spec.md A-04): a total with a month count gives the payment rounded up, so
// the payments always cover the total; a payment gives the total by
// multiplying. Both given stay as stated.
func (r intentionRules) resolveInstallment(total, monthly *int64, months *int, add func(field, rule string)) (*int64, *int64) {
	switch {
	case months == nil:
		add("installment_months", intentionRuleRequired)
	case *months < common.IntentionInstallmentMinMonths || *months > common.IntentionInstallmentMaxMonths:
		add("installment_months", intentionRuleRange)
	}
	if total == nil && monthly == nil {
		add("total_amount", intentionRuleRequired)
		return total, monthly
	}
	if months == nil || *months < common.IntentionInstallmentMinMonths || *months > common.IntentionInstallmentMaxMonths {
		return total, monthly
	}
	n := int64(*months)
	switch {
	case monthly == nil && amountInRange(*total):
		payment := roundUp(divCeil(*total, n), r.currency)
		monthly = &payment
	case total == nil && amountInRange(*monthly):
		sum := *monthly * n
		total = &sum
	}
	return total, monthly
}

// targetMonth reads "YYYY-MM" (empty = the current cycle's month) into the
// first day of that month, and applies the window of spec.md BR-14.
func (r intentionRules) targetMonth(raw string, add func(field, rule string)) (time.Time, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return r.currentMonth, false
	}
	month, err := time.ParseInLocation(common.IntentionMonthLayout, raw, time.UTC)
	if err != nil {
		add("target_month", intentionRuleFormat)
		return r.currentMonth, false
	}
	switch {
	case monthIndex(month) < monthIndex(r.currentMonth):
		if r.movePast {
			return r.currentMonth, true
		}
		add("target_month", intentionRulePast)
	case monthIndex(month) > monthIndex(r.currentMonth)+common.IntentionMonthsAheadMax:
		add("target_month", intentionRuleTooFar)
	}
	return month, false
}

// lenientProblems keeps only what makes a draft unreadable. A card that merely
// misses a month count or an amount is still shown, incomplete (spec.md EC-02).
func lenientProblems(problems []intentionField) []intentionField {
	var kept []intentionField
	for _, p := range problems {
		unreadable := p.Field == "title" || p.Field == "kind" || (p.Rule == intentionRuleRange && p.Field != "installment_months")
		if unreadable {
			kept = append(kept, p)
		}
	}
	return kept
}

func amountInRange(xu int64) bool { return xu > 0 && xu <= common.IntentionAmountCapXu }

func trimmedNote(note *string) *string {
	if note == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*note)
	if trimmed == "" || utf8.RuneCountInString(trimmed) > common.IntentionNoteMaxLen {
		return nil
	}
	return &trimmed
}

// monthIndex counts months so two months compare as plain integers.
func monthIndex(t time.Time) int { return t.Year()*12 + int(t.Month()) - 1 }

// monthStart is the first day of t's month as a UTC-midnight date.
func monthStart(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// monthLabel is the wire form of a month, "YYYY-MM".
func monthLabel(t time.Time) string { return t.Format(common.IntentionMonthLayout) }
