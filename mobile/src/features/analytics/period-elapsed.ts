import { AnalyticsPeriodInfo } from "@/features/analytics/types";

/**
 * 0..1 — how much of an answer's period has gone by. The budget bars use it
 * as their pace tick, so "60% spent" reads differently on day 5 and day 25,
 * exactly as on the Budgets screen. A period that is over (not partial) is
 * simply done; a malformed one counts as not started rather than throwing.
 */
export function periodElapsed(period: AnalyticsPeriodInfo, now = new Date()): number {
  if (!period.partial) return 1;
  const from = new Date(period.from).getTime();
  const to = new Date(period.to).getTime();
  const span = to - from;
  if (!Number.isFinite(span) || span <= 0) return 0;
  return Math.max(0, Math.min(1, (now.getTime() - from) / span));
}
