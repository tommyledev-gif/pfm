// Mirrors backend/internal/dto/analytics_request.go + analytics_response.go
// (specs/ai-chat-query-spending/plan.md AIQ-T40). Hand-synced — there is no
// codegen. Every amount is integer xu; the client only formats it, never
// derives a new amount from it.

import type { ConsultIntentions } from "@/features/spending-intentions/types";

export type AnalyticsMetric =
  | "sum"
  | "breakdown"
  | "compare"
  | "series"
  | "top_n"
  | "max_tx"
  | "avg_daily"
  | "budget_status"
  // "Anything unusual?" — the period against the User's own history.
  | "anomaly";

export type AnalyticsPeriod =
  | "this_cycle"
  | "last_cycle"
  | "last_3_cycles"
  | "last_6_cycles"
  | "last_30_days"
  | "this_week"
  | "custom";

export interface AnalyticsQuery {
  metric: AnalyticsMetric;
  group_by?: "category" | "wallet" | "weekday";
  tx_type?: "income" | "expense";
  period: AnalyticsPeriod;
  from?: string;
  to?: string;
  category_ids?: string[];
  wallet_id?: string;
  amount_min?: number;
  limit?: number;
  currency?: string;
}

export interface AnalyticsChartItem {
  key: string;
  label: string;
  amount: number;
}

export interface AnalyticsCompare {
  current: number;
  previous: number;
  change_pct: number | null;
  current_label: string;
  previous_label: string;
}

// category_id (and a budget's own icon) arrived after answers were already
// being stored in threads — optional, so an older stored answer still renders,
// just without its Category's tile.
export interface AnalyticsTxRow {
  id: string;
  occurred_at: string;
  amount: number;
  category_id?: string;
  category_name: string;
  wallet_name: string;
}

export interface AnalyticsBudgetItem {
  budget_id: string;
  category_id?: string;
  category_name: string;
  icon?: string;
  icon_url?: string;
  limit: number;
  spent: number;
  remaining: number;
  exceeded: boolean;
}

// A flat union keyed by `type` — only the fields that type uses are set.
// Kept as `string` for type: an answer stored by a newer app version may
// carry a chart this version does not know, and must still render (as a
// list — spec.md S-AIQ-43).
export interface AnalyticsChart {
  type: string;
  value?: number;
  days?: number;
  items?: AnalyticsChartItem[];
  compare?: AnalyticsCompare;
  rows?: AnalyticsTxRow[];
  /** Continues `rows` in rank order — revealed when the list is expanded.
   *  Absent on answers stored before the backend sent it. */
  more_rows?: AnalyticsTxRow[];
  total_matched?: number;
  budgets?: AnalyticsBudgetItem[];
  // `rows` also rides on a "donut" or "number" answer whose period has only a
  // few expenses (backend attachInlineRows) — listed under the chart.
  /** Type "anomaly" only. That answer also carries `value` (the period's
   *  spending), `compare` (that against the usual) and `rows` (unusually
   *  large expenses), so an app that does not know the type still lists them. */
  anomaly?: AnalyticsAnomaly;
}

/** Mirrors backend dto/analytics_anomaly_response.go. Amounts are xu. */
export interface AnalyticsAnomaly {
  /** "found", "none" or "little_history"; kept `string` so a value a newer
   *  backend adds still renders (as its figures). */
  status: string;
  /** What one baseline sample is: "day", "week" or "cycle". */
  unit: string;
  /** The history compared with: "8 tuần trước đó". */
  baseline_label: string;
  total: number;
  count: number;
  typical?: number;
  typical_label?: string;
  typical_count?: number;
  history_samples: number;
  history_min: number;
  total_spike: boolean;
  count_spike: boolean;
  categories?: AnalyticsAnomalyCategory[];
  /** Incomes larger than any in the baseline. */
  income?: AnalyticsTxRow[];
}

/** A Category far above its usual; no `typical` when it had no spending in
 *  the whole baseline. */
export interface AnalyticsAnomalyCategory {
  category_id: string;
  category_name: string;
  amount: number;
  typical?: number;
}

export interface AnalyticsNotice {
  code: string;
  message: string;
}

export interface AnalyticsFollowUp {
  label: string;
  query: AnalyticsQuery;
}

export interface AnalyticsPeriodInfo {
  key: AnalyticsPeriod;
  label: string;
  from: string;
  to: string;
  from_date: string;
  to_date: string;
  partial: boolean;
}

export interface AnalyticsAnswer {
  schema_version: number;
  query: AnalyticsQuery;
  period: AnalyticsPeriodInfo;
  currency: string;
  summary: string;
  chart: AnalyticsChart;
  notices: AnalyticsNotice[];
  tx_count: number;
  follow_ups: AnalyticsFollowUp[];
}

export type ConsultKind =
  | "answer"
  | "clarify_category"
  | "unsupported"
  | "needs_context"
  | "coming_later"
  | "switch_mode"
  | "degraded"
  | "scenario"
  | "intention";

export interface ConsultCategoryRef {
  id: string;
  name: string;
}

export interface ConsultResponse {
  kind: ConsultKind;
  message: string;
  answer?: AnalyticsAnswer;
  banner_categories?: ConsultCategoryRef[];
  category_choices?: ConsultCategoryRef[];
  pending_query?: AnalyticsQuery;
  chips: AnalyticsFollowUp[];
  switch_to_recording?: boolean;
  scenario?: ConsultScenario;
  /** Kind "intention": proposals to keep (specs/ai-chat-spending-intentions). */
  intentions?: ConsultIntentions;
}

/** A savings-goal plan (kind "scenario"); amounts are integer cents. The
 *  averages, cap and feasibility are absent without recent history. */
export interface ConsultScenario {
  currency: string;
  goal: number;
  deadline?: string;
  months: number;
  monthly_save: number;
  baseline_cycles: number;
  avg_income?: number;
  avg_expense?: number;
  spend_cap?: number;
  cut_needed?: number;
  feasible?: boolean;
}

export interface ConsultRequest {
  message: string;
}

/**
 * What an analysis reply stores in the chat thread (spec.md US-06): the
 * reply as received, never recomputed on restore.
 */
export type ConsultMessageData = Omit<ConsultResponse, "message">;
