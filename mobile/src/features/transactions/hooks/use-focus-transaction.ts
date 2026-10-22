import { useEffect, useRef, useState } from "react";
import { SectionList } from "react-native";

import { useHighlightFade } from "@/lib/use-highlight-fade";
import { DaySection } from "@/features/transactions/day-sections";
import { Transaction } from "@/features/transactions/types";

// Pages fetched while looking for the row before giving up. The list loads
// newest first, so a transaction this far back is beyond a quick jump.
const MAX_PAGES = 15;
// Rows are not measured until rendered, so a scroll to one far down the list
// can fail a few times before its layout lands.
const SCROLL_RETRY_MS = 150;
const MAX_SCROLL_RETRIES = 5;
// Where the found row settles: a little above the middle.
const VIEW_POSITION = 0.4;

interface TransactionsPager {
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
}

interface UseFocusTransactionOptions {
  /** The transaction to bring into view, from the route params. */
  focusId?: string;
  /** Changes on every navigation, so jumping to the same row again replays. */
  nonce?: string;
  /** The row's day (YYYY-MM-DD), so a folded day can be opened for it. */
  focusDay?: string;
  sections: DaySection[];
  /** Rows dated after today, shown in their own card rather than the list. */
  future: Transaction[];
  transactions: TransactionsPager;
  /** Clears whatever filter or sort could be hiding the row. */
  resetView: () => void;
  /** Days folded or folding (useCollapsedDays) — a row there is not in view. */
  closedDays: ReadonlySet<string>;
  /** `animate: false` opens a day at full height at once, ready to scroll in. */
  toggleDay: (dayKey: string, animate?: boolean) => void;
  /** The row is a future one: open the card that lists those instead. */
  onFoundInFuture: () => void;
}

/**
 * Jumps the Transactions list to one row and flashes a border on it — the
 * "Xem trong Giao dịch" action held on a row elsewhere (Insights' category
 * drill-down). The list is paginated and filtered, so getting there means:
 * clear the filters, load pages until the row turns up, unfold its day,
 * scroll, then highlight. Same border as the Wallets screen's focused row.
 */
export function useFocusTransaction({
  focusId,
  nonce,
  focusDay,
  sections,
  future,
  transactions,
  resetView,
  closedDays,
  toggleDay,
  onFoundInFuture,
}: UseFocusTransactionOptions) {
  const listRef = useRef<SectionList<Transaction, DaySection>>(null);
  // The jump still in progress; null once found or given up on.
  const seeking = useRef<{ id: string; pages: number } | null>(null);
  const scrollTarget = useRef<{ sectionIndex: number; itemIndex: number } | null>(null);
  const scrollRetries = useRef(0);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  // Bumped when a jump starts, so the search below runs even when clearing
  // the filters changed nothing (they were already clear).
  const [seekToken, setSeekToken] = useState(0);
  const highlightOpacity = useHighlightFade(highlightKey);

  useEffect(() => {
    if (!focusId) return;
    seeking.current = { id: focusId, pages: 0 };
    setHighlightKey(null);
    setSeekToken((n) => n + 1);
    resetView();
    // Only a new navigation starts a jump; the callbacks change every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, nonce]);

  const scrollToTarget = () => {
    const target = scrollTarget.current;
    if (!target) return;
    // VirtualizedSectionList counts a section's header as its flat index 0,
    // so the section's item k sits at itemIndex k + 1.
    listRef.current?.scrollToLocation({
      sectionIndex: target.sectionIndex,
      itemIndex: target.itemIndex + 1,
      viewPosition: VIEW_POSITION,
      animated: true,
    });
  };

  // Read only during a jump: reading isFetching re-renders the screen on
  // every background refetch.
  const reloading = seeking.current !== null && transactions.isFetching && !transactions.isFetchingNextPage;

  useEffect(() => {
    const target = seeking.current;
    if (!target) return;
    // The list is reloading after the filters were cleared — wait for it.
    if (reloading) return;

    if (future.some((t) => t.id === target.id)) {
      seeking.current = null;
      onFoundInFuture();
      return;
    }

    // A folded day hands the list no rows (and a folding one is about to):
    // open the row's own day, and only it.
    if (focusDay && closedDays.has(focusDay)) {
      toggleDay(focusDay, false);
      return;
    }

    const sectionIndex = sections.findIndex((s) => s.data.some((t) => t.id === target.id));
    if (sectionIndex === -1) {
      if (transactions.hasNextPage && target.pages < MAX_PAGES) {
        if (!transactions.isFetchingNextPage) {
          target.pages += 1;
          transactions.fetchNextPage();
        }
        return;
      }
      seeking.current = null;
      return;
    }

    seeking.current = null;
    scrollTarget.current = {
      sectionIndex,
      itemIndex: sections[sectionIndex].data.findIndex((t) => t.id === target.id),
    };
    scrollRetries.current = 0;
    setHighlightKey(`${target.id}:${nonce ?? ""}`);
    requestAnimationFrame(scrollToTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekToken, sections, future, reloading, transactions.isFetchingNextPage, transactions.hasNextPage]);

  // For the list's onScrollToIndexFailed: rows past the rendered window have
  // no layout yet, so jump near them by the average row height, then retry.
  const onScrollToIndexFailed = (info: { index: number; averageItemLength: number }) => {
    if (scrollRetries.current >= MAX_SCROLL_RETRIES) return;
    scrollRetries.current += 1;
    listRef.current?.getScrollResponder()?.scrollTo({ y: info.averageItemLength * info.index, animated: false });
    setTimeout(scrollToTarget, SCROLL_RETRY_MS);
  };

  const highlightId = highlightKey ? highlightKey.split(":")[0] : null;
  return { listRef, highlightId, highlightOpacity, onScrollToIndexFailed };
}
