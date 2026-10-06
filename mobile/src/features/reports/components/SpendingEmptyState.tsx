import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";

import { EmptyIllustration } from "@/components/shared/EmptyIllustration";
import { EmptyStateCard } from "@/components/shared/EmptyState";
import { ChevronRightIcon, InsightIcon, PlusIcon, WalletIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useStartManualTransaction } from "@/features/transactions/use-start-manual-transaction";
import { useNeedsFirstWallet, useOpenWalletCreator } from "@/features/wallets/use-open-wallet-creator";

// A rising line through four points — "your chart goes here", drawn dashed
// because nothing is plotted yet.
const CHART_WIDTH = 96;
const CHART_HEIGHT = 56;
const CHART_POINTS: [number, number][] = [
  [6, 46],
  [36, 34],
  [62, 38],
  [90, 10],
];

interface SpendingEmptyStateProps {
  /** Switches Insights to its Budgets tab — the tip's destination. */
  onOpenBudgets?: () => void;
}

/** Insights → Spending, for a window with no expense in it. */
export function SpendingEmptyState({ onOpenBudgets }: SpendingEmptyStateProps) {
  const colors = useColors();
  const styles = useStyles();
  const startTransaction = useStartManualTransaction();
  const openWalletCreator = useOpenWalletCreator();
  const needsWallet = useNeedsFirstWallet();
  const [last] = CHART_POINTS.slice(-1);

  return (
    <View style={styles.stack} testID="empty-spending">
      <EmptyStateCard
        illustration={
          <EmptyIllustration tile={false} size={140}>
            <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
              <Polyline
                points={CHART_POINTS.map(([x, y]) => `${x},${y}`).join(" ")}
                fill="none"
                stroke={colors.green}
                strokeWidth={2}
                strokeDasharray="4 5"
                strokeLinecap="round"
              />
              {CHART_POINTS.slice(0, -1).map(([x, y]) => (
                <Circle key={x} cx={x} cy={y} r={3.5} fill={colors.surface} stroke={colors.green} strokeWidth={2} />
              ))}
              <Circle cx={last[0]} cy={last[1]} r={7} fill={withAlpha(colors.green, 0.25)} />
              <Circle cx={last[0]} cy={last[1]} r={4} fill={colors.green} />
            </Svg>
          </EmptyIllustration>
        }
        title="Chưa có phát sinh"
        description="Chưa có khoản chi nào trong khoảng thời gian này. Bắt đầu ghi chép để xem tiền của bạn đi đâu theo từng danh mục nhé!"
        action={
          needsWallet
            ? {
                label: "Thêm ví để bắt đầu",
                icon: <WalletIcon size={18} color={colors.onGreen} />,
                onPress: openWalletCreator,
              }
            : {
                label: "Thêm giao dịch để xem phân tích",
                icon: <PlusIcon size={18} color={colors.onGreen} />,
                onPress: startTransaction,
                testID: "btn-empty-spending-add",
              }
        }
      />

      {onOpenBudgets ? (
        <Pressable onPress={onOpenBudgets} style={({ pressed }) => [styles.tip, pressed && styles.tipPressed]}>
          <View style={styles.tipIcon}>
            <InsightIcon size={18} color={colors.green} />
          </View>
          <View style={styles.tipText}>
            <Text style={styles.tipEyebrow}>Mẹo quản lý</Text>
            <Text style={styles.tipBody}>Đặt ngân sách cho từng danh mục để biết mỗi ngày còn được chi bao nhiêu.</Text>
          </View>
          <ChevronRightIcon size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  stack: { gap: spacing.md },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  tipPressed: { opacity: 0.75 },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.green, 0.1),
  },
  tipText: { flex: 1, gap: 2 },
  tipEyebrow: { ...typography.caption, color: colors.textPrimary },
  tipBody: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
}));
