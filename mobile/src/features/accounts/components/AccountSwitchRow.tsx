import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

import { UsersIcon } from "@/components/ui/Icon";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { AccountSwitchDialog } from "@/features/accounts/components/AccountSwitchDialog";
import { AvatarGroup } from "@/features/accounts/components/AvatarGroup";
import { useSavedAccounts } from "@/features/accounts/hooks/use-saved-accounts";

const LABEL = "Chuyển tài khoản";

/**
 * Settings' "Chuyển tài khoản" row, directly above "Đăng xuất" (spec AC-05).
 * Tap rule (AC-06/AC-07): always the dialog, which lists the active account,
 * every other saved one and the add action — the User picks the account.
 *
 * ⚠️ It used to switch straight away when there was exactly one other account:
 * the tap went to the identity check and then into the other account with
 * nothing on screen ever saying which one, which read as the app choosing for
 * the User.
 */
export function AccountSwitchRow() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { all } = useSavedAccounts();

  const openAddAccount = (prefillEmail?: string) => {
    router.push(prefillEmail ? { pathname: "/add-account", params: { email: prefillEmail } } : "/add-account");
  };

  return (
    <>
      <Pressable
        style={styles.row}
        onPress={() => setDialogOpen(true)}
        accessibilityRole="button"
        testID="row-settings-account-switch"
      >
        <UsersIcon size={20} color={colors.textSecondary} />
        <Text style={styles.label}>{LABEL}</Text>
        <AvatarGroup accounts={all} />
      </Pressable>
      <AccountSwitchDialog visible={dialogOpen} onClose={() => setDialogOpen(false)} onAddAccount={openAddAccount} />
    </>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
  },
  label: { flex: 1, ...typography.body, color: colors.textPrimary },
}));
