import { useState } from "react";
import { useRouter } from "expo-router";

import { ListRow } from "@/components/ui/grouped-list";
import { SwitchAccountGlyph } from "@/components/ui/grouped-list/list-icons";
import { useColors } from "@/lib/theme";
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
 *
 * A row of the grouped list it sits in (ListSection draws its hairlines);
 * AvatarGroup's rings are the group's surface colour, so they cut cleanly.
 */
export function AccountSwitchRow() {
  const colors = useColors();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { all } = useSavedAccounts();

  const openAddAccount = (prefillEmail?: string) => {
    router.push(prefillEmail ? { pathname: "/add-account", params: { email: prefillEmail } } : "/add-account");
  };

  return (
    <>
      <ListRow
        title={LABEL}
        icon={SwitchAccountGlyph}
        tone={colors.lavender}
        trailing={<AvatarGroup accounts={all} />}
        onPress={() => setDialogOpen(true)}
        testID="row-settings-account-switch"
      />
      <AccountSwitchDialog visible={dialogOpen} onClose={() => setDialogOpen(false)} onAddAccount={openAddAccount} />
    </>
  );
}
