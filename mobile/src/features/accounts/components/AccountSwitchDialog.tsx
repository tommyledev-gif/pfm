import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MAX_SAVED_ACCOUNTS } from "@/lib/constants";
import { createStyles, radii, spacing, typography } from "@/lib/theme";
import { REMOVE_ACCOUNT_COPY } from "@/features/accounts/account-copy";
import { accountDisplayName, isAccountExpired } from "@/features/accounts/account-registry-store";
import { AccountRow } from "@/features/accounts/components/AccountRow";
import { useSavedAccounts } from "@/features/accounts/hooks/use-saved-accounts";
import { removeActiveAccount, removeSavedAccount } from "@/features/accounts/remove-account";
import { switchToAccount } from "@/features/accounts/switch-account";
import { SavedAccount } from "@/features/accounts/types";

interface AccountSwitchDialogProps {
  visible: boolean;
  onClose: () => void;
  /** Opens "Thêm tài khoản", prefilled with an expired account's email. */
  onAddAccount: (prefillEmail?: string) => void;
}

const TITLE = "Chuyển tài khoản";
const ADD_LABEL = "+ Thêm tài khoản";
const LIMIT_HINT = `Đã đạt tối đa ${MAX_SAVED_ACCOUNTS} tài khoản trên thiết bị này`;

/**
 * Every saved account (spec US-02 step 4): the active one first, labelled
 * "Đang dùng" and not tappable — shown even when it is the only one (AC-07);
 * expired ones open the login form; locked ones (logged out here) open with
 * the fingerprint. Every row, the active one too, can be removed from the
 * device after a confirm (US-04).
 */
export function AccountSwitchDialog({ visible, onClose, onAddAccount }: AccountSwitchDialogProps) {
  const styles = useStyles();
  const [pendingRemoval, setPendingRemoval] = useState<SavedAccount | null>(null);
  const { active, others, canAddMore } = useSavedAccounts();

  const pick = async (account: SavedAccount) => {
    if (isAccountExpired(account)) {
      onClose();
      onAddAccount(account.email);
      return;
    }
    const outcome = await switchToAccount(account.userId);
    if (outcome === "switched") onClose();
  };

  const confirmRemoval = async () => {
    const account = pendingRemoval;
    setPendingRemoval(null);
    if (!account) return;
    if (account.userId === active?.userId) {
      // The account in use: the login screen takes over.
      onClose();
      await removeActiveAccount();
      return;
    }
    await removeSavedAccount(account.userId);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.card} testID="dialog-account-switch">
          <Text style={styles.title}>{TITLE}</Text>
          <View>
            {active ? (
              <AccountRow
                account={active}
                isActive
                onPress={() => {}}
                onRemove={setPendingRemoval}
                testID={`row-account-${active.userId}`}
              />
            ) : null}
            {others.map((account) => (
              <View key={account.userId} style={styles.divided}>
                <AccountRow
                  account={account}
                  isActive={false}
                  onPress={pick}
                  onRemove={setPendingRemoval}
                  testID={`row-account-${account.userId}`}
                />
              </View>
            ))}
          </View>
          {canAddMore ? (
            <Pressable
              style={styles.add}
              onPress={() => {
                onClose();
                onAddAccount();
              }}
              accessibilityRole="button"
              testID="btn-account-add"
            >
              <Text style={styles.addLabel}>{ADD_LABEL}</Text>
            </Pressable>
          ) : (
            <Text style={styles.hint} testID="text-account-limit-hint">{LIMIT_HINT}</Text>
          )}
        </Pressable>
      </Pressable>

      <ConfirmDialog
        visible={pendingRemoval !== null}
        title={pendingRemoval ? REMOVE_ACCOUNT_COPY.title(accountDisplayName(pendingRemoval)) : ""}
        message={REMOVE_ACCOUNT_COPY.message}
        confirmLabel={REMOVE_ACCOUNT_COPY.confirm}
        cancelLabel={REMOVE_ACCOUNT_COPY.cancel}
        onConfirm={confirmRemoval}
        onCancel={() => setPendingRemoval(null)}
        testID="dialog-account-remove"
      />
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.hero,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  title: { ...typography.title, color: colors.textPrimary },
  divided: { borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  add: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  addLabel: { ...typography.body, color: colors.green },
  hint: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.md },
}));
