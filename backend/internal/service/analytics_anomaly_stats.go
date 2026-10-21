package service

import (
	"sort"

	"github.com/example/pfm/backend/internal/common"
)

// Small integer statistics for the anomaly rules (analytics_anomaly_rules.go).
// Amounts in, amounts out: no float anywhere.

// anomalyMin is a VND minimum in the answer's currency: as is for VND,
// scaled to minor units of a dollar-sized unit otherwise.
func anomalyMin(vndXu int64, currency string) int64 {
	if currency == common.WalletDefaultCurrency {
		return vndXu
	}
	return vndXu / common.AnomalyForeignDivisor
}

func capFindings[T any](items []T) []T {
	if len(items) > common.AnomalyMaxFindings {
		return items[:common.AnomalyMaxFindings]
	}
	return items
}

// medianOf is the middle value (half-up mean of the two middle ones for an
// even count); 0 for no values.
func medianOf(values []int64) int64 {
	s := sortedCopy(values)
	n := len(s)
	switch {
	case n == 0:
		return 0
	case n%2 == 1:
		return s[n/2]
	}
	return divRoundHalfUp(s[n/2-1]+s[n/2], 2)
}

// p90Of is the nearest-rank 90th percentile: the ceil(0.9n)-th smallest.
func p90Of(values []int64) int64 {
	s := sortedCopy(values)
	if len(s) == 0 {
		return 0
	}
	return s[(9*len(s)+9)/10-1]
}

func maxOf(values []int64) int64 {
	var m int64
	for _, v := range values {
		m = max(m, v)
	}
	return m
}

func sortedCopy(values []int64) []int64 {
	s := append([]int64(nil), values...)
	sort.Slice(s, func(i, j int) bool { return s[i] < s[j] })
	return s
}
