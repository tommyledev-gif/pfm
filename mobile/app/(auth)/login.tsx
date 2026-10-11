import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Screen } from "@/components/shared/Screen";
import { ChevronLeftIcon } from "@/components/ui/Icon";
import { BrandMark } from "@/features/auth/components/BrandMark";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { SavedAccountLogin } from "@/features/accounts/components/SavedAccountLogin";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";

const COPY = {
  title: "Đăng nhập",
  back: "Quay lại",
  noAccount: "Chưa có tài khoản?",
  requestAccess: "Gửi yêu cầu tạo tài khoản",
} as const;

// Two states, never both at once:
//  A. an account is remembered here → SavedAccountLogin (who, then one way in);
//  B. nothing remembered, or "Dùng tài khoản khác" → email + password.
export default function LoginScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const keyboardHeight = useKeyboardHeight();
  const isHydrated = useAccountRegistryStore((s) => s.isHydrated);
  const accounts = useAccountRegistryStore((s) => s.accounts);
  const [useAnother, setUseAnother] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ordered = [...accounts].sort((a, b) => Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt));
  // Falls back to the most recent one when nothing is picked yet, or when the
  // picked one has just been removed from the device.
  const selected = ordered.find((a) => a.userId === selectedId) ?? ordered[0];
  const showSaved = !useAnother && selected !== undefined;
  const goHome = () => router.replace("/(app)/(tabs)");

  if (!isHydrated) return <Screen>{null}</Screen>;

  // SavedAccountLogin scrolls on its own, so its sheets can sit beside the scroll view.
  if (showSaved) {
    return (
      <Screen>
        <SavedAccountLogin
          account={selected}
          accounts={ordered}
          onSelect={setSelectedId}
          onUseAnother={() => setUseAnother(true)}
          onDone={goHome}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + keyboardHeight }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back to the saved account when there is one; else the brand row. */}
        <View style={styles.header}>
          {ordered.length > 0 ? (
            <Pressable
              onPress={() => setUseAnother(false)}
              style={styles.back}
              accessibilityRole="button"
              accessibilityLabel={COPY.back}
              testID="btn-login-back-to-saved"
            >
              <ChevronLeftIcon size={24} color={colors.textPrimary} />
            </Pressable>
          ) : (
            <BrandMark />
          )}
        </View>
        <Text style={styles.title} accessibilityRole="header">{COPY.title}</Text>
        <View style={styles.form}>
          <LoginForm onDone={goHome} />
        </View>
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
  back: { width: 44, height: 44, marginLeft: -10, alignItems: "center", justifyContent: "center" },
  title: { marginTop: 32, fontSize: 30, lineHeight: 38, fontWeight: "700", letterSpacing: -0.3, color: colors.textPrimary },
  form: { marginTop: 32 },
  requestRow: { marginTop: spacing.xl, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  requestHint: { ...typography.label, color: colors.textSecondary },
  requestLink: { ...typography.label, fontWeight: "600", color: colors.green },
}));
