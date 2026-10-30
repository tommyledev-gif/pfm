import { useTranslation } from "react-i18next";

import { LateSkeleton } from "@/components/motion/SkeletonSwap";
import { ReceiptIcon } from "@/components/ui/Icon";
import { EmptyInlineCard } from "@/components/shared/EmptyState";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { QueryStatusLike, isAwaitingFirstData, isWaitingForNetwork } from "@/lib/query-status";
import { useColors } from "@/lib/theme";
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";

const SKELETON_COUNT = 4;

interface HomeRecentEmptyProps {
  query: QueryStatusLike;
}

// Home's "Giao dịch gần đây" with no rows to show: skeleton rows while the
// first page loads (only if that takes long enough to be seen — LateSkeleton), the offline state when it cannot, else a small empty card.
// Moved out of the Home screen to keep that file under the 300-line cap.
export function HomeRecentEmpty({ query }: HomeRecentEmptyProps) {
  const { t } = useTranslation();
  const colors = useColors();
  if (isAwaitingFirstData(query)) {
    return (
      <LateSkeleton>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <TransactionRowSkeleton key={i} />
        ))}
      </LateSkeleton>
    );
  }
  if (isWaitingForNetwork(query)) return <OfflinePlaceholder />;
  return (
    <EmptyInlineCard
      icon={<ReceiptIcon size={18} color={colors.textSecondary} />}
      text={t("home.recent.empty")}
      testID="empty-home-recent"
    />
  );
}
