import { View } from "react-native";

import { ReceiptIcon } from "@/components/ui/Icon";
import { EmptyInlineCard } from "@/components/shared/EmptyState";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { isAwaitingFirstData, isWaitingForNetwork } from "@/lib/query-status";
import { useColors } from "@/lib/theme";
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";

const SKELETON_COUNT = 4;

interface HomeRecentEmptyProps {
  query: { isPending: boolean; fetchStatus: "fetching" | "paused" | "idle" };
}

// Home's "Giao dịch gần đây" with no rows to show: skeleton rows while the
// first page loads, the offline state when it cannot, else a small empty card.
// Moved out of the Home screen to keep that file under the 300-line cap.
export function HomeRecentEmpty({ query }: HomeRecentEmptyProps) {
  const colors = useColors();
  if (isAwaitingFirstData(query)) {
    return (
      <View>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <TransactionRowSkeleton key={i} />
        ))}
      </View>
    );
  }
  if (isWaitingForNetwork(query)) return <OfflinePlaceholder />;
  return (
    <EmptyInlineCard
      icon={<ReceiptIcon size={18} color={colors.textSecondary} />}
      text="Chưa có giao dịch."
      testID="empty-home-recent"
    />
  );
}
