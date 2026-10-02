// Client-side mirror of the budget engine's arithmetic
// (backend/internal/service/budgetproposal, backend/internal/common/budget_wizard_v2.go).
//
// WHY A MIRROR AT ALL: wizard screen 1 has to show "còn được chi" and "đ/ngày"
// update as the user types. A round trip per keystroke is the wrong shape for
// that, and the numbers here are a subtraction and a division — not the
// allocation itself, which stays server-side and is never recomputed here.
//
// ⚠️ There is no codegen between Go and TypeScript in this project (CLAUDE.md).
// Every constant below is hand-synced. If one of them changes on the server,
// this file has to change with it, or screen 1 promises a figure screen 3 then
// contradicts.

import { floorToPerDayStep } from "@/lib/currency";

// ---------------------------------------------------------------------------
// Constants — all xu. Mirrors common/budget_wizard_v2.go.
// ---------------------------------------------------------------------------

/** 50.000đ — the smallest amount worth tracking as its own category. */
export const MIN_AMOUNT_PER_CATEGORY_XU = 5_000_000;

/** 10 tỷ đ — mirrors the backend's common.BudgetWizardIncomeCapXu. */
export const INCOME_CAP_XU = 1_000_000_000_000;

/** 88% of disposable is allocatable; the remaining 12% is the buffer. */
export const ALLOCATABLE_NUM = 88;
export const ALLOCATABLE_DEN = 100;

/** 350.000đ — derived as ceil(6 categories x 50.000đ / 0.88), not chosen. */
export const MIN_VIABLE_DISPOSABLE_XU = 35_000_000;

/** The savings slider's starting point. 10%, not the textbook 20% — a rate the
 *  user can actually hold beats one they abandon in week two. */
export const DEFAULT_SAVINGS_PCT = 10;

/** Selectable savings levels. "Chưa" is a real option: for someone whose costs
 *  already exceed their income, being told to save is noise. */
export const SAVINGS_PCT_OPTIONS = [0, 5, 10, 20] as const;


// ---------------------------------------------------------------------------

/** Mirrors budgetproposal.roundStep — the VND rounding ladder, in xu. */
export function roundStepXu(amountXu: number): number {
  if (amountXu < 10_000_000) return 500_000; // < 100.000đ  → 5.000đ
  if (amountXu < 100_000_000) return 1_000_000; // < 1.000.000đ → 10.000đ
  if (amountXu < 1_000_000_000) return 5_000_000; // < 10.000.000đ → 50.000đ
  return 10_000_000; // → 100.000đ
}

/** income − fixed − savings. May be negative; callers must handle that rather
 *  than clamping, because a negative result is exactly what screen 1 has to
 *  refuse to move past. */
export function disposableXu(incomeXu: number, fixedXu: number, savingsXu: number): number {
  return incomeXu - fixedXu - savingsXu;
}

export function savingsForPct(incomeXu: number, pct: number): number {
  return Math.floor((incomeXu * pct) / 100);
}

/**
 * How much to set aside — either as a share of income or as a flat figure.
 *
 * Both forms are needed and neither subsumes the other. A percentage is the
 * right model for someone thinking in proportions, and it tracks a pay rise on
 * its own. But plenty of people save toward a fixed commitment — a 3tr monthly
 * transfer, a loan repayment — and forcing that into a percentage means
 * recomputing it by hand every time income changes, which is exactly the
 * arithmetic this screen exists to remove.
 */
export type SavingsChoice = { kind: "pct"; pct: number } | { kind: "amount"; amountXu: number };

export function savingsAmount(choice: SavingsChoice, incomeXu: number): number {
  if (choice.kind === "amount") {
    // Never more than the income itself — the validator below then reports the
    // real problem (nothing left to spend) rather than a nonsensical negative.
    return Math.min(Math.max(choice.amountXu, 0), incomeXu);
  }
  return savingsForPct(incomeXu, choice.pct);
}

export const DEFAULT_SAVINGS_CHOICE: SavingsChoice = { kind: "pct", pct: DEFAULT_SAVINGS_PCT };

/**
 * Length of the spending cycle that contains `now`, in whole days.
 *
 * ⚠️ Never 30. A cycle starting on the 28th runs 31 days into January and 28 or
 * 29 into February, and "đ/ngày" is only correct if it divides by the real
 * number. This mirrors the backend's cycle window resolution.
 */
export function daysInCycle(cycleStartDay: number, now: Date = new Date()): number {
  const day = Math.min(Math.max(Math.trunc(cycleStartDay) || 1, 1), 28);
  const start = new Date(now.getFullYear(), now.getMonth(), day);
  // Before this month's pay day, the live cycle began last month.
  if (now.getDate() < day) start.setMonth(start.getMonth() - 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, day);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/** Spendable amount per remaining day, floored to 1.000đ.
 *  Rounding lives in lib/currency so Home's own daily figure cannot drift from
 *  this one. */
export function perDayXu(disposable: number, days: number): number {
  if (disposable <= 0 || days <= 0) return 0;
  return floorToPerDayStep(disposable / days);
}

/** The most that may be allocated across all categories. */
export function allocatableXu(disposable: number): number {
  return Math.floor((disposable * ALLOCATABLE_NUM) / ALLOCATABLE_DEN);
}

export type IncomeValidation =
  | { ok: true }
  | { ok: false; field: "income" | "fixed" | "savings"; message: string };

/**
 * Screen 1's gate. Mirrors the server's own checks — the client blocks so the
 * user gets an answer while typing, and the server re-checks because it never
 * trusts the client.
 */
export function validateIncomeStep(incomeXu: number, fixedXu: number, savingsXu: number): IncomeValidation {
  if (incomeXu <= 0) {
    return { ok: false, field: "income", message: "Thu nhập phải lớn hơn 0." };
  }
  if (incomeXu > INCOME_CAP_XU) {
    // Names the ceiling: "the maximum the app supports" gave no number to act on.
    return { ok: false, field: "income", message: "Thu nhập tối đa là 10 tỷ đ." };
  }
  const disposable = disposableXu(incomeXu, fixedXu, savingsXu);
  if (disposable <= 0) {
    return {
      ok: false,
      field: "fixed",
      message: "Chi phí cố định và tiết kiệm đã vượt thu nhập. Bạn xem lại giúp nhé.",
    };
  }
  if (disposable < MIN_VIABLE_DISPOSABLE_XU) {
    return {
      ok: false,
      field: "fixed",
      message: "Số còn lại quá nhỏ để chia thành các danh mục. Bạn giảm bớt tiết kiệm hoặc chi phí cố định nhé.",
    };
  }
  return { ok: true };
}

/**
 * The ceiling a single row may be raised to when the user edits it.
 *
 * ⚠️ This is the whole zero-sum rule in one line: a row can grow by exactly as
 * much as the buffer has left, and not a xu more. It means the total can never
 * exceed disposable WITHOUT the app quietly shrinking some other row the user
 * did not touch — which would be the app overruling a decision it was not asked
 * to revisit.
 */
export function maxEditableAmount(ownAmountXu: number, bufferXu: number): number {
  return Math.max(ownAmountXu + Math.max(bufferXu, 0), MIN_AMOUNT_PER_CATEGORY_XU);
}
