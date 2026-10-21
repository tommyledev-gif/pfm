package common

// Amounts the app works out for the User (a monthly saving, a spending cap,
// a recent average shown as part of a plan) land on a step a person would
// pick: under 1.000.000đ they move by 5.000đ, from 1.000.000đ by 100.000đ.
// "để dành 2.735.000đ" is arithmetic output; "2.800.000đ" is a plan.
// Amounts the User typed are never rounded. Any other currency steps by one
// whole unit (100 minor units).
//
// Mirrors mobile/src/lib/currency.ts suggestedStep — the two must agree, or
// a figure the server states would differ from one the app works out.
const (
	SuggestedStepSmallXu     = 5_000 * VNDToCentsFactor
	SuggestedStepLargeXu     = 100_000 * VNDToCentsFactor
	SuggestedStepLargeFromXu = 1_000_000 * VNDToCentsFactor
	SuggestedStepMinor       = 100
)

// SuggestedStep is the rounding step for amountXu in currency. The step is
// chosen by the amount before rounding; every 100.000đ step is also a
// multiple of 5.000đ, so a figure that crosses 1.000.000đ while rounding
// still sits on a valid step.
func SuggestedStep(amountXu int64, currency string) int64 {
	if currency != WalletDefaultCurrency {
		return SuggestedStepMinor
	}
	if amountXu < SuggestedStepLargeFromXu && amountXu > -SuggestedStepLargeFromXu {
		return SuggestedStepSmallXu
	}
	return SuggestedStepLargeXu
}
