package budgetproposal

import "github.com/example/pfm/backend/internal/common"

// Band widths, as percentages of the centre amount. Expressed as integer
// numerators over 100 so the arithmetic stays exact (common.MulDiv).
const (
	presetBandLowPct  int64 = 85
	presetBandHighPct int64 = 115
	histBandLowPct    int64 = 92
	histBandHighPct   int64 = 110
)

// band turns a single centre amount into the min–max range the UI shows.
//
// WHY A RANGE AT ALL: a first budget is an estimate, and rendering an estimate
// as one hard number invites the user to read it as a promise. When they then
// spend 3% over it, the app has to call that a failure — which it is not. A
// band lets "slightly over the middle" be reported as still fine, and keeps the
// word "vượt" for when it is actually true.
//
// The width IS the confidence. A preset guess gets the widest band because the
// system knows the least; a number the user stated gets none at all, because
// there is nothing to be uncertain about.
func band(center int64, source IntentSource) (min, max int64) {
	switch source {
	case SourceStated, SourceManual:
		// The user decided. Widening it would be the app second-guessing an
		// instruction it was given directly.
		return center, center
	case SourceHistory:
		// Phase 3 replaces this with the real p40–p75 spread once history is
		// available; until then a narrow symmetric band, since a median of
		// actual spending is already far better grounded than a preset.
		return common.MulDiv(center, histBandLowPct, 100), common.MulDiv(center, histBandHighPct, 100)
	default:
		return common.MulDiv(center, presetBandLowPct, 100), common.MulDiv(center, presetBandHighPct, 100)
	}
}

// SpendState classifies actual spending against a band. Shared by the proposal
// screen, the budget list and the moment-of-spend line so those three surfaces
// can never disagree about the same budget.
type SpendState string

const (
	SpendStateUnder    SpendState = "under"
	SpendStateInBand   SpendState = "in_band"
	SpendStateOverEdge SpendState = "over_edge"
	SpendStateOver     SpendState = "over"
)

// overEdgeTolerancePct is how far past the band's top edge still counts as
// "just over" rather than "over" — 15%.
const overEdgeTolerancePct int64 = 115

// ClassifySpend maps spend against a band.
//
// ⚠️ None of these four states is rendered in red. Red is reserved for system
// errors. Overspending is a fact about a number, not a verdict on the person,
// and an app that scolds is an app that gets avoided — at which point it can no
// longer help with anything.
func ClassifySpend(spent, min, max int64) SpendState {
	switch {
	case spent < min:
		return SpendStateUnder
	case spent <= max:
		return SpendStateInBand
	case spent <= common.MulDiv(max, overEdgeTolerancePct, 100):
		return SpendStateOverEdge
	default:
		return SpendStateOver
	}
}
