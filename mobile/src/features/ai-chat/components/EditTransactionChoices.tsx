import { Pressable, Text, View } from "react-native";

import { ListRow, ListSection } from "@/components/ui/grouped-list";
import { ArrowRightGlyph } from "@/components/ui/grouped-list/list-icons";
import { spacing, typography, createStyles } from "@/lib/theme";
import { TransactionKind } from "@/lib/constants";
import { TransactionTypeChips } from "@/features/transactions/components/TransactionTypeChips";
import { WalletSelectTile } from "@/features/transactions/components/WalletSelectTile";
import { NO_VND_WALLET_HINT } from "@/features/ai-chat/proposal-wallet";
import { Wallet } from "@/features/wallets/types";

interface EditTransactionChoicesProps {
  type: TransactionKind;
  onChangeType: (type: TransactionKind) => void;
  // A saved transaction keeps its type: PATCH has no such field.
  typeLocked: boolean;
  // Items on the proposal: switching to transfer asks before dropping them.
  itemCount: number;
  onClearItems: () => void;
  /** The chosen wallet, if it is one of those offered. */
  wallet: Wallet | null;
  /** Opens the wallet list (useWalletPickerPanel). */
  onOpenWallets: () => void;
  walletLocked: boolean;
  /** A transfer's destination, if it is one of those offered. */
  destination: Wallet | null;
  /** Wallets a transfer could go to: none means there is nowhere to send it. */
  destinationCount: number;
  onOpenDestinations: () => void;
  destinationLocked: boolean;
  // Unsaved proposal and the User owns no VND wallet (spec AC-33).
  noVndWallet: boolean;
  onCreateVndWallet: () => void;
  // Saved transaction: wallets in other currencies are not offered.
  otherCurrenciesHidden: boolean;
}

/**
 * The type and wallet pickers of EditTransactionModal, split out for its
 * 300-line limit: the type as the manual form's segmented control, the wallet
 * as a row of an inset group opening the wallet list, "Từ ví" over "Đến ví"
 * for a transfer (the same as the manual form). A saved income/expense's wallet can
 * change (the caller asks first, see useWalletChangeGuard); its type cannot,
 * and a saved transfer's wallets cannot either.
 */
export function EditTransactionChoices({
  type,
  onChangeType,
  typeLocked,
  itemCount,
  onClearItems,
  wallet,
  onOpenWallets,
  walletLocked,
  destination,
  destinationCount,
  onOpenDestinations,
  destinationLocked,
  noVndWallet,
  onCreateVndWallet,
  otherCurrenciesHidden,
}: EditTransactionChoicesProps) {
  const styles = useStyles();
  const isTransfer = type === "transfer";

  return (
    <>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Loại</Text>
        <TransactionTypeChips
          type={type}
          locked={typeLocked}
          itemCount={itemCount}
          onSelect={onChangeType}
          onClearItems={onClearItems}
        />
        {typeLocked ? <Text style={styles.hint}>Không đổi được loại của giao dịch đã lưu</Text> : null}
      </View>

      {/* One inset group, as the manual form: "Ví", or "Từ ví" over "Đến ví". */}
      <ListSection
        onSheet
        footer={
          noVndWallet || otherCurrenciesHidden ? (
            <View style={styles.fieldGroup}>
              {noVndWallet ? (
                <>
                  <Text testID="txt-edit-no-vnd-wallet" style={styles.hint}>
                    {NO_VND_WALLET_HINT}
                  </Text>
                  <Pressable onPress={onCreateVndWallet} hitSlop={8} testID="btn-edit-create-vnd-wallet">
                    <Text style={styles.createWalletLink}>Tạo ví VND</Text>
                  </Pressable>
                </>
              ) : null}
              {otherCurrenciesHidden ? <Text style={styles.hint}>Chỉ hiện ví cùng loại tiền</Text> : null}
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
          testID="field-edit-wallet"
        />
        {!isTransfer ? null : destinationCount > 0 || destination ? (
          <WalletSelectTile
            label="Đến ví"
            wallet={destination}
            placeholder="Chọn"
            onPress={onOpenDestinations}
            locked={destinationLocked}
            destination
            testID="field-edit-to-wallet"
          />
        ) : (
          <ListRow title="Đến ví" subtitle="Cần thêm một ví VND khác để chuyển khoản." icon={ArrowRightGlyph} disabled />
        )}
      </ListSection>
    </>
  );
}

const useStyles = createStyles((colors) => ({
  fieldGroup: { gap: spacing.xs },
  // flex-start: a hint under one side must not stretch the other.
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  half: { flex: 1, minWidth: 0, gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
  hint: { ...typography.tiny, color: colors.textMuted },
  createWalletLink: { ...typography.caption, color: colors.green },
}));
