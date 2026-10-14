import { Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles } from "@/lib/theme";
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
 * The wallet part of TransactionFormModal: "Ví", or "Từ ví" | "Đến ví" side by
 * side for a transfer, then the balance line. Split out for the 300-line limit.
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

  const source = (
    <WalletSelectTile
      label={isTransfer ? "Từ ví" : "Ví"}
      wallet={wallet}
      placeholder="Chọn ví"
      onPress={onOpenWallets}
      locked={walletLocked}
      compact={isTransfer}
      error={walletError}
      testID="field-transaction-wallet"
    />
  );

  return (
    <View style={styles.group}>
      {isTransfer ? (
        <View style={styles.row}>
          {source}
          {destinationCount > 0 || destination ? (
            <WalletSelectTile
              label="Đến ví"
              wallet={destination}
              placeholder="Chọn ví nhận"
              onPress={onOpenDestinations}
              locked={destinationLocked}
              compact
              error={destinationError}
              testID="field-transaction-to-wallet"
            />
          ) : (
            <View style={styles.half}>
              <Text style={styles.label}>Đến ví</Text>
              <Text style={styles.hint}>Cần thêm một ví khác cùng đơn vị tiền tệ để chuyển khoản.</Text>
            </View>
          )}
        </View>
      ) : (
        source
      )}
      {noSavedWallets ? <Text style={styles.hint}>{NO_SAVED_WALLETS_MESSAGE}</Text> : null}
      {otherCurrenciesHidden ? <Text style={styles.hint}>Chỉ hiện ví cùng loại tiền</Text> : null}
      {wallet ? (
        <Text style={styles.hint}>
          Số dư khả dụng: {formatCurrency(wallet.balance, wallet.currency)}
          {showProjection && projectedBalance !== null
            ? ` → ${formatCurrency(projectedBalance, wallet.currency)} sau giao dịch này`
            : ""}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  group: { gap: spacing.xs },
  // flex-start: an error under one tile must not stretch the other one.
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  half: { flex: 1, minWidth: 0, gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
  hint: { ...typography.tiny, color: colors.textMuted },
}));
