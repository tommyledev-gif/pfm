import { ScrollView } from "react-native";

import { MotionView } from "@/components/motion/MotionView";
import { ListSection } from "@/components/ui/grouped-list";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { useFabBottom } from "@/components/ui/Fab";
import { spacing, createStyles } from "@/lib/theme";
import { useProfileQuery } from "@/features/profile/api/use-profile-query";
import { APP_LOCK_FOOTER, AppLockToggleRow } from "@/features/security/components/AppLockToggleRow";
import { CHANGE_PASSWORD_FOOTER, ChangePasswordRow } from "@/features/security/components/ChangePasswordRow";
import { DeleteAccountsSection } from "@/features/security/components/DeleteAccountsSection";
import { DeviceSessionsSection } from "@/features/security/components/DeviceSessionsSection";
import { IDENTITY_CHECK_FOOTER, IdentityCheckToggleRow } from "@/features/security/components/IdentityCheckToggleRow";
import { PasskeysSection } from "@/features/security/components/PasskeysSection";
import { PinSection } from "@/features/security/components/PinSection";
import { REVOKE_ALL_FOOTER, RevokeAllSessionsRow } from "@/features/security/components/RevokeAllSessionsRow";

const TITLE = "Bảo mật";
const PROTECTIONS_HEADER = "Khóa và xác minh";

// Entry point: Settings' "Bảo mật" row (spec US-07 step 1, AC-34). Back
// returns to Settings; BottomNav keeps Settings highlighted.
//
// Order follows what a User comes here to do: see where the account is
// signed in (and sign a lost phone out), change the password, then the
// device's own protections, then the account-wide sign-out.
//
// One grouped list (iOS Settings style): each topic is one rounded group,
// with what it does said once in the group's footer, not in a box per row.
export default function SecurityScreen() {
  const styles = useStyles();
  // The server says who may use the account deletion tool (GET /users/me);
  // the app no longer carries the operator's email.
  const { data: me } = useProfileQuery();
  const canDeleteAccounts = me?.can_delete_accounts === true;
  // The floating BottomNav covers the screen's foot, and the account-wide
  // sign-out at the end of the list sat under it.
  const navClearance = useFabBottom();

  // Groups stagger in top to bottom on mount; refetches never replay it.
  const groups = [
    <DeviceSessionsSection key="devices" />,
    <ListSection key="password" footer={CHANGE_PASSWORD_FOOTER}>
      <ChangePasswordRow />
    </ListSection>,
    <ListSection key="app-lock" header={PROTECTIONS_HEADER} footer={APP_LOCK_FOOTER}>
      <AppLockToggleRow />
    </ListSection>,
    <PinSection key="pin" />,
    <ListSection key="identity-check" footer={IDENTITY_CHECK_FOOTER}>
      <IdentityCheckToggleRow />
    </ListSection>,
    <PasskeysSection key="passkeys" />,
    <ListSection key="revoke-all" footer={REVOKE_ALL_FOOTER}>
      <RevokeAllSessionsRow />
    </ListSection>,
    canDeleteAccounts ? <DeleteAccountsSection key="delete-accounts" /> : null,
  ];

  return (
    <Screen style={styles.screen}>
      <ScreenHeader title={TITLE} backTestID="btn-security-back" />
      {/* "handled": with the search keyboard open, the first tap on [Xóa] has
          to reach the row, not just close the keyboard. */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: navClearance }]}
        keyboardShouldPersistTaps="handled"
        testID="screen-security"
      >
        {groups.map((group, index) =>
          group ? (
            <MotionView key={group.key} index={index}>
              {group}
            </MotionView>
          ) : null,
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: spacing.xl, gap: spacing.xxl },
}));
