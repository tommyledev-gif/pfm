import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";

import { MotionView } from "@/components/motion/MotionView";
import { ListSection } from "@/components/ui/grouped-list";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { useFabBottom } from "@/components/ui/Fab";
import { spacing, createStyles } from "@/lib/theme";
import { APP_LOCK_FOOTER, AppLockToggleRow } from "@/features/security/components/AppLockToggleRow";
import { CHANGE_PASSWORD_FOOTER, ChangePasswordRow } from "@/features/security/components/ChangePasswordRow";
import { DeviceSessionsSection } from "@/features/security/components/DeviceSessionsSection";
import { IDENTITY_CHECK_FOOTER, IdentityCheckToggleRow } from "@/features/security/components/IdentityCheckToggleRow";
import { PasskeysSection } from "@/features/security/components/PasskeysSection";
import { PinSection } from "@/features/security/components/PinSection";
import { REVOKE_ALL_FOOTER, RevokeAllSessionsRow } from "@/features/security/components/RevokeAllSessionsRow";

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
  const { t } = useTranslation();
  const styles = useStyles();
  // The floating BottomNav covers the screen's foot, and the account-wide
  // sign-out at the end of the list sat under it.
  const navClearance = useFabBottom();

  // Groups stagger in top to bottom on mount; refetches never replay it.
  const groups = [
    <DeviceSessionsSection key="devices" />,
    <ListSection key="password" footer={t(CHANGE_PASSWORD_FOOTER)}>
      <ChangePasswordRow />
    </ListSection>,
    <ListSection key="app-lock" header={t("security.protections.header")} footer={t(APP_LOCK_FOOTER)}>
      <AppLockToggleRow />
    </ListSection>,
    <PinSection key="pin" />,
    <ListSection key="identity-check" footer={t(IDENTITY_CHECK_FOOTER)}>
      <IdentityCheckToggleRow />
    </ListSection>,
    <PasskeysSection key="passkeys" />,
    <ListSection key="revoke-all" footer={t(REVOKE_ALL_FOOTER)}>
      <RevokeAllSessionsRow />
    </ListSection>,
  ];

  return (
    <Screen style={styles.screen}>
      <ScreenHeader title={t("nav.title.security")} backTestID="btn-security-back" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: navClearance }]} testID="screen-security">
        {groups.map((group, index) => (
          <MotionView key={group.key} index={index}>
            {group}
          </MotionView>
        ))}
      </ScrollView>
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: spacing.xl, gap: spacing.xxl },
}));
