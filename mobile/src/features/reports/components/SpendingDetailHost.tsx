import { Ref, memo, useCallback, useImperativeHandle, useState } from "react";

import { DonutSegment } from "@/components/shared/DonutChart";
import { CategoryTransactionsDialog } from "@/features/reports/components/CategoryTransactionsDialog";

/** What the Spending tab calls to open the drill-down of one category. */
export interface SpendingDetailHandle {
  open: (categoryId: string) => void;
}

interface SpendingDetailHostProps {
  handleRef: Ref<SpendingDetailHandle>;
  segments: DonutSegment[];
  /** The backend's resolved window, so the rows match the donut even when no
   *  filter is applied. */
  from: string;
  to: string;
  currency: string;
  fallbackColor: string;
}

/**
 * The category drill-down sheet and the state that opens it, apart from the
 * Spending tab: tapping "Xem giao dịch" on the donut used to re-render the
 * whole tab (donut, every legend row) before the sheet could start sliding,
 * and the sheet was built from scratch on each open. Now it is built with the
 * tab and waits below the edge (Drawer keepMounted); the tab holds a ref.
 */
export const SpendingDetailHost = memo(function SpendingDetailHost({
  handleRef,
  segments,
  from,
  to,
  currency,
  fallbackColor,
}: SpendingDetailHostProps) {
  // Kept after closing, so the sheet's content holds while it slides away.
  const [state, setState] = useState<{ open: boolean; categoryId: string | null }>({ open: false, categoryId: null });

  useImperativeHandle(handleRef, () => ({ open: (categoryId) => setState({ open: true, categoryId }) }), []);
  const close = useCallback(() => setState((prev) => ({ ...prev, open: false })), []);

  const segment = state.categoryId ? segments.find((s) => s.key === state.categoryId) : undefined;
  return (
    <CategoryTransactionsDialog
      visible={state.open}
      onClose={close}
      categoryId={state.categoryId}
      categoryName={segment?.label ?? ""}
      color={segment?.color ?? fallbackColor}
      icon={segment?.icon}
      iconUrl={segment?.iconUrl}
      from={from}
      to={to}
      currency={currency}
      total={segment?.amount ?? 0}
      keepMounted
    />
  );
});
