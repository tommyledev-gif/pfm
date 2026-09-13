package budgetproposal

import "github.com/example/pfm/backend/internal/common"

// Persona is a statement about how much DATA a user has, not about who they
// are. It is derived, never asked — asking a user to self-classify would be
// asking them to guess at something the system already knows exactly.
type Persona string

const (
	// PersonaCold — no usable history. The dominant case, because a user
	// installs a budgeting app precisely when they have not been tracking
	// anything. Their first budget is a hypothesis and must be presented as one.
	PersonaCold Persona = "cold"
	// PersonaWarm — some history, not enough to derive every category.
	PersonaWarm Persona = "warm"
	// PersonaHot — enough history to propose from real spending.
	PersonaHot Persona = "hot"
)

const (
	personaHotMinTx      = 40
	personaHotMinMonths  = 2
	personaWarmMinTx     = 10
	personaConfidenceLow = "low"
	personaConfidenceMed = "medium"
	personaConfidenceHi  = "high"
)

// ResolvePersona classifies from expense-transaction counts alone.
//
// Both inputs matter and neither is sufficient: 40 transactions inside a single
// week is a burst, not a pattern, and three months containing five transactions
// describes nothing. Requiring both guards against reading noise as history.
func ResolvePersona(expenseTxLast90Days, distinctExpenseMonths int) Persona {
	switch {
	case expenseTxLast90Days >= personaHotMinTx && distinctExpenseMonths >= personaHotMinMonths:
		return PersonaHot
	case expenseTxLast90Days >= personaWarmMinTx:
		return PersonaWarm
	default:
		return PersonaCold
	}
}

// ConfidenceFor is the plan-level confidence a persona starts at.
//
// It is also the schedule for re-checking: the less the system knows, the
// sooner it must come back and compare against reality. Phase 2 reads this.
func ConfidenceFor(p Persona) string {
	switch p {
	case PersonaHot:
		return personaConfidenceHi
	case PersonaWarm:
		return personaConfidenceMed
	default:
		return personaConfidenceLow
	}
}

// ClassOf resolves the cut-order class for a category.
//
// Wraps common.ClassForSystemKey so the engine never reaches for a category's
// NAME to decide anything. Name-based classification is what made v1
// non-deterministic, and it breaks the moment a user renames a category or
// writes it in a different language.
func ClassOf(systemKey string) common.CategoryClass {
	return common.ClassForSystemKey(systemKey)
}
