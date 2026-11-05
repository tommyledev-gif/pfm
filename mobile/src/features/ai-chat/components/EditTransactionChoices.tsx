import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

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
  // Only a saved proposal with no Transaction id behind it (or one the User
  // can no longer write to) keeps its type; any other can change it.
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
 * for a transfer (the same as the manual form). A saved entry's type can
 * change, and an income/expense's wallet (the caller asks first, see
 * useWalletChangeGuard); a saved transfer's wallets cannot.
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
  const { t } = useTranslation();
  const isTransfer = type === "transfer";

  return (
    <>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{t("common.field.type")}</Text>
        <TransactionTypeChips
          type={type}
          locked={typeLocked}
          itemCount={itemCount}
          onSelect={onChangeType}
          onClearItems={onClearItems}
        />
        {typeLocked ? <Text style={styles.hint}>{t("chat.editTransaction.typeLocked")}</Text> : null}
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
                    {t(NO_VND_WALLET_HINT)}
                  </Text>
                  <Pressable onPress={onCreateVndWallet} hitSlop={8} testID="btn-edit-create-vnd-wallet">
                    <Text style={styles.createWalletLink}>{t("chat.proposal.createVndWallet")}</Text>
                  </Pressable>
                </>
              ) : null}
              {otherCurrenciesHidden ? <Text style={styles.hint}>{t("chat.editTransaction.sameCurrencyOnly")}</Text> : null}
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
          testID="field-edit-wallet"
        />
        {!isTransfer ? null : destinationCount > 0 || destination ? (
          <WalletSelectTile
            label={t("common.field.toWallet")}
            wallet={destination}
            placeholder={t("common.action.choose")}
            onPress={onOpenDestinations}
            locked={destinationLocked}
            destination
            testID="field-edit-to-wallet"
          />
        ) : (
          <ListRow
            title={t("common.field.toWallet")}
            subtitle={t("chat.editTransaction.needsSecondVndWallet")}
            icon={ArrowRightGlyph}
            disabled
          />
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
