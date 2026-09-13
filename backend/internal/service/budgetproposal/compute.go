// Package budgetproposal turns a user's income, commitments and lifestyle
// answer into a concrete budget per category.
//
// Three properties define it, and every one of them was a defect in v1:
//
//  1. It is DETERMINISTIC. The same input produces byte-identical output, on
//     every run, forever. v1 iterated a Go map to match category keywords, and
//     Go randomizes map order — a category matching two patterns got a
//     different budget depending on the run.
//  2. It is INTEGER. Every value is int64 xu end to end, with proportional
//     division through common.MulDiv. v1 computed in float64 and truncated,
//     so `sum(entries) + unallocated` did not equal income.
//  3. It has NO I/O. No database, no network, no clock, no LLM. An LLM cannot
//     be trusted to do arithmetic and does not need to: this is a formula, and
//     a formula that runs in-process is free, instant, reproducible, and
//     unaffected by the AI service being down.
package budgetproposal

import (
	"errors"
	"fmt"

	"github.com/example/pfm/backend/internal/common"
)

var (
	// ErrDisposableNonPositive — fixed costs plus savings already consume the
	// whole income. There is nothing to allocate, and proposing a budget
	// anyway would mean inventing money.
	ErrDisposableNonPositive = errors.New("budgetproposal: disposable is not positive")
	// ErrNoIntents — nothing to budget for.
	ErrNoIntents = errors.New("budgetproposal: no category intents")
	// ErrDisposableTooSmall — too little money for this many categories to each
	// clear the minimum. See the note at the check itself for why this is an
	// error rather than a silently degraded plan.
	ErrDisposableTooSmall = errors.New("budgetproposal: disposable too small for the category count")
)

// PlanInput is everything the allocator needs. All amounts are xu.
type PlanInput struct {
	Income        int64
	FixedTotal    int64
	SavingsTarget int64
	// Preset fills in amounts for intents that arrive with Source=preset and no
	// amount of their own. Empty when every intent carries its own figure.
	Preset  common.BudgetPresetKey
	Intents []CategoryIntent
}

// Entry is one category's finished proposal.
type Entry struct {
	CategoryID   string
	CategoryName string
	SystemKey    string
	// The band. AmountMax is what becomes budget_limits.amount_limit; AmountMin
	// exists only for display and for classifying spend (see band.go).
	AmountMin  int64
	AmountMax  int64
	Source     IntentSource
	Locked     bool
	Confidence float64
	// Concrete grounding for the number, or empty. Empty renders as the
	// confidence badge alone — never as a filler sentence. v1 emitted "AI đề
	// xuất mức chi tiêu tiêu biểu…" on every row, which carried no information
	// and made the rows that DID have evidence look identical to the ones that
	// did not.
	Evidence string
}

// Result is the finished allocation.
type Result struct {
	Disposable int64
	Entries    []Entry
	// Everything not allocated to a category: the buffer, plus rounding
	// remainder, plus anything a ceiling clipped. It is NOT a category — no
	// transaction can be filed against it and it never appears in a picker.
	UnallocatedAmount int64
	// The user's own fixed amounts already exceed what can be allocated. The
	// engine reports this instead of scaling them down: they stated absolute
	// figures, and quietly shrinking a stated figure destroys the instruction.
	OverCommitted bool
	Shortfall     int64
	// True only when at least one xu was actually removed from some category.
	// v1 set this whenever the reduction loop RAN, so the UI warned about a
	// scale-down that had not happened.
	ScaledDown bool
}

// Compute runs the allocation. The step order is fixed and must not be
// reordered — quantization in particular has to run last, because rounding a
// figure and then scaling it produces amounts that are no longer round.
func Compute(in PlanInput) (Result, error) {
	disposable := in.Income - in.FixedTotal - in.SavingsTarget
	if disposable <= 0 {
		return Result{}, ErrDisposableNonPositive
	}

	intents := ResolveIntents(in.Intents)
	if len(intents) == 0 {
		return Result{}, ErrNoIntents
	}

	n := len(intents)
	floor := common.BudgetWizardMinAmountPerCategoryXu
	capAllocatable := common.MulDiv(disposable, common.BudgetWizardAllocatableNum, common.BudgetWizardAllocatableDen)

	// Feasibility, checked up front rather than discovered half way through.
	//
	// Every category needs the floor, and only the allocatable share is
	// available to pay for them. Below that the allocator can only produce a
	// plan that violates its own rules, so it refuses and says how much is
	// needed — which the user can act on (earn more, save less, or budget for
	// fewer categories). Degrading silently would hand back a plan whose
	// numbers quietly mean nothing.
	required := common.MulDiv(floor*int64(n), common.BudgetWizardAllocatableDen, common.BudgetWizardAllocatableNum) + 1
	if capAllocatable < floor*int64(n) {
		return Result{}, fmt.Errorf("%w: need at least %d xu for %d categories", ErrDisposableTooSmall, required, n)
	}

	amounts := make([]int64, n)
	locked := make([]bool, n)
	for i, it := range intents {
		locked[i] = it.Locked
		amt, err := centreAmount(it, in.Preset, disposable)
		if err != nil {
			return Result{}, err
		}
		amounts[i] = amt
	}

	res := Result{Disposable: disposable}

	// Scale down to fit, touching only what the user did not lock.
	var sumLocked, sumUnlocked int64
	for i := range amounts {
		if locked[i] {
			sumLocked += amounts[i]
		} else {
			sumUnlocked += amounts[i]
		}
	}
	if sumLocked > capAllocatable {
		res.OverCommitted = true
		res.Shortfall = sumLocked - capAllocatable
	} else if sumLocked+sumUnlocked > capAllocatable && sumUnlocked > 0 {
		room := capAllocatable - sumLocked
		for i := range amounts {
			if locked[i] {
				continue
			}
			scaled := common.MulDiv(amounts[i], room, sumUnlocked)
			if scaled < amounts[i] {
				res.ScaledDown = true
			}
			amounts[i] = scaled
		}
	}

	ceiling := common.MulDiv(disposable, common.BudgetWizardMaxShareNum, common.BudgetWizardMaxShareDen)
	if reduced := reconcile(amounts, locked, floor, ceiling, n == 1); reduced > 0 {
		res.ScaledDown = true
	}

	// Rounding runs last, over the settled figures.
	maxes := quantize(amounts, locked, floor, capAllocatable)

	res.Entries = make([]Entry, n)
	var allocated int64
	for i, it := range intents {
		min := bandFloorFor(maxes[i], it.Source, locked[i], floor)
		res.Entries[i] = Entry{
			CategoryID:   it.CategoryID,
			CategoryName: it.CategoryName,
			SystemKey:    it.SystemKey,
			AmountMin:    min,
			AmountMax:    maxes[i],
			Source:       it.Source,
			Locked:       it.Locked,
			Confidence:   it.Confidence,
			Evidence:     it.Evidence,
		}
		allocated += maxes[i]
	}

	// ⚠️ The invariant this whole package exists to hold: the buffer absorbs
	// every remainder, so allocated + unallocated is EXACTLY disposable. Not
	// approximately — exactly. Any drift here is money appearing or vanishing
	// on the user's screen.
	res.UnallocatedAmount = disposable - allocated
	return res, nil
}
