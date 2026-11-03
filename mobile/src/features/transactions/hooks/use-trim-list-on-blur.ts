import { RefObject, useEffect } from "react";
import { SectionList } from "react-native";
import { InfiniteData, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";

import { useLatestCallback } from "@/lib/use-latest-callback";
import { DaySection } from "@/features/transactions/day-sections";
import { ListTransactionsFilters, ListTransactionsResult, Transaction } from "@/features/transactions/types";

// More pages loaded than this and the list goes back to its first page once
// its tab has been out of view for TRIM_DELAY_MS. A shorter list keeps its
// place: it is cheap to refetch and to bring back.
const KEPT_PAGES = 3;
// Well past the tab cross-fade ((tabs)/_layout.tsx SWITCH_MS), so the reset
// is never seen, and long enough that a quick look at another tab and
// straight back keeps the place.
const TRIM_DELAY_MS = 1500;

type Pages = InfiniteData<ListTransactionsResult, string | undefined>;

/**
 * Drops a deep Transactions list back to its first page while its tab is out
 * of view.
 *
 * TanStack refetches every loaded page of an infinite query, one after
 * another, whenever it is invalidated (a transaction added anywhere in the
 * app) or the app regains focus. With 42 pages loaded, adding one
 * transaction cost 42 sequential requests (~400 KB), and coming back to the
 * tab with ~860 rows took frames of up to 450 ms against 61 ms with one page
 * (perf audit 2026-11-03). Trimmed, both cost one page.
 *
 * ⚠️ Order matters: a refetch in flight would land after the trim and put
 * every page back, so it is cancelled first; the trimmed page is then
 * refetched, because cancelling dropped whatever that refetch was bringing.
 */
export function useTrimListOnBlur(
  filters: ListTransactionsFilters,
  listRef: RefObject<SectionList<Transaction, DaySection> | null>,
) {
  const queryClient = useQueryClient();
  const navigation = useNavigation();

  const trim = useLatestCallback(() => {
    const queryKey = ["transactions", filters];
    const deep = (queryClient.getQueryData<Pages>(queryKey)?.pages.length ?? 0) > KEPT_PAGES;
    if (!deep) return;
    void queryClient.cancelQueries({ queryKey, exact: true }).then(() => {
      const data = queryClient.getQueryData<Pages>(queryKey);
      if (!data || data.pages.length <= KEPT_PAGES) return;
      listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
      queryClient.setQueryData<Pages>(queryKey, { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) });
      void queryClient.invalidateQueries({ queryKey, exact: true });
    });
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cancel = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const offBlur = navigation.addListener("blur", () => {
      cancel();
      timer = setTimeout(trim, TRIM_DELAY_MS);
    });
    const offFocus = navigation.addListener("focus", cancel);
    return () => {
      cancel();
      offBlur();
      offFocus();
    };
  }, [navigation, trim]);
}
