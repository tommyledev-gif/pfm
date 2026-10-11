import { EmptyStateCard } from "@/components/shared/EmptyState";
import { ThemedIllustration } from "@/components/shared/ThemedIllustration";
import { PlusIcon, WalletIcon } from "@/components/ui/Icon";
import { TransactionKind } from "@/lib/constants";
import { spacing, useColors } from "@/lib/theme";
import { useNeedsFirstWallet, useOpenWalletCreator } from "@/features/wallets/use-open-wallet-creator";

const TITLE: Record<TransactionKind, string> = {
  expense: "Chưa có khoản chi nào",
  income: "Chưa có khoản thu nào",
  transfer: "Chưa có lần chuyển tiền nào",
};

interface NoTransactionsOfTypeStateProps {
  type: TransactionKind;
  onAdd: () => void;
}

/**
 * A type tab (Chi tiêu, Thu nhập, Chuyển) with nothing in it, and nothing else
 * narrowing the list. That is "none of this kind yet", so it gets an empty
 * state with a way to add one, not the "no results, clear filters" card.
 */
export function NoTransactionsOfTypeState({ type, onAdd }: NoTransactionsOfTypeStateProps) {
  const colors = useColors();
  const openWalletCreator = useOpenWalletCreator();
  // Same first step as the all-types empty state: with no wallet, the form
  // would only have an empty wallet picker to offer.
  const needsWallet = useNeedsFirstWallet();

  return (
    <EmptyStateCard
      illustration={<ThemedIllustration name="transactions" />}
      title={TITLE[type]}
      description={needsWallet ? "Chưa có ví. Tạo ví để ghi giao dịch." : undefined}
      action={
        needsWallet
          ? {
              label: "Tạo ví",
              icon: <WalletIcon size={18} color={colors.onGreen} />,
              onPress: openWalletCreator,
              testID: "btn-empty-type-create-wallet",
            }
          : {
              label: "Thêm giao dịch",
              icon: <PlusIcon size={18} color={colors.onGreen} />,
              onPress: onAdd,
              testID: "btn-empty-type-add-transaction",
            }
      }
      style={{ marginTop: spacing.sm }}
      testID={`empty-transactions-${type}`}
    />
  );
}
