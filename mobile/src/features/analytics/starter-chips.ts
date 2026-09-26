import { AnalyticsFollowUp } from "@/features/analytics/types";

/**
 * The starter row shown in analysis mode (spec.md US-01, OQ #3: Q1, Q2, Q9,
 * Q10). Each chip is a complete question — tapping one needs no
 * interpretation and never counts toward the free-text limit. Mirrors the
 * backend's starterChips() in consult_routing.go, which offers the same set
 * on every fallback reply.
 */
export const STARTER_CHIPS: AnalyticsFollowUp[] = [
  { label: "Tháng này tiêu bao nhiêu?", query: { metric: "sum", period: "this_cycle" } },
  { label: "Tiền đi đâu?", query: { metric: "breakdown", group_by: "category", period: "this_cycle" } },
  { label: "Còn bao nhiêu ngân sách?", query: { metric: "budget_status", period: "this_cycle" } },
  { label: "Thu nhập tháng này", query: { metric: "sum", tx_type: "income", period: "this_cycle" } },
];
