package budgetproposal

import "testing"

// S-BWZ-13: mixed weighted + ai_decides happy path — both get a proposed
// amount, unallocated is shown and is >= 10% of income.
func TestCompute_MixedWeightedAndAIDecides(t *testing.T) {
	income := int64(20_000_000)
	result := Compute(income, []Input{
		{CategoryID: "food", CategoryName: "Food", SpendingPreference: "a_lot"},
		{CategoryID: "savings", CategoryName: "Savings", SpendingPreference: "ai_decides"},
	})

	if len(result.Entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(result.Entries))
	}
	var total int64
	for _, e := range result.Entries {
		if e.Amount <= 0 {
			t.Fatalf("expected a positive proposed amount for %q, got %d", e.CategoryName, e.Amount)
		}
		total += e.Amount
	}
	if result.UnallocatedAmount != income-total {
		t.Fatalf("unallocated mismatch: got %d, want %d", result.UnallocatedAmount, income-total)
	}
	minUnallocated := income / 10
	if result.UnallocatedAmount < minUnallocated {
		t.Fatalf("expected unallocated >= 10%% of income (%d), got %d", minUnallocated, result.UnallocatedAmount)
	}
}

// S-BWZ-14: a single selected Category's ceiling lift — may reach up to
// ~90% of income, well above the normal 50% cap.
func TestCompute_SingleCategoryCeilingLift(t *testing.T) {
	income := int64(10_000_000)
	result := Compute(income, []Input{
		{CategoryID: "food", CategoryName: "Food", SpendingPreference: "normal"},
	})

	if len(result.Entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(result.Entries))
	}
	amount := result.Entries[0].Amount
	fiftyPercent := income / 2
	if amount <= fiftyPercent {
		t.Fatalf("expected the single category's amount to exceed the normal 50%% cap (%d), got %d", fiftyPercent, amount)
	}
	ninetyPercent := income * 9 / 10
	if amount > ninetyPercent {
		t.Fatalf("expected the single category's amount to stay at or below ~90%% of income (%d), got %d", ninetyPercent, amount)
	}
}

// S-BWZ-19: ai_decides baselines that alone exceed 90% of income are scaled
// down proportionally — the ceiling is never silently exceeded.
func TestCompute_AIDecidesOverflowScaling(t *testing.T) {
	income := int64(1_000_000)
	// "food"+"housing"+"saving" baselines sum to 0.25+0.15+0.20 = 0.60 of
	// income individually, but stacking enough ai_decides categories whose
	// baselines exceed 90% combined forces the overflow branch.
	result := Compute(income, []Input{
		{CategoryID: "1", CategoryName: "Food", SpendingPreference: "ai_decides"},
		{CategoryID: "2", CategoryName: "Housing", SpendingPreference: "ai_decides"},
		{CategoryID: "3", CategoryName: "Saving", SpendingPreference: "ai_decides"},
		{CategoryID: "4", CategoryName: "Transport", SpendingPreference: "ai_decides"},
		{CategoryID: "5", CategoryName: "Unmatched One", SpendingPreference: "ai_decides"},
		{CategoryID: "6", CategoryName: "Unmatched Two", SpendingPreference: "ai_decides"},
	})

	var total int64
	for _, e := range result.Entries {
		total += e.Amount
	}
	ninetyPercent := income * 9 / 10
	if total > ninetyPercent {
		t.Fatalf("expected ai_decides baselines to be scaled to at most 90%% of income (%d), got total %d", ninetyPercent, total)
	}
	minUnallocated := income / 10
	if result.UnallocatedAmount < minUnallocated {
		t.Fatalf("expected unallocated >= 10%% of income (%d) after scaling, got %d", minUnallocated, result.UnallocatedAmount)
	}
}

// Edge Case #3: a very small income with many selected Categories pushes the
// total above 90% even after the 50,000-floor clamp — the System must scale
// down further (lowest-preference first) and flag ScaledDown.
func TestCompute_SmallIncomeManyCategories_ScalesDown(t *testing.T) {
	income := int64(300_000) // 6 categories x 50,000 floor alone = 300,000 = 100% of income
	items := make([]Input, 0, 6)
	prefs := []string{"very_little", "little", "normal", "a_lot", "priority", "ai_decides"}
	for i, p := range prefs {
		items = append(items, Input{CategoryID: string(rune('a' + i)), CategoryName: "Category " + string(rune('A'+i)), SpendingPreference: p})
	}

	result := Compute(income, items)

	if !result.ScaledDown {
		t.Fatalf("expected ScaledDown to be true for a small-income/many-category case")
	}
	for _, e := range result.Entries {
		if e.Amount < 0 {
			t.Fatalf("expected no negative proposed amount, got %d for %q", e.Amount, e.CategoryName)
		}
	}
}

// S-BWZ-16 equivalent at the compute layer: every entry always gets a
// non-empty rule-based reasoning string (never LLM-generated).
func TestCompute_ReasoningIsAlwaysPopulated(t *testing.T) {
	result := Compute(5_000_000, []Input{
		{CategoryID: "1", CategoryName: "Food", SpendingPreference: "normal"},
		{CategoryID: "2", CategoryName: "Savings", SpendingPreference: "ai_decides"},
	})
	for _, e := range result.Entries {
		if e.Reasoning == "" {
			t.Fatalf("expected a non-empty reasoning string for %q", e.CategoryName)
		}
	}
}
