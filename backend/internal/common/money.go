package common

import (
	"strconv"
	"strings"
)

// FormatCents renders an integer-cents amount as a human-readable
// "<major-unit-integer> <CURRENCY>" string for Notification title/body
// rendering (specs/notification-handling/plan.md Finding #5). Divides by 100
// to reach major units, mirroring frontend/src/lib/currency.ts's
// toMajorUnits() — the two must never drift apart on this conversion. No
// decimal places, no locale-aware grouping — a plain thousands-comma
// grouping is enough for MVP notification text.
func FormatCents(amountCents int64, currency string) string {
	majorUnits := amountCents / 100
	return groupThousands(majorUnits) + " " + currency
}

func groupThousands(n int64) string {
	negative := n < 0
	if negative {
		n = -n
	}
	digits := strconv.FormatInt(n, 10)

	var b strings.Builder
	for i, c := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(c)
	}

	if negative {
		return "-" + b.String()
	}
	return b.String()
}
