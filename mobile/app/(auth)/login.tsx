import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Screen } from "@/components/shared/Screen";
import { BrandMark } from "@/features/auth/components/BrandMark";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { PasskeySignInButton } from "@/features/auth/components/PasskeySignInButton";
import { SavedAccountLogin } from "@/features/accounts/components/SavedAccountLogin";
import { SavedAccountsEntry } from "@/features/accounts/components/SavedAccountsEntry";
import { useLoginCandidates } from "@/features/accounts/login-candidates";
import { passkeysAvailable } from "@/features/security/passkeys/native-passkey";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { spacing, typography, createStyles } from "@/lib/theme";
import { useDebugTestAccountsStore } from "@/stores/debug-test-accounts-store";

const COPY = {
  title: "Đăng nhập",
  or: "hoặc",
  noAccount: "Chưa có tài khoản?",
  requestAccess: "Gửi yêu cầu tạo tài khoản",
} as const;

// The same size as the form's own button, so the shortcuts line up under it.
const ACTION_HEIGHT = 56;
const ACTION_RADIUS = 16;

// Two views, never both at once:
//  A. one main way in (email, then password, behind the only green button),
//     then the shortcuts under "hoặc": passkey and the saved accounts row
//     (saved accounts, a sent request, test accounts). Asking for an account
//     sits at the foot, for the few who have none yet;
//  B. that row opened: SavedAccountLogin (who, then one way in).
export default function LoginScreen() {
  const styles = useStyles();
  const router = useRouter();
  const keyboardHeight = useKeyboardHeight();
  const { candidates, isHydrated } = useLoginCandidates();
  const [showSaved, setShowSaved] = useState(false);
  const revealPending = useDebugTestAccountsStore((s) => s.revealPending);
  const goHome = () => router.replace("/(app)/(tabs)");
  const showForm = useCallback(() => setShowSaved(false), []);

  // The debug console's "Test accounts" lands here with them listed.
  useEffect(() => {
    if (!revealPending) return;
    useDebugTestAccountsStore.getState().consumeReveal();
    setShowSaved(true);
  }, [revealPending]);

  if (!isHydrated) return <Screen>{null}</Screen>;

  // SavedAccountLogin scrolls on its own, so its dialog can sit beside the scroll view.
  if (showSaved && candidates.length > 0) {
    return (
      <Screen>
        <SavedAccountLogin candidates={candidates} onBack={showForm} onDone={goHome} />
      </Screen>
    );
  }

  // Expo Go and old Android have no passkeys; with no saved account either,
  // there is nothing to put under "hoặc".
  const hasShortcuts = passkeysAvailable() || candidates.length > 0;

  return (
    <Screen>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + keyboardHeight }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <BrandMark />
        </View>
        <Text style={styles.title} accessibilityRole="header">{COPY.title}</Text>
        <View style={styles.form}>
          <LoginForm onDone={goHome} />
        </View>
        {hasShortcuts ? (
          <>
            <View style={styles.divider} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <View style={styles.rule} />
              <Text style={styles.dividerLabel}>{COPY.or}</Text>
              <View style={styles.rule} />
            </View>
            <View style={styles.shortcuts}>
              {/* Any account whose passkey is on this phone, not tied to the email typed. */}
              <PasskeySignInButton onDone={goHome} style={styles.shortcutButton} textStyle={styles.shortcutLabel} />
              {candidates.length > 0 ? (
                <SavedAccountsEntry candidates={candidates} onPress={() => setShowSaved(true)} />
              ) : null}
            </View>
          </>
        ) : null}
        {/* Invite-only: without an invite, ask an admin for one. */}
        <View style={styles.requestRow}>
          <Text style={styles.requestHint}>{COPY.noAccount}</Text>
          <Pressable
            onPress={() => router.push("/request-access")}
            hitSlop={8}
            accessibilityRole="button"
            testID="btn-login-request-access"
          >
            <Text style={styles.requestLink}>{COPY.requestAccess}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { flexGrow: 1, paddingHorizontal: spacing.xxl, paddingTop: spacing.md },
  header: { minHeight: 44, flexDirection: "row", alignItems: "center" },
  title: { marginTop: 32, fontSize: 30, lineHeight: 38, fontWeight: "700", letterSpacing: -0.3, color: colors.textPrimary },
  form: { marginTop: 28 },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xxl, marginBottom: spacing.lg },
  rule: { flex: 1, height: 1, backgroundColor: colors.surfaceBorder },
  dividerLabel: { ...typography.caption, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  shortcuts: { gap: spacing.md },
  shortcutButton: { height: ACTION_HEIGHT, borderRadius: ACTION_RADIUS },
  shortcutLabel: { fontSize: 16 },
  // marginTop auto: pinned to the bottom of the screen, below any shortcut.
  requestRow: {
    marginTop: "auto",
    paddingTop: spacing.xxl,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  requestHint: { ...typography.label, color: colors.textSecondary },
  requestLink: { ...typography.label, fontWeight: "600", color: colors.green },
}));
