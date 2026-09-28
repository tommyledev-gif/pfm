package common

import (
	"math"
	"math/bits"
	"strconv"
	"strings"
)

// MulDiv computes a*num/den without ever overflowing the intermediate product,
// truncating toward zero.
//
// ⚠️ Why this is not just `a * num / den`: money is stored in xu, so every
// figure is already 100x its đồng value. The budget engine's proportional
// scaling multiplies an amount by another amount — at the income cap
// (≈10^12 xu) that product reaches ~10^24, while MaxInt64 is ~9.2x10^18. The
// naive expression wraps silently and produces a NEGATIVE budget, with no
// panic and no error to notice. Computing the product as a 128-bit value and
// dividing it back down removes the failure mode instead of hoping the inputs
// stay small.
//
// Saturates at MaxInt64/MinInt64 rather than wrapping if the QUOTIENT itself
// cannot fit — unreachable with validated inputs, but a wrong-but-huge number
// is far easier to spot in a test than a wrapped negative one.
func MulDiv(a, num, den int64) int64 {
	if den == 0 {
		return 0
	}

	negative := false
	abs := func(v int64) uint64 {
		if v < 0 {
			negative = !negative
			// -MinInt64 overflows int64; go through uint64 instead.
			return uint64(-(v + 1)) + 1
		}
		return uint64(v)
	}
	ua, unum, uden := abs(a), abs(num), abs(den)

	hi, lo := bits.Mul64(ua, unum)
	if hi >= uden {
		// bits.Div64 panics in this case — the quotient needs more than 64
		// bits. Saturate instead.
		if negative {
			return math.MinInt64
		}
		return math.MaxInt64
	}
	q, _ := bits.Div64(hi, lo, uden)
	if q > uint64(math.MaxInt64) {
		if negative {
			return math.MinInt64
		}
		return math.MaxInt64
	}
	if negative {
		return -int64(q)
	}
	return int64(q)
}

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

// FormatCentsVI renders xu the Vietnamese way for user-facing sentences —
// "2.450.000đ" for VND, "1.234 USD" otherwise. Truncates sub-unit cents like
// FormatCents; VND has none.
func FormatCentsVI(amountCents int64, currency string) string {
	grouped := strings.ReplaceAll(groupThousands(amountCents/VNDToCentsFactor), ",", ".")
	if currency == vndCurrencyCode {
		return grouped + vndSymbol
	}
	return grouped + " " + currency
}

const (
	vndCurrencyCode = "VND"
	vndSymbol       = "đ"
)

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
