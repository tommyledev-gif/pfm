import { useState } from "react";

import { TransactionKind } from "@/lib/constants";

/** What the search field shows; a new `key` re-seeds it from outside (clear, a suggestion). */
export interface SearchFieldSeed {
  key: number;
  text: string;
}

/**
 * Everything that narrows the Transactions list — the type tab, wallet, date
 * range, categories and the search box — in one place, so "is anything narrowing
 * it?" and "clear all of it" can never miss one. Sort is not here: it reorders
 * the list, it never empties it.
 *
 * Only the applied search lives here. The text being typed stays inside the
 * search field (TransactionsSearchField), which debounces it, so a keystroke
 * never re-renders the screen.
 */
export function useTransactionFilters() {
  const [filter, setFilter] = useState<TransactionKind | undefined>(undefined);
  const [walletId, setWalletId] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [searchSeed, setSearchSeed] = useState<SearchFieldSeed>({ key: 0, text: "" });

  // Every filter except the type tab.
  const sharedFilters = {
    wallet_id: walletId,
    from: dateRange.from,
    to: dateRange.to,
    category_ids: categoryIds.length > 0 ? categoryIds.join(",") : undefined,
    search: search || undefined,
  };

  // Wallet, date, categories or search — not the type tab. A tab on its own
  // picks a kind of transaction to look at; an empty tab means "none of that
  // kind yet", not "nothing matches".
  const hasNarrowingFilter =
    walletId !== undefined || Boolean(dateRange.from || dateRange.to) || categoryIds.length > 0 || search !== "";
  // Changes exactly when the fetched list would: a new result set to stagger in.
  const filterKey = [filter, walletId, dateRange.from, dateRange.to, categoryIds.join(), search].join("|");

  const resetNarrowing = () => {
    setFilter(undefined);
    setWalletId(undefined);
    setDateRange({});
    setCategoryIds([]);
  };
  const seedSearch = (text: string) => setSearchSeed((seed) => ({ key: seed.key + 1, text }));
  const clearFilters = () => {
    resetNarrowing();
    setSearch("");
    seedSearch("");
  };
  // Search on its own, everything else cleared — a suggestion is picked to
  // find those rows, not to be intersected with whatever hid them. Applied
  // at once rather than after the debounce: it was tapped, not typed.
  const searchFor = (text: string) => {
    resetNarrowing();
    setSearch(text.trim());
    seedSearch(text);
  };

  return {
    filter,
    setFilter,
    walletId,
    setWalletId,
    dateRange,
    setDateRange,
    categoryIds,
    setCategoryIds,
    search,
    setSearch,
    searchSeed,
    sharedFilters,
    hasNarrowingFilter,
    filterKey,
    clearFilters,
    searchFor,
  };
}
