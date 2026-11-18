package common

import "net/http"

// Feature-12 US-06 spending intentions (specs/ai-chat-spending-intentions).
// Amounts are xu (integer cents), like every other amount in the system.
const (
	// IntentionKindOneTime / IntentionKindInstallment are the two shapes of a plan.
	IntentionKindOneTime     = "one_time"
	IntentionKindInstallment = "installment"

	// IntentionTitleMaxLen bounds the title the User sees on a card and a row.
	IntentionTitleMaxLen = 80
	// IntentionNoteMaxLen bounds the optional note.
	IntentionNoteMaxLen = 300
	// IntentionKeyMaxLen bounds the idempotency key (a chat message id is ~25).
	IntentionKeyMaxLen = 100

	// IntentionInstallmentMinMonths / IntentionInstallmentMaxMonths bound an
	// instalment plan: one payment is a one-time purchase, five years is the
	// longest plan worth modelling in whole months.
	IntentionInstallmentMinMonths = 2
	IntentionInstallmentMaxMonths = 60

	// IntentionMaxPerUser caps the active intentions a User keeps, which
	// bounds the list and the sums every figure reads.
	IntentionMaxPerUser = 50

	// IntentionMonthsAheadMax is how far ahead a plan may start (in months
	// from the current cycle).
	IntentionMonthsAheadMax = 36

	// IntentionAmountCapXu is the largest amount an intention may hold: 10 tỷ.
	// Monthly × months stays far inside int64.
	IntentionAmountCapXu int64 = 1_000_000_000_000

	// IntentionMonthLayout is the wire form of a month, YYYY-MM.
	IntentionMonthLayout = "2006-01"

	// IntentionMaxPerMessage is how many planned items one sentence may name;
	// the rest is reported as not read.
	IntentionMaxPerMessage = 5

	// IntentionPortfolioMonthsMax bounds the month-by-month view of everything
	// planned, counted from the current cycle.
	IntentionPortfolioMonthsMax = 12

	// IntentionBaselineCycles is how many completed cycles the usual income
	// and spending are averaged over — the same baseline the savings-goal plan uses.
	IntentionBaselineCycles = 3
)

const (
	ErrCodeSpendingIntentionNotFound = "SPENDING_INTENTION_NOT_FOUND"
	ErrCodeSpendingIntentionLimit    = "SPENDING_INTENTION_LIMIT_REACHED"
	ErrCodeSpendingIntentionDeleted  = "SPENDING_INTENTION_DELETED"
	intentionNotFoundMessage         = "không tìm thấy dự định chi"
	intentionLimitMessage            = "đã đạt số dự định chi tối đa"
	intentionDeletedMessage          = "dự định chi này đã bị xóa"
)

var (
	ErrSpendingIntentionNotFound = &AppError{Code: ErrCodeSpendingIntentionNotFound, Status: http.StatusNotFound, Message: intentionNotFoundMessage}
	ErrSpendingIntentionLimit    = &AppError{Code: ErrCodeSpendingIntentionLimit, Status: http.StatusConflict, Message: intentionLimitMessage}
	// ErrSpendingIntentionDeleted answers a repeated save of a card whose
	// intention the User has since deleted: it is not kept again silently.
	ErrSpendingIntentionDeleted = &AppError{Code: ErrCodeSpendingIntentionDeleted, Status: http.StatusGone, Message: intentionDeletedMessage}
)
