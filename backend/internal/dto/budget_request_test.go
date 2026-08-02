package dto

import "testing"

// S-BUD-04: an empty limits map is rejected — a Budget can never end up
// with zero currency entries.
func TestValidateLimits_EmptyRejected(t *testing.T) {
	err := ValidateLimits(map[string]int64{})
	if err == nil {
		t.Fatalf("expected an error for an empty limits map")
	}
}

// S-BUD-05/S-BUD-06: a non-positive entry is rejected.
func TestValidateLimits_NonPositiveAmountRejected(t *testing.T) {
	err := ValidateLimits(map[string]int64{"VND": 0})
	if err == nil {
		t.Fatalf("expected an error for a zero limit")
	}
}

// S-BUD-08: a currency outside the {VND, USD} allow-list is rejected.
func TestValidateLimits_UnsupportedCurrencyRejected(t *testing.T) {
	err := ValidateLimits(map[string]int64{"EUR": 100000})
	if err == nil {
		t.Fatalf("expected an error for an unsupported currency")
	}
}

// Independent per-currency checks must all be collected into one response,
// not returned one at a time (implementation-checklist.md).
func TestValidateLimits_CollectsEveryFailingEntry(t *testing.T) {
	err := ValidateLimits(map[string]int64{"EUR": 100000, "VND": 0})
	if err == nil {
		t.Fatalf("expected an error")
	}
	details, ok := err.Details.([]limitFieldError)
	if !ok {
		t.Fatalf("expected Details to be []limitFieldError, got %T", err.Details)
	}
	if len(details) != 2 {
		t.Fatalf("expected both failing entries to be collected, got %d: %+v", len(details), details)
	}
}

// S-BUD-01/S-BUD-02: valid single- and multi-currency limits pass.
func TestValidateLimits_ValidPasses(t *testing.T) {
	if err := ValidateLimits(map[string]int64{"VND": 2000000, "USD": 50000}); err != nil {
		t.Fatalf("unexpected error for valid limits: %v", err)
	}
}
