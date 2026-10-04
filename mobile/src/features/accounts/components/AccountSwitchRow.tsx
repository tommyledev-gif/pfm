import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

import { UsersIcon } from "@/components/ui/Icon";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { isAccountExpired } from "@/features/accounts/account-registry-store";
import { AccountSwitchDialog } from "@/features/accounts/components/AccountSwitchDialog";
import { AvatarGroup } from "@/features/accounts/components/AvatarGroup";
import { useSavedAccounts } from "@/features/accounts/hooks/use-saved-accounts";
import { switchToAccount } from "@/features/accounts/switch-account";

const LABEL = "Chuyển tài khoản";

/**
 * Settings' "Chuyển tài khoản" row, directly above "Đăng xuất" (spec AC-05).
 * Tap rule (AC-06/AC-07): exactly one other account → switch straight to it
 * (identity check first); otherwise → the dialog, which always lists the
 * active account and the add action.
 */
export function AccountSwitchRow() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { all, others } = useSavedAccounts();

  const openAddAccount = (prefillEmail?: string) => {
    router.push(prefillEmail ? { pathname: "/add-account", params: { email: prefillEmail } } : "/add-account");
  };

  const onPress = () => {
    const [onlyOther] = others;
    if (others.length !== 1 || !onlyOther) {
      setDialogOpen(true);
      return;
    }
    if (isAccountExpired(onlyOther)) {
      openAddAccount(onlyOther.email);
      return;
    }
    switchToAccount(onlyOther.userId).catch(() => {});
  };

  return (
    <>
      <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" testID="row-settings-account-switch">
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
