import { Text, View } from "react-native";

import { ListRow, ListSection } from "@/components/ui/grouped-list";
import { ArrowRightGlyph } from "@/components/ui/grouped-list/list-icons";
import { formatCurrency } from "@/lib/currency";
import { typography, createStyles } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { WalletSelectTile } from "@/features/transactions/components/WalletSelectTile";

const NO_SAVED_WALLETS_MESSAGE = "Kết nối mạng để tải danh sách ví.";

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
  const styles = useStyles();
  const hints = [
    noSavedWallets ? NO_SAVED_WALLETS_MESSAGE : null,
    otherCurrenciesHidden ? "Chỉ hiện ví cùng loại tiền" : null,
    wallet
      ? `Số dư khả dụng: ${formatCurrency(wallet.balance, wallet.currency)}${
          showProjection && projectedBalance !== null
            ? ` → ${formatCurrency(projectedBalance, wallet.currency)} sau giao dịch này`
            : ""
        }`
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
        label={isTransfer ? "Từ ví" : "Ví"}
        wallet={wallet}
        placeholder="Chọn"
        onPress={onOpenWallets}
        locked={walletLocked}
        error={walletError}
        testID="field-transaction-wallet"
      />
      {!isTransfer ? null : destinationCount > 0 || destination ? (
        <WalletSelectTile
          label="Đến ví"
          wallet={destination}
          placeholder="Chọn"
          onPress={onOpenDestinations}
          locked={destinationLocked}
          destination
          error={destinationError}
          testID="field-transaction-to-wallet"
        />
      ) : (
        <ListRow
          title="Đến ví"
          subtitle="Cần thêm một ví khác cùng đơn vị tiền tệ để chuyển khoản."
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
