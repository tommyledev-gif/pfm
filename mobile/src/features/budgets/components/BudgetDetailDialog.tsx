import { useMemo } from "react";

import { colorForCategory } from "@/lib/category-color";
import { useColors } from "@/lib/theme";
import { Budget } from "@/features/budgets/types";
import { Category } from "@/features/categories/types";
import { CategoryTransactionsDialog } from "@/features/reports/components/CategoryTransactionsDialog";

interface BudgetDetailDialogProps {
  /** The row whose bar was tapped: its budget and the limit the bar showed.
   *  Kept after the sheet is closed, so its content holds while it slides away. */
  row: { budget: Budget; limit: Budget["limits"][number] } | null;
  open: boolean;
  onClose: () => void;
  /** The budget's linked category, for the icon when the budget has none of its own. */
  category: Category | undefined;
  /** The window the rows were drawn for — see below. */
  range: { from: string; to: string };
  currency: string;
}

/**
 * A budget's transactions, from the Budgets tab (split out of BudgetsTab for
 * the 300-line cap). The header quotes the figure the bar showed.
 *
 * The window is the one the rows were drawn for, not the calendar month by
 * default: under a filter the bar shows a prorated slice, so the rows behind
 * it have to cover that same slice or the two disagree.
 */
export function BudgetDetailDialog({ row, open, onClose, category, range, currency }: BudgetDetailDialogProps) {
  const colors = useColors();
  // Same object while the currency holds: the dialog is memoized on it.
  const only = useMemo(() => ({ type: "expense" as const, currency }), [currency]);
  return (
    <CategoryTransactionsDialog
      visible={open}
      onClose={onClose}
      categoryId={row?.budget.category_id ?? null}
      categoryName={row?.budget.category_name ?? ""}
      color={row ? colorForCategory(row.budget.category_id) : colors.lavender}
      icon={row?.budget.icon ?? category?.icon}
      iconUrl={row?.budget.icon_url ?? category?.icon_url}
      from={range.from}
      to={range.to}
      currency={currency}
      total={row?.limit.spent ?? 0}
      budget={row ? { spent: row.limit.spent, limit: row.limit.amount_limit } : undefined}
      // What the bar counted: expenses, in the limit's currency.
      only={only}
      keepMounted
    />
  );
}
