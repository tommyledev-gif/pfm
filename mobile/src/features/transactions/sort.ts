import { Transaction } from "@/features/transactions/types";

// Client-side only — transactions are cursor-paginated (use-transactions-query.ts),
// and backend sorting would need new sqlc queries + cursor semantics per sort
// order. Sort is applied to the already-fetched, flattened page list instead;
// as more pages load they're re-sorted into place alongside what's already shown.
export type SortKey = "recent" | "oldest" | "highest" | "lowest";
export type SortGroup = "date" | "amount";

export const SORT_OPTIONS: { key: SortKey; label: string; group: SortGroup }[] = [
  { key: "recent", label: "Mới nhất trước", group: "date" },
  { key: "oldest", label: "Cũ nhất trước", group: "date" },
  { key: "highest", label: "Số tiền cao nhất", group: "amount" },
  { key: "lowest", label: "Số tiền thấp nhất", group: "amount" },
];

function compare(key: SortKey, a: Transaction, b: Transaction): number {
  switch (key) {
    case "recent":
      return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
    case "oldest":
      return new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime();
    case "highest":
      return b.amount - a.amount;
    case "lowest":
      return a.amount - b.amount;
  }
}

export function sortTransactions(items: Transaction[], activeSorts: SortKey[]): Transaction[] {
  if (activeSorts.length === 0) return items;
  return [...items].sort((a, b) => {
    for (const key of activeSorts) {
      const cmp = compare(key, a, b);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}
