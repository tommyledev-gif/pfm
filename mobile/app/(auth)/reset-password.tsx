import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen } from "@/components/shared/Screen";
import { ChevronLeftIcon } from "@/components/ui/Icon";
import { ResetConfirmForm } from "@/features/auth/components/ResetConfirmForm";
import { ResetRequestForm } from "@/features/auth/components/ResetRequestForm";
import { confirmSub, RESET_COPY } from "@/features/auth/password-reset-copy";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { spacing, createStyles, useColors } from "@/lib/theme";
import { useToastStore } from "@/stores/toast-store";

// Forgot password (specs/forgot-password). Entry: the login form's
// "Quên mật khẩu?", which passes on the identifier typed so far.
//
// Two steps on one screen: who (a code is emailed), then the code and the new
// password. Back from the second step returns to the first, to fix a typo in
// the email; from the first it leaves.
export default function ResetPasswordScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const keyboardHeight = useKeyboardHeight();
  const params = useLocalSearchParams<{ identifier?: string }>();
  const [identifier, setIdentifier] = useState(typeof params.identifier === "string" ? params.identifier : "");
  const [step, setStep] = useState<"request" | "confirm">("request");

  const back = () => {
    if (step === "confirm") return setStep("request");
    if (router.canGoBack()) router.back();
    else router.replace("/login");
  };

  const onSent = (sentTo: string) => {
    setIdentifier(sentTo);
    setStep("confirm");
  };

  const onDone = () => {
    useToastStore.getState().show(RESET_COPY.done, "success");
    router.replace("/(app)/(tabs)");
  };

  return (
    <Screen>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + keyboardHeight }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            onPress={back}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel={RESET_COPY.back}
            testID="btn-reset-back"
          >
            <ChevronLeftIcon size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        <Text style={styles.title} accessibilityRole="header">{RESET_COPY.title}</Text>
        <Text style={styles.sub}>{step === "request" ? RESET_COPY.requestSub : confirmSub(identifier)}</Text>
        <View style={styles.form}>
          {step === "request" ? (
            <ResetRequestForm initialIdentifier={identifier} onSent={onSent} />
          ) : (
            <ResetConfirmForm identifier={identifier} onDone={onDone} />
          )}
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
  sub: { marginTop: spacing.sm, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  form: { marginTop: 32 },
}));
