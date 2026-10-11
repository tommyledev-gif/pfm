import { currencyDecimals } from "@/lib/calculator/format";
import { toCents } from "@/lib/currency";
import { TRANSACTION_ITEM_QUANTITY_MAX } from "@/lib/constants";
import {
  AdjustmentDirection,
  AdjustmentKind,
  TransactionAdjustment,
  TransactionAdjustmentInput,
  TransactionItem,
  TransactionItemInput,
} from "@/features/transactions/types";

// Pure rules for the Items editor (specs/transaction-line-items) — mirrors
// backend service/transaction_lines.go so a gap is caught before the server
// answers 422. Money is integer cents throughout; no rounding beyond the
// currency's own decimals when parsing what was typed.

export interface ItemDraft {
  key: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
  amount: number | null;
  // Once the User types a line amount, it stops following quantity × unit price (BR-05).
  amountTouched: boolean;
}

export interface AdjustmentDraft {
  key: string;
  kind: AdjustmentKind;
  // null only for "other" before the User picks one.
  direction: AdjustmentDirection | null;
  label: string;
  amount: number | null;
}

export const ADJUSTMENT_KINDS: readonly AdjustmentKind[] = ["tax", "fee", "discount", "other"];

// Kinds whose direction is not the User's choice (BR-06).
export const FIXED_DIRECTIONS: Partial<Record<AdjustmentKind, AdjustmentDirection>> = {
  tax: "add",
  fee: "add",
  discount: "subtract",
};

const DEFAULT_QUANTITY = 1;
let keySeed = 0;
const nextKey = (): string => `line-${Date.now()}-${keySeed++}`;

export function newItemDraft(): ItemDraft {
  return { key: nextKey(), name: "", quantity: DEFAULT_QUANTITY, unitPrice: null, amount: null, amountTouched: false };
}

export function newAdjustmentDraft(kind: AdjustmentKind = "tax", amount: number | null = null, direction?: AdjustmentDirection): AdjustmentDraft {
  return { key: nextKey(), kind, direction: FIXED_DIRECTIONS[kind] ?? direction ?? null, label: "", amount };
}

/** quantity × unit price, or null when there is no unit price to multiply. */
export function prefillAmount(quantity: number, unitPrice: number | null): number | null {
  return unitPrice === null ? null : quantity * unitPrice;
}

export function isQuantityValid(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= TRANSACTION_ITEM_QUANTITY_MAX;
}

export function isItemComplete(item: ItemDraft): boolean {
  return item.name.trim() !== "" && isQuantityValid(item.quantity) && item.amount !== null && item.amount > 0;
}

export function isAdjustmentComplete(adjustment: AdjustmentDraft): boolean {
  const labelOk = adjustment.kind !== "other" || adjustment.label.trim() !== "";
  return adjustment.direction !== null && labelOk && adjustment.amount !== null && adjustment.amount > 0;
}

export function itemsTotal(items: ItemDraft[]): number {
  return items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
}

/** Items total + adding Adjustments − subtracting ones (BR-07). */
export function computedTotal(items: ItemDraft[], adjustments: AdjustmentDraft[]): number {
  return adjustments.reduce((sum, a) => {
    const value = a.amount ?? 0;
    return a.direction === "subtract" ? sum - value : sum + value;
  }, itemsTotal(items));
}

/** amount − computed total; 0 when there are no Items (nothing to balance). */
export function linesGap(amount: number | null, items: ItemDraft[], adjustments: AdjustmentDraft[]): number {
  if (items.length === 0) return 0;
  return (amount ?? 0) - computedTotal(items, adjustments);
}

export function linesComplete(items: ItemDraft[], adjustments: AdjustmentDraft[]): boolean {
  return items.every(isItemComplete) && adjustments.every(isAdjustmentComplete);
}

/** Request shape; only complete lines are sent (the editor blocks saving otherwise). */
export function toLineInputs(items: ItemDraft[], adjustments: AdjustmentDraft[]): {
  items: TransactionItemInput[];
  adjustments: TransactionAdjustmentInput[];
} {
  return {
    items: items.filter(isItemComplete).map((item) => ({
      name: item.name.trim(),
      quantity: item.quantity,
      ...(item.unitPrice !== null ? { unit_price: item.unitPrice } : {}),
      amount: item.amount ?? 0,
    })),
    adjustments: items.length === 0 ? [] : adjustments.filter(isAdjustmentComplete).map((a) => ({
      kind: a.kind,
      ...(a.kind === "other" && a.direction ? { direction: a.direction } : {}),
      ...(a.kind === "other" ? { label: a.label.trim() } : {}),
      amount: a.amount ?? 0,
    })),
  };
}

type ItemSource = TransactionItem | TransactionItemInput;
type AdjustmentSource = TransactionAdjustment | TransactionAdjustmentInput;

/** Drafts from a saved Transaction or a queued create payload. */
export function draftsFrom(items: ItemSource[] = [], adjustments: AdjustmentSource[] = []): {
  items: ItemDraft[];
  adjustments: AdjustmentDraft[];
} {
  return {
    items: items.map((item) => ({
      key: nextKey(),
      name: item.name,
      quantity: item.quantity ?? DEFAULT_QUANTITY,
      unitPrice: item.unit_price ?? null,
      amount: item.amount,
      amountTouched: true,
    })),
    adjustments: adjustments.map((a) => ({
      key: nextKey(),
      kind: a.kind,
      direction: FIXED_DIRECTIONS[a.kind] ?? a.direction ?? null,
      label: a.label ?? "",
      amount: a.amount,
    })),
  };
}

/** A typed major-unit string ("30000", "12.5") → cents in the currency's decimals; null if empty/invalid. */
export function parseMajorToCents(text: string, currency: string): number | null {
  if (text.trim() === "") return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  const factor = 10 ** currencyDecimals(currency);
  return toCents(Math.round(value * factor) / factor);
}
