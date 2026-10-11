import { useEffect, useState } from "react";

import { TransactionKind } from "@/lib/constants";

const SEARCH_DEBOUNCE_MS = 400;

/**
 * Everything that narrows the Transactions list — the type tab, date range,
 * categories and the search box — in one place, so "is anything narrowing
 * it?" and "clear all of it" can never miss one. Sort is not here: it reorders
 * the list, it never empties it.
 */
export function useTransactionFilters() {
  const [filter, setFilter] = useState<TransactionKind | undefined>(undefined);
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounced so every keystroke doesn't fire a new request — same 400ms
  // convention as other search-as-you-type inputs in this codebase.
  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Every filter except the type tab — shared by the list query and the
  // "Tất cả" tab's own count, which by definition must ignore that tab.
  const sharedFilters = {
    from: dateRange.from,
    to: dateRange.to,
    category_ids: categoryIds.length > 0 ? categoryIds.join(",") : undefined,
    search: search || undefined,
  };

  // Date, categories or search — not the type tab. A tab on its own picks a
  // kind of transaction to look at; an empty tab means "none of that kind
  // yet", not "nothing matches". `search`, not `searchInput`: what the list
  // on screen was actually fetched with.
  const hasNarrowingFilter = Boolean(dateRange.from || dateRange.to) || categoryIds.length > 0 || search !== "";

  const resetNarrowing = () => {
    setFilter(undefined);
    setDateRange({});
    setCategoryIds([]);
  };
  const clearFilters = () => {
    resetNarrowing();
    setSearchInput("");
    setSearch("");
  };
  // Search on its own, everything else cleared — a suggestion is picked to
  // find those rows, not to be intersected with whatever hid them. Applied
  // at once rather than after the debounce: it was tapped, not typed.
  const searchFor = (text: string) => {
    resetNarrowing();
    setSearchInput(text);
    setSearch(text.trim());
  };

  return {
    filter,
    setFilter,
    dateRange,
    setDateRange,
    categoryIds,
    setCategoryIds,
    searchInput,
    setSearchInput,
    sharedFilters,
    hasNarrowingFilter,
    clearFilters,
    searchFor,
  };
}
