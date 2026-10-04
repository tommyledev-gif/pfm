import { ActivityIndicator, Text, View } from "react-native";

import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { useIsOnline } from "@/lib/connectivity";
import { isWaitingForNetwork } from "@/lib/query-status";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";

interface ListQueryState {
  isLoading: boolean;
  isPending: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

interface TransactionsListStateProps {
  query: ListQueryState;
}

const LIST_SKELETON_COUNT = 6;
const EMPTY_MESSAGE = "Không tìm thấy giao dịch nào.";

// The Transactions list's empty slot: skeleton while loading, the offline
// state when nothing is saved for these filters (EC-OFF-06), else "none".
export function TransactionsListEmpty({ query }: TransactionsListStateProps) {
  const styles = useStyles();
  if (isWaitingForNetwork(query)) return <OfflinePlaceholder />;
  if (query.isLoading) {
    return (
      <View>
        {Array.from({ length: LIST_SKELETON_COUNT }).map((_, i) => (
          <TransactionRowSkeleton key={i} />
        ))}
      </View>
    );
  }
  return <Text style={styles.empty}>{EMPTY_MESSAGE}</Text>;
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
