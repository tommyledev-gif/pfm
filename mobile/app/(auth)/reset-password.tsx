import { useEffect, useState } from "react";
import { BackHandler, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Screen } from "@/components/shared/Screen";
import { ChevronLeftIcon } from "@/components/ui/Icon";
import { ResetCodeForm } from "@/features/auth/components/ResetCodeForm";
import { ResetConfirmForm } from "@/features/auth/components/ResetConfirmForm";
import { ResetRequestForm } from "@/features/auth/components/ResetRequestForm";
import { confirmSub, RESET_COPY } from "@/features/auth/password-reset-copy";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { spacing, createStyles, useColors } from "@/lib/theme";
import { useToastStore } from "@/stores/toast-store";

type Step = "request" | "code" | "password";

// Forgot password (specs/forgot-password). Entry: the login form's
// "Quên mật khẩu?", which passes on the identifier typed so far.
//
// Three steps on one screen: who (a code is emailed), the code (checked by
// the server), then the new password. Back, on screen or the phone's, goes
// one step back (the code is kept, so it is one tap to return); from the
// first it leaves.
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const keyboardHeight = useKeyboardHeight();
  const params = useLocalSearchParams<{ identifier?: string }>();
  const [identifier, setIdentifier] = useState(typeof params.identifier === "string" ? params.identifier : "");
  const [step, setStep] = useState<Step>("request");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [sentAt, setSentAt] = useState(0);

  const back = useLatestCallback(() => {
    if (step === "password") return setStep("code");
    if (step === "code") return setStep("request");
    if (router.canGoBack()) router.back();
    else router.replace("/login");
  });

  // Inside the flow only: from the first step the phone's back leaves as usual.
  useEffect(() => {
    if (step === "request") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [step, back]);

  const onSent = (sentTo: string) => {
    setIdentifier(sentTo);
    setSentAt(Date.now());
    setCode("");
    setCodeError(undefined);
    setStep("code");
  };

  const onVerified = (verified: string) => {
    setCode(verified);
    setCodeError(undefined);
    setStep("password");
  };

  const onCodeRejected = (message: string) => {
    setCodeError(message);
    setStep("code");
  };

  const onDone = () => {
    useToastStore.getState().show(t(RESET_COPY.done), "success");
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
            accessibilityLabel={t(RESET_COPY.back)}
            testID="btn-reset-back"
          >
            <ChevronLeftIcon size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        <Text style={styles.title} accessibilityRole="header">{t(RESET_COPY.title)}</Text>
        <Text style={styles.sub}>
          {step === "request" ? t(RESET_COPY.requestSub) : step === "code" ? confirmSub(identifier) : t(RESET_COPY.passwordSub)}
        </Text>
        <View style={styles.form}>
          {step === "request" ? (
            <ResetRequestForm initialIdentifier={identifier} onSent={onSent} />
          ) : step === "code" ? (
            <ResetCodeForm
              identifier={identifier}
              initialCode={code}
              initialError={codeError}
              sentAt={sentAt}
              onResent={setSentAt}
              onVerified={onVerified}
            />
          ) : (
            <ResetConfirmForm identifier={identifier} code={code} onCodeRejected={onCodeRejected} onDone={onDone} />
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
