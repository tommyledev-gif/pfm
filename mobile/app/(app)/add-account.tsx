import { ScrollView, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Screen } from "@/components/shared/Screen";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { spacing, typography, createStyles } from "@/lib/theme";
import { LoginOutcome } from "@/features/accounts/complete-login";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { PasskeySignInButton } from "@/features/auth/components/PasskeySignInButton";

// Entry: "+ Thêm tài khoản" in the switch dialog, or an expired saved account
// (prefilled email). The current session keeps running untouched until the
// new login succeeds (spec AC-13); leaving changes nothing (S-ASW-29).
export default function AddAccountScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const handleDone = (outcome: LoginOutcome) => {
    if (outcome === "same-user") router.back();
  };

  return (
    <Screen style={styles.screen}>
      <ScreenHeader title={t("nav.title.addAccount")} backTestID="btn-add-account-back" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="screen-add-account">
        <Text style={styles.hint}>{t("accounts.add.hint")}</Text>
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
  content: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  hint: { ...typography.label, color: colors.textSecondary },
}));
