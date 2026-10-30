import { useTranslation } from "react-i18next";

import { EmptyStateCard } from "@/components/shared/EmptyState";
import { ThemedIllustration } from "@/components/shared/ThemedIllustration";
import { PlusIcon, WalletIcon } from "@/components/ui/Icon";
import { TransactionKind } from "@/lib/constants";
import { TranslationKey } from "@/lib/i18n";
import { spacing, useColors } from "@/lib/theme";
import { useNeedsFirstWallet, useOpenWalletCreator } from "@/features/wallets/use-open-wallet-creator";

const TITLE: Record<TransactionKind, TranslationKey> = {
  expense: "transactions.empty.type.expense",
  income: "transactions.empty.type.income",
  transfer: "transactions.empty.type.transfer",
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
  const { t } = useTranslation();
  const colors = useColors();
  const openWalletCreator = useOpenWalletCreator();
  // Same first step as the all-types empty state: with no wallet, the form
  // would only have an empty wallet picker to offer.
  const needsWallet = useNeedsFirstWallet();

  return (
    <EmptyStateCard
      illustration={<ThemedIllustration name="transactions" />}
      title={t(TITLE[type])}
      description={needsWallet ? t("common.empty.noWallet") : undefined}
      action={
        needsWallet
          ? {
              label: t("common.action.createWallet"),
              icon: <WalletIcon size={18} color={colors.onGreen} />,
              onPress: openWalletCreator,
              testID: "btn-empty-type-create-wallet",
            }
          : {
              label: t("common.action.addTransaction"),
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
