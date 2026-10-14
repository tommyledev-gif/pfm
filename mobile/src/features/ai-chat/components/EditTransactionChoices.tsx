import { Pressable, Text, View } from "react-native";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { spacing, typography, createStyles } from "@/lib/theme";
import { TransactionType } from "@/lib/constants";
import { WalletPickerField } from "@/features/transactions/components/WalletPickerField";
import { NO_VND_WALLET_HINT } from "@/features/ai-chat/proposal-wallet";
import { Wallet } from "@/features/wallets/types";

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Chi" },
  { value: "income", label: "Thu" },
];

interface EditTransactionChoicesProps {
  type: TransactionType;
  onChangeType: (type: TransactionType) => void;
  // A saved transaction keeps its type: PATCH has no such field.
  typeLocked: boolean;
  /** The chosen wallet, if it is one of those offered. */
  wallet: Wallet | null;
  walletCount: number;
  onOpenWallets: () => void;
  walletLocked: boolean;
  // Unsaved proposal and the User owns no VND wallet (spec AC-33).
  noVndWallet: boolean;
  onCreateVndWallet: () => void;
  // Saved transaction: wallets in other currencies are not offered.
  otherCurrenciesHidden: boolean;
}

/**
 * The type and wallet pickers of EditTransactionModal, split out for its
 * 300-line limit. A saved transaction's wallet can change (the caller asks
 * first, see useWalletChangeGuard); its type cannot.
 */
export function EditTransactionChoices({
  type,
  onChangeType,
  typeLocked,
  wallet,
  walletCount,
  onOpenWallets,
  walletLocked,
  noVndWallet,
  onCreateVndWallet,
  otherCurrenciesHidden,
}: EditTransactionChoicesProps) {
  const styles = useStyles();

  return (
    <>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Loại</Text>
        <SegmentedControl
          options={TYPE_OPTIONS}
          value={type}
          onChange={onChangeType}
          disabled={typeLocked}
          testID="segmented-edit-type"
        />
        {typeLocked ? <Text style={styles.hint}>Không đổi được loại của giao dịch đã lưu</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Ví</Text>
        <WalletPickerField
          label="Ví"
          wallet={wallet}
          count={walletCount}
          placeholder="Chọn ví"
          onPress={onOpenWallets}
          locked={walletLocked}
          testID="field-edit-wallet"
        />
        {noVndWallet ? (
          <>
            <Text testID="txt-edit-no-vnd-wallet" style={styles.hint}>
              {NO_VND_WALLET_HINT}
            </Text>
            <Pressable onPress={onCreateVndWallet} hitSlop={8} testID="btn-edit-create-vnd-wallet">
              <Text style={styles.createWalletLink}>Tạo ví VND →</Text>
            </Pressable>
          </>
        ) : null}
        {otherCurrenciesHidden ? <Text style={styles.hint}>Chỉ hiện ví cùng loại tiền</Text> : null}
      </View>
    </>
  );
}

const useStyles = createStyles((colors) => ({
  fieldGroup: { gap: spacing.xs + 2 },
  label: { ...typography.caption, color: colors.textSecondary, paddingHorizontal: spacing.xs },
  hint: { ...typography.tiny, color: colors.textMuted, paddingHorizontal: spacing.xs },
  createWalletLink: { ...typography.caption, color: colors.accentMuted, paddingHorizontal: spacing.xs },
}));
