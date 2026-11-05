import { ActivityIndicator, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { LateSkeleton } from "@/components/motion/SkeletonSwap";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { useIsOnline } from "@/lib/connectivity";
import { isAwaitingFirstData, isWaitingForNetwork } from "@/lib/query-status";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";
import { NoResultsState, NoTransactionsState } from "@/features/transactions/components/TransactionsEmptyStates";
import { NoTransactionsOfTypeState } from "@/features/transactions/components/NoTransactionsOfTypeState";
import { TransactionKind } from "@/lib/constants";

interface ListQueryState {
  isPending: boolean;
  isPaused: boolean;
  /** Showing the previous filter's rows while this one loads. */
  isPlaceholderData: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

interface TransactionsListStateProps {
  query: ListQueryState;
}

const LIST_SKELETON_COUNT = 6;

interface TransactionsListEmptyProps extends TransactionsListStateProps {
  /** Date, categories or search narrow the list: "nothing matches", not "nothing yet". */
  filtered: boolean;
  /** The type tab on screen; undefined on "Tất cả". */
  typeFilter: TransactionKind | undefined;
  /** Rows exist, but every one is dated ahead of today (the upcoming card). */
  onlyFuture: boolean;
  onAdd: () => void;
  onClearFilters: () => void;
  onSearch: (text: string) => void;
}

// The Transactions list's empty slot: skeleton while loading, the offline
// state when nothing is saved for these filters (EC-OFF-06), then either
// "nothing matches these filters" or "nothing recorded yet".
export function TransactionsListEmpty({
  query,
  filtered,
  typeFilter,
  onlyFuture,
  onAdd,
  onClearFilters,
  onSearch,
}: TransactionsListEmptyProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  if (isWaitingForNetwork(query)) return <OfflinePlaceholder />;
  // Still loading: "nothing matches" would be a guess. A new filter's rows
  // (the screen empties the list meanwhile) get theirs at once, the User just
  // asked for them; the first load waits SKELETON_DELAY_MS, so the saved
  // first page read back at launch never blinks one.
  if (isAwaitingFirstData(query) || query.isPlaceholderData) {
    return (
      <LateSkeleton delayMs={query.isPlaceholderData ? 0 : undefined}>
        {Array.from({ length: LIST_SKELETON_COUNT }).map((_, i) => (
          <TransactionRowSkeleton key={i} />
        ))}
      </LateSkeleton>
    );
  }
  if (filtered) return <NoResultsState onClearFilters={onClearFilters} onSearch={onSearch} />;
  // The upcoming card above the list already shows those rows; "no
  // transactions yet" right under it would contradict it.
  if (onlyFuture) return <Text style={styles.empty}>{t("transactions.empty.onlyFuture")}</Text>;
  if (typeFilter) return <NoTransactionsOfTypeState type={typeFilter} onAdd={onAdd} />;
  return <NoTransactionsState onAdd={onAdd} />;
}

// Older pages are never saved (S-OFF-16): offline, the end of the saved
// first page says so instead of a spinner that cannot finish.
export function TransactionsListFooter({ query }: TransactionsListStateProps) {
  const colors = useColors();
  const styles = useStyles();
  const isOnline = useIsOnline();
  if (!isOnline && query.hasNextPage) return <OfflinePlaceholder />;
  if (query.isFetchingNextPage) return <ActivityIndicator color={colors.green} style={styles.loader} />;
  return null;
}

const useStyles = createStyles((colors) => ({
  loader: { marginVertical: spacing.lg },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
}));
