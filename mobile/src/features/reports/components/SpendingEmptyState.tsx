import { Pressable, Text, View } from "react-native";

import { EmptyStateCard } from "@/components/shared/EmptyState";
import { ThemedIllustration } from "@/components/shared/ThemedIllustration";
import { ChevronRightIcon, InsightIcon, PlusIcon, WalletIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useStartManualTransaction } from "@/features/transactions/use-start-manual-transaction";
import { useNeedsFirstWallet, useOpenWalletCreator } from "@/features/wallets/use-open-wallet-creator";

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

  return (
    <View style={styles.stack} testID="empty-spending">
      <EmptyStateCard
        illustration={<ThemedIllustration name="spending" />}
        title="Chưa có khoản chi"
        description="Ghi giao dịch để xem tiền đi đâu theo danh mục."
        action={
          needsWallet
            ? {
                label: "Tạo ví",
                icon: <WalletIcon size={18} color={colors.onGreen} />,
                onPress: openWalletCreator,
              }
            : {
                label: "Thêm giao dịch",
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
            <Text style={styles.tipEyebrow}>Mẹo</Text>
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
