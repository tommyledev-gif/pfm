import { Pressable, Text, View } from "react-native";

import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { TRANSACTION_TYPES, TransactionType } from "@/lib/constants";
import { WalletChipRow } from "@/features/transactions/components/WalletChipRow";
import { NO_VND_WALLET_HINT } from "@/features/ai-chat/proposal-wallet";
import { Wallet } from "@/features/wallets/types";

interface EditTransactionChoicesProps {
  type: TransactionType;
  onChangeType: (type: TransactionType) => void;
  // A saved transaction keeps its type: PATCH has no such field.
  typeLocked: boolean;
  wallets: Wallet[];
  selectedWalletId: string | null;
  onSelectWallet: (id: string) => void;
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
  wallets,
  selectedWalletId,
  onSelectWallet,
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
        <View style={styles.chipRow}>
          {TRANSACTION_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => !typeLocked && onChangeType(t)}
              disabled={typeLocked}
              style={[styles.chip, type === t && styles.chipActive, typeLocked && styles.chipDisabled]}
            >
              <Text style={[styles.chipLabel, type === t && styles.chipLabelActive]}>{t === "expense" ? "Chi" : "Thu"}</Text>
            </Pressable>
          ))}
        </View>
        {typeLocked ? <Text style={styles.hint}>Không đổi được loại của giao dịch đã lưu</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Ví</Text>
        <WalletChipRow wallets={wallets} selectedId={selectedWalletId} onSelect={onSelectWallet} locked={walletLocked} />
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
  fieldGroup: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: {
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipDisabled: { opacity: 0.4 },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.onGreen },
  hint: { ...typography.tiny, color: colors.textMuted },
  createWalletLink: { ...typography.caption, color: colors.green },
}));
