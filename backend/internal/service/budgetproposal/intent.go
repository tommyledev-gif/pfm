package budgetproposal

import "sort"

// IntentSource is where a category's amount came from. It drives three things
// at once: which value wins when several sources describe the same category,
// how wide the displayed band is, and which badge the row carries.
type IntentSource string

const (
	// SourceStated — the user said this number outright.
	SourceStated IntentSource = "stated"
	// SourceManual — the user dragged or typed it on the proposal screen.
	SourceManual IntentSource = "manual"
	// SourceHistory — the median of what they actually spent. Phase 3.
	SourceHistory IntentSource = "history"
	// SourcePreset — derived from the lifestyle answer. Lowest confidence,
	// widest band, and the only source available in Phase 1's cold flow.
	SourcePreset IntentSource = "preset"
)

// sourceRank orders the precedence: stated > manual > history > preset.
//
// The winning source overwrites the others COMPLETELY — amounts are never
// blended. Averaging "user said 500k" with "preset says 380k" produces 440k,
// a number nobody chose and nobody can explain, and it silently discards an
// explicit instruction. It also takes the winner's confidence and evidence, so
// the badge on the row always describes the number actually shown.
func sourceRank(s IntentSource) int {
	switch s {
	case SourceStated:
		return 4
	case SourceManual:
		return 3
	case SourceHistory:
		return 2
	case SourcePreset:
		return 1
	default:
		return 0
	}
}

// CategoryIntent is the single shape every input path normalises into before
// the allocator sees it. Preset selection, history lookup and a hand-typed
// amount all become this — there is exactly one allocation engine, and adding
// an input mode must never mean adding a second one.
type CategoryIntent struct {
	CategoryID   string
	CategoryName string
	SystemKey    string
	Source       IntentSource
	// Both in xu. For a preset intent these arrive as 0 and the engine fills
	// them from the preset share.
	AmountMin int64
	AmountMax int64
	// Locked means the user fixed this number: the allocator will not scale it
	// and the quantizer will not round it. "Đúng 500k" has to stay 500k.
	Locked     bool
	Confidence float64
	Evidence   string
}

// ResolveIntents collapses duplicates by category and returns a deterministically
// ordered slice.
//
// The ordering is not cosmetic. Proportional scaling distributes a remainder,
// and which item receives it depends on iteration order — so an unstable order
// means the same input produces different budgets on different runs. Sorting by
// category id is arbitrary but stable, which is the only property that matters.
func ResolveIntents(intents []CategoryIntent) []CategoryIntent {
	winners := make(map[string]CategoryIntent, len(intents))
	for _, in := range intents {
		existing, seen := winners[in.CategoryID]
		if !seen || sourceRank(in.Source) > sourceRank(existing.Source) {
			winners[in.CategoryID] = in
		}
	}

	out := make([]CategoryIntent, 0, len(winners))
	for _, v := range winners {
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CategoryID < out[j].CategoryID })
	return out
}
