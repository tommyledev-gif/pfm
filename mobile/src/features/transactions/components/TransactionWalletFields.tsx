import { Text, View } from "react-native";

import { FieldError } from "@/components/ui/FieldError";
import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";
import { WalletPickerField } from "@/features/transactions/components/WalletPickerField";

const NO_SAVED_WALLETS_MESSAGE = "Kết nối mạng để tải danh sách ví.";

interface TransactionWalletFieldsProps {
  isTransfer: boolean;
  isEditing: boolean;
  wallet: Wallet | null;
  walletCount: number;
  onOpenWallets: () => void;
  /** A saved transfer's wallets: shown, not changeable. */
  walletLocked: boolean;
  /** Same-currency wallets only, for a saved transaction moving wallet. */
  otherCurrenciesHidden: boolean;
  noSavedWallets: boolean;
  /** The balance after this transaction, when it moves money in this wallet. */
  projectedBalance: number | null;
  showProjection: boolean;
  destination: Wallet | null;
  destinationCount: number;
  onOpenDestinations: () => void;
  walletError?: string;
  destinationError?: string;
}

/**
 * The wallet half of TransactionFormModal ("Ví", or "Từ ví" and "Đến ví" for a
 * transfer), split out for the 300-line limit.
 */
export function TransactionWalletFields({
  isTransfer,
  isEditing,
  wallet,
  walletCount,
  onOpenWallets,
  walletLocked,
  otherCurrenciesHidden,
  noSavedWallets,
  projectedBalance,
  showProjection,
  destination,
  destinationCount,
  onOpenDestinations,
  walletError,
  destinationError,
}: TransactionWalletFieldsProps) {
  const styles = useStyles();
  const lockedSuffix = isEditing ? " (khóa sau khi tạo)" : "";
  const sourceLabel = isTransfer ? "Từ ví" : "Ví";

  return (
    <>
      <View style={styles.group}>
        <Text style={styles.label}>
          {sourceLabel}
          {walletLocked ? lockedSuffix : ""}
        </Text>
        <WalletPickerField
          label={sourceLabel}
          wallet={wallet}
          count={walletCount}
          placeholder="Chọn ví"
          onPress={onOpenWallets}
          locked={walletLocked}
          testID="field-transaction-wallet"
        />
        {noSavedWallets ? <Text style={styles.hint}>{NO_SAVED_WALLETS_MESSAGE}</Text> : null}
        {otherCurrenciesHidden ? <Text style={styles.hint}>Chỉ hiện ví cùng loại tiền</Text> : null}
        <FieldError message={walletError} />
        {wallet ? (
          <Text style={styles.balance}>
            Số dư khả dụng: {formatCurrency(wallet.balance, wallet.currency)}
            {showProjection && projectedBalance !== null
              ? ` → ${formatCurrency(projectedBalance, wallet.currency)} sau giao dịch này`
              : ""}
          </Text>
        ) : null}
      </View>

      {isTransfer ? (
        <View style={styles.group}>
          <Text style={styles.label}>Đến ví{lockedSuffix}</Text>
          {destinationCount > 0 || destination ? (
            <WalletPickerField
              label="Đến ví"
              wallet={destination}
              count={destinationCount}
              placeholder="Chọn ví nhận"
              onPress={onOpenDestinations}
              locked={isEditing}
              testID="field-transaction-to-wallet"
            />
          ) : (
            <Text style={styles.hint}>Cần thêm một ví khác cùng đơn vị tiền tệ để chuyển khoản.</Text>
          )}
          <FieldError message={destinationError} />
        </View>
      ) : null}
    </>
  );
}

const useStyles = createStyles((colors) => ({
  group: { gap: spacing.xs + 2 },
  label: { ...typography.caption, color: colors.textSecondary, paddingHorizontal: spacing.xs },
  hint: { ...typography.tiny, color: colors.textMuted, paddingHorizontal: spacing.xs },
  balance: {
    ...typography.caption,
    fontWeight: "500",
    color: colors.textSecondary,
    paddingHorizontal: spacing.xs,
    fontVariant: ["tabular-nums"],
  },
}));
