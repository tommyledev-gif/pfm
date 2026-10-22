import { useCallback, useMemo, useState } from "react";

export type TransactionsSheet = "wallet" | "date" | "category" | "sort";

/**
 * Which of the Transactions screen's filter/sort sheets is open — one at a
 * time, so opening one can never leave another stacked behind it. Stable
 * openers, so the header's buttons can be handed them without re-rendering.
 */
export function useTransactionsSheets() {
  const [open, setOpen] = useState<TransactionsSheet | null>(null);
  const openers = useMemo(
    () => ({
      wallet: () => setOpen("wallet"),
      date: () => setOpen("date"),
      category: () => setOpen("category"),
      sort: () => setOpen("sort"),
    }),
    [],
  );
  const close = useCallback(() => setOpen(null), []);
  return { open, openers, close };
}
