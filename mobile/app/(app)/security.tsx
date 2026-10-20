import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Screen } from "@/components/shared/Screen";
import { useFabBottom } from "@/components/ui/Fab";
import { ChevronLeftIcon } from "@/components/ui/Icon";
import { spacing, typography, createStyles } from "@/lib/theme";
import { useSessionStore } from "@/stores/session-store";
import { isAccountDeletionOperator } from "@/features/security/account-deletion";
import { AppLockToggleRow } from "@/features/security/components/AppLockToggleRow";
import { ChangePasswordRow } from "@/features/security/components/ChangePasswordRow";
import { DeleteAccountsSection } from "@/features/security/components/DeleteAccountsSection";
import { DeviceSessionsSection } from "@/features/security/components/DeviceSessionsSection";
import { IdentityCheckToggleRow } from "@/features/security/components/IdentityCheckToggleRow";
import { PasskeysSection } from "@/features/security/components/PasskeysSection";
import { RevokeAllSessionsRow } from "@/features/security/components/RevokeAllSessionsRow";

const TITLE = "Bảo mật";

// Entry point: Settings' "Bảo mật" row (spec US-07 step 1, AC-34). Back
// returns to Settings; BottomNav keeps Settings highlighted.
//
// Order follows what a User comes here to do: see where the account is
// signed in (and sign a lost phone out), change the password, then the
// device's own protections, then the account-wide sign-out.
export default function SecurityScreen() {
  const styles = useStyles();
  const router = useRouter();
  const canDeleteAccounts = useSessionStore((s) => isAccountDeletionOperator(s.email));
  // The floating BottomNav covers the screen's foot, and the account-wide
  // sign-out at the end of the list sat under it.
  const navClearance = useFabBottom();

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} testID="btn-security-back" accessibilityLabel="Quay lại">
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text style={styles.title}>{TITLE}</Text>
      </View>
      {/* "handled": with the search keyboard open, the first tap on [Xóa] has
          to reach the row, not just close the keyboard. */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: navClearance }]}
        keyboardShouldPersistTaps="handled"
        testID="screen-security"
      >
        <DeviceSessionsSection />
        <ChangePasswordRow />
        <AppLockToggleRow />
        <IdentityCheckToggleRow />
        <PasskeysSection />
        <RevokeAllSessionsRow />
        {canDeleteAccounts ? <DeleteAccountsSection /> : null}
      </ScrollView>
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: { flex: 1, ...typography.title, color: colors.textPrimary },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md },
}));
