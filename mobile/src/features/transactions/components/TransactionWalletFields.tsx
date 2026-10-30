import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ListRow, ListSection } from "@/components/ui/grouped-list";
import { ArrowRightGlyph } from "@/components/ui/grouped-list/list-icons";
import { formatCurrency } from "@/lib/currency";
import { typography, createStyles } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { WalletSelectTile } from "@/features/transactions/components/WalletSelectTile";

interface TransactionWalletFieldsProps {
  isTransfer: boolean;
  wallet: Wallet | null;
  onOpenWallets: () => void;
  /** A saved transfer's wallets: shown, not changeable. */
  walletLocked: boolean;
  destination: Wallet | null;
  /** Wallets a transfer could go to: none means there is nowhere to send it. */
  destinationCount: number;
  onOpenDestinations: () => void;
  destinationLocked: boolean;
  noSavedWallets: boolean;
  /** Same-currency wallets only, for a saved transaction moving wallet. */
  otherCurrenciesHidden: boolean;
  /** The balance after this transaction, when it moves money in this wallet. */
  projectedBalance: number | null;
  showProjection: boolean;
  walletError?: string;
  destinationError?: string;
}

/**
 * The wallet part of TransactionFormModal, as one inset group: "Ví", or
 * "Từ ví" over "Đến ví" for a transfer, with the balance line as the group's
 * footer. Split out for the 300-line limit.
 */
export function TransactionWalletFields({
  isTransfer,
  wallet,
  onOpenWallets,
  walletLocked,
  destination,
  destinationCount,
  onOpenDestinations,
  destinationLocked,
  noSavedWallets,
  otherCurrenciesHidden,
  projectedBalance,
  showProjection,
  walletError,
  destinationError,
}: TransactionWalletFieldsProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const balance = wallet ? formatCurrency(wallet.balance, wallet.currency) : "";
  const hints = [
    noSavedWallets ? t("transactions.form.walletsOffline") : null,
    otherCurrenciesHidden ? t("transactions.form.sameCurrencyOnly") : null,
    wallet
      ? showProjection && projectedBalance !== null
        ? t("transactions.form.availableBalanceAfter", { balance, after: formatCurrency(projectedBalance, wallet.currency) })
        : t("transactions.form.availableBalance", { balance })
      : null,
  ].filter((hint): hint is string => hint !== null);

  return (
    <ListSection
      onSheet
      footer={
        hints.length > 0 ? (
          <View style={styles.hints}>
            {hints.map((hint) => (
              <Text key={hint} style={styles.hint}>
                {hint}
              </Text>
            ))}
          </View>
        ) : undefined
      }
    >
      <WalletSelectTile
        label={isTransfer ? t("common.field.fromWallet") : t("common.field.wallet")}
        wallet={wallet}
        placeholder={t("common.action.choose")}
        onPress={onOpenWallets}
        locked={walletLocked}
        error={walletError}
        testID="field-transaction-wallet"
      />
      {!isTransfer ? null : destinationCount > 0 || destination ? (
        <WalletSelectTile
          label={t("common.field.toWallet")}
          wallet={destination}
          placeholder={t("common.action.choose")}
          onPress={onOpenDestinations}
          locked={destinationLocked}
          destination
          error={destinationError}
          testID="field-transaction-to-wallet"
        />
      ) : (
        <ListRow
          title={t("common.field.toWallet")}
          subtitle={t("transactions.form.noTransferTarget")}
          icon={ArrowRightGlyph}
          disabled
        />
      )}
    </ListSection>
  );
}

const useStyles = createStyles((colors) => ({
  hints: { gap: 2 },
  hint: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
}));
