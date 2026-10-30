import { TranslationKey } from "@/lib/i18n";
import { Transaction } from "@/features/transactions/types";

// Client-side only — transactions are cursor-paginated (use-transactions-query.ts),
// and backend sorting would need new sqlc queries + cursor semantics per sort
// order. Sort is applied to the already-fetched, flattened page list instead;
// as more pages load they're re-sorted into place alongside what's already shown.
export type SortKey = "recent" | "oldest" | "highest" | "lowest";
export type SortGroup = "date" | "amount";

// What the list is already ordered by when the user has chosen nothing —
// ListTransactionsByUser's own ORDER BY (occurred_at DESC) expressed as a
// SortKey. The sort drawer opens with this pre-selected so it shows the order
// actually in effect instead of an empty checklist, and the Transactions
// screen treats "only this key" as "no custom sort" for its filter pill.
export const DEFAULT_SORT_KEY: SortKey = "recent";

export function isDefaultSort(keys: SortKey[]): boolean {
  return keys.length === 0 || (keys.length === 1 && keys[0] === DEFAULT_SORT_KEY);
}

export const SORT_OPTIONS: { key: SortKey; labelKey: TranslationKey; group: SortGroup }[] = [
  { key: "recent", labelKey: "transactions.sort.recent", group: "date" },
  { key: "oldest", labelKey: "transactions.sort.oldest", group: "date" },
  { key: "highest", labelKey: "transactions.sort.highest", group: "amount" },
  { key: "lowest", labelKey: "transactions.sort.lowest", group: "amount" },
];

function compare(key: SortKey, a: Transaction, b: Transaction, time: Map<string, number>): number {
  switch (key) {
    case "recent":
      return time.get(b.id)! - time.get(a.id)!;
    case "oldest":
      return time.get(a.id)! - time.get(b.id)!;
    case "highest":
      return b.amount - a.amount;
    case "lowest":
      return a.amount - b.amount;
  }
}

export function sortTransactions(items: Transaction[], activeSorts: SortKey[]): Transaction[] {
  if (activeSorts.length === 0) return items;
  // Parsed once per row, not twice per comparison.
  const time = new Map(items.map((t) => [t.id, Date.parse(t.occurred_at)]));
  return [...items].sort((a, b) => {
    for (const key of activeSorts) {
      const cmp = compare(key, a, b, time);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}
