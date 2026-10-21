import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen } from "@/components/shared/Screen";
import { ChevronLeftIcon } from "@/components/ui/Icon";
import { spacing, typography, createStyles } from "@/lib/theme";
import { LoginOutcome } from "@/features/accounts/complete-login";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { PasskeySignInButton } from "@/features/auth/components/PasskeySignInButton";

const TITLE = "Thêm tài khoản";
const HINT = "Đăng nhập tài khoản khác. Tài khoản hiện tại vẫn được lưu trên thiết bị này.";

// Entry: "+ Thêm tài khoản" in the switch dialog, or an expired saved account
// (prefilled email). The current session keeps running untouched until the
// new login succeeds (spec AC-13); leaving changes nothing (S-ASW-29).
export default function AddAccountScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const handleDone = (outcome: LoginOutcome) => {
    if (outcome === "same-user") router.back();
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Quay lại" testID="btn-add-account-back">
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text style={styles.title}>{TITLE}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="screen-add-account">
        <Text style={styles.hint}>{HINT}</Text>
        <LoginForm
          mode="add-account"
          initialEmail={typeof email === "string" ? email : undefined}
          onDone={handleDone}
        />
        {/* Any account whose passkey is on this phone, not tied to the email typed. */}
        <PasskeySignInButton onDone={handleDone} />
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
  content: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  hint: { ...typography.label, color: colors.textSecondary },
}));
