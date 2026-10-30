import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { i18n } from "@/lib/i18n";

import { AmountExpression } from "@/lib/use-amount-expression";
import { AdjustmentKind, TransactionAdjustment, TransactionAdjustmentInput, TransactionItem, TransactionItemInput } from "@/features/transactions/types";
import {
  AdjustmentDraft,
  ItemDraft,
  computedTotal,
  draftsFrom,
  itemsTotal,
  linesComplete,
  linesGap,
  newAdjustmentDraft,
  newItemDraft,
  toLineInputs,
} from "@/features/transactions/items/line-math";

type SourceItems = (TransactionItem | TransactionItemInput)[] | undefined;
type SourceAdjustments = (TransactionAdjustment | TransactionAdjustmentInput)[] | undefined;

/**
 * Draft Items and Adjustments of the Transaction form (specs/transaction-line-
 * items US-01/US-03). Client form state — seeded from query data on open,
 * never a copy of the server list kept beyond the sheet.
 *
 * Amount follow (AC-06): while the User has not typed an amount, the keypad
 * amount is re-seeded to the computed total whenever the lines change.
 */
export function useItemsEditor(amount: AmountExpression) {
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentDraft[]>([]);
  // True once the lines differ from what was seeded — only then does an
  // update send them (an untouched list is left alone server-side).
  const [dirty, setDirty] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const lastSeededCents = useRef<number | null>(null);
  const { reset: resetAmount, cents } = amount;

  const total = useMemo(() => computedTotal(items, adjustments), [items, adjustments]);
  const gap = linesGap(cents, items, adjustments);
  const complete = linesComplete(items, adjustments);
  const problem = !complete
    ? i18n.t("transactions.items.problem.incomplete")
    : gap !== 0
      ? i18n.t("transactions.items.problem.mismatch")
      : undefined;

  useEffect(() => {
    if (cents !== lastSeededCents.current) setAmountTouched(true);
  }, [cents]);

  useEffect(() => {
    if (amountTouched || items.length === 0 || total <= 0 || cents === total) return;
    lastSeededCents.current = total;
    resetAmount(total);
  }, [amountTouched, items.length, total, cents, resetAmount]);

  /** On every sheet open: the amount the keypad was seeded with, and the lines. */
  const reset = useCallback((seededCents: number | null, sourceItems?: SourceItems, sourceAdjustments?: SourceAdjustments) => {
    const drafts = draftsFrom(sourceItems, sourceAdjustments);
    lastSeededCents.current = seededCents;
    setAmountTouched(seededCents !== null);
    setItems(drafts.items);
    setAdjustments(drafts.adjustments);
    setDirty(false);
  }, []);

  /** Lines that arrived after open (the detail fetch) — ignored once the User edited lines. */
  const seedLines = useCallback((sourceItems?: SourceItems, sourceAdjustments?: SourceAdjustments) => {
    if (dirty) return;
    const drafts = draftsFrom(sourceItems, sourceAdjustments);
    setItems(drafts.items);
    setAdjustments(drafts.adjustments);
  }, [dirty]);

  const touch = () => setDirty(true);

  const updateItem = (key: string, patch: Partial<ItemDraft>) => {
    touch();
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const removeItem = (key: string) => {
    touch();
    setItems((list) => {
      const next = list.filter((item) => item.key !== key);
      // No Adjustment without an Item (BR-08, AC-11).
      if (next.length === 0) setAdjustments([]);
      return next;
    });
  };

  /**
   * Undo of removeItem: back at its old position. `adjustments` are the ones
   * removing the last Item took with it (BR-08), restored alongside.
   */
  const restoreItem = (item: ItemDraft, index: number, adjustmentsBefore?: AdjustmentDraft[]) => {
    touch();
    setItems((list) => [...list.slice(0, index), item, ...list.slice(index)]);
    if (adjustmentsBefore) setAdjustments(adjustmentsBefore);
  };

  const restoreAdjustment = (adjustment: AdjustmentDraft, index: number) => {
    touch();
    setAdjustments((list) => [...list.slice(0, index), adjustment, ...list.slice(index)]);
  };

  const updateAdjustment = (key: string, patch: Partial<AdjustmentDraft>) => {
    touch();
    setAdjustments((list) => list.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  };

  /** Main Flow step 8: the gap becomes an "other" line; the User still writes its label. */
  const addDifference = () => {
    if (gap === 0) return;
    touch();
    setAdjustments((list) => [...list, newAdjustmentDraft("other", Math.abs(gap), gap > 0 ? "add" : "subtract")]);
  };

  /** Main Flow step 8, second fix: the amount becomes the computed total. */
  const applyTotalAsAmount = () => {
    if (total <= 0) return;
    lastSeededCents.current = total;
    resetAmount(total);
  };

  const clear = () => {
    touch();
    setItems([]);
    setAdjustments([]);
  };

  return {
    items,
    adjustments,
    dirty,
    hasLines: items.length > 0 || adjustments.length > 0,
    itemsTotal: itemsTotal(items),
    total,
    gap,
    complete,
    // Why the form cannot be saved because of its lines, if it cannot (BR-07).
    problem,
    reset,
    seedLines,
    /** Returns the new line's key, so the editor can open it straight away. */
    addItem: (): string => {
      touch();
      const draft = newItemDraft();
      setItems((list) => [...list, draft]);
      return draft.key;
    },
    updateItem,
    removeItem,
    restoreItem,
    addAdjustment: (kind: AdjustmentKind = "tax"): string => {
      touch();
      const draft = newAdjustmentDraft(kind);
      setAdjustments((list) => [...list, draft]);
      return draft.key;
    },
    updateAdjustment,
    restoreAdjustment,
    removeAdjustment: (key: string) => {
      touch();
      setAdjustments((list) => list.filter((a) => a.key !== key));
    },
    addDifference,
    applyTotalAsAmount,
    clear,
    toInputs: () => toLineInputs(items, adjustments),
  };
}

export type ItemsEditor = ReturnType<typeof useItemsEditor>;
