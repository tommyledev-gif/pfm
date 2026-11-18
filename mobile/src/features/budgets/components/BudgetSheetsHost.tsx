import { Ref, memo, useCallback, useImperativeHandle, useState } from "react";

import { BudgetDetailDialog } from "@/features/budgets/components/BudgetDetailDialog";
import { BudgetFormModal } from "@/features/budgets/components/BudgetFormModal";
import { BudgetPreset } from "@/features/budgets/components/BudgetsEmptyState";
import { Budget } from "@/features/budgets/types";
import { Category } from "@/features/categories/types";
import { WalletCurrency } from "@/lib/constants";

type DetailRow = { budget: Budget; limit: Budget["limits"][number] };

/** What the Budgets tab calls to open its sheets. */
export interface BudgetSheetsHandle {
  /** The edit form of one budget. */
  edit: (budget: Budget) => void;
  /** The create form, optionally filled in from a suggestion. */
  create: (preset: BudgetPreset | null) => void;
  /** The transactions behind one budget's bar. */
  detail: (row: DetailRow) => void;
}

interface BudgetSheetsHostProps {
  handleRef: Ref<BudgetSheetsHandle>;
  currency: WalletCurrency;
  categoryById: Map<string, Category>;
  /** Must keep its identity while its dates hold: the host is memoized on it. */
  detailRange: { from: string; to: string };
}

/**
 * The Budgets tab's two sheets and the state that opens them, apart from the
 * tab: a tap on a row or its bar used to re-render the whole tab (summary,
 * every row, the entrance wrappers) before the sheet's slide could start, and
 * both sheets were built from scratch on each open. Now the tab holds a ref,
 * the sheets are built with it and wait below the edge (Drawer keepMounted),
 * and a tap re-renders only this.
 */
export const BudgetSheetsHost = memo(function BudgetSheetsHost({
  handleRef,
  currency,
  categoryById,
  detailRange,
}: BudgetSheetsHostProps) {
  const [form, setForm] = useState<{ open: boolean; budget: Budget | null; preset: BudgetPreset | null }>({
    open: false,
    budget: null,
    preset: null,
  });
  const [detail, setDetail] = useState<{ open: boolean; row: DetailRow | null }>({ open: false, row: null });

  useImperativeHandle(
    handleRef,
    () => ({
      edit: (budget) => setForm({ open: true, budget, preset: null }),
      create: (preset) => setForm({ open: true, budget: null, preset }),
      detail: (row) => setDetail({ open: true, row }),
    }),
    [],
  );
  // Both keep what they showed while they slide away; only `open` changes.
  const closeForm = useCallback(() => setForm((prev) => ({ ...prev, open: false })), []);
  const closeDetail = useCallback(() => setDetail((prev) => ({ ...prev, open: false })), []);

  return (
    <>
      <BudgetFormModal
        visible={form.open}
        onClose={closeForm}
        currency={currency}
        editingBudget={form.budget}
        preset={form.preset}
        keepMounted
      />
      <BudgetDetailDialog
        row={detail.row}
        open={detail.open}
        onClose={closeDetail}
        category={detail.row ? categoryById.get(detail.row.budget.category_id) : undefined}
        range={detailRange}
        currency={currency}
      />
    </>
  );
});
