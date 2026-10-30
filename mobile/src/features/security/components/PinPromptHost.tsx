import { useEffect, useRef, useState } from "react";
import { AppState, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { CloseIcon } from "@/components/ui/Icon";
import { PIN_LENGTH } from "@/lib/constants";
import { createStyles, spacing, typography, useColors } from "@/lib/theme";
import { confirmOwner, phoneCheckLabel } from "@/features/security/identity-check";
import { PinAltActions } from "@/features/security/components/PinAltActions";
import { PinPad } from "@/features/security/components/PinPad";
import { PIN_COPY, wrongPin } from "@/features/security/pin/pin-copy";
import { nextFrame, submitPin } from "@/features/security/pin/pin-entry";
import { PinPromptRequest, PinPromptResult, usePinPromptStore } from "@/features/security/pin/pin-prompt-store";
import { usePinStore } from "@/features/security/pin/pin-store";
import { signOutEveryAccount } from "@/features/security/pin/sign-out-device";

type Stage = "verify" | "current" | "new" | "repeat";

const FIRST_STAGE: Record<PinPromptRequest["kind"], Stage> = { verify: "verify", change: "current", create: "new" };

/**
 * Draws the open requestPin() (pin-prompt-store), above every screen and the
 * app lock. Mounted once in the root layout. Each request gets a fresh
 * prompt, so nothing typed for one carries into the next.
 */
export function PinPromptHost() {
  const request = usePinPromptStore((s) => s.request);
  if (!request) return null;
  return <PinPrompt key={request.id} request={request} />;
}

function PinPrompt({ request }: { request: PinPromptRequest }) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<Stage>(FIRST_STAGE[request.kind]);
  const [value, setValue] = useState("");
  const [firstEntry, setFirstEntry] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [phoneLabel, setPhoneLabel] = useState<string | null>(null);
  // The phone's own prompt sends the app to the background on some phones;
  // that is not the User leaving.
  const phoneCheckRunning = useRef(false);
  const verifying = stage === "verify" || stage === "current";

  const settle = (result: PinPromptResult) => usePinPromptStore.getState().settle(request.id, result);

  useEffect(() => {
    if (!request.biometricPrompt) return;
    let live = true;
    void phoneCheckLabel().then((label) => live && setPhoneLabel(label));
    return () => {
      live = false;
    };
  }, [request.biometricPrompt]);

  // EC-3: leaving the app with the prompt up cancels it.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "background" && !phoneCheckRunning.current) {
        usePinPromptStore.getState().settle(request.id, "cancelled");
      }
    });
    return () => subscription.remove();
  }, [request.id]);

  const showProblem = (text: string) => {
    setMessage(text);
    setShakeKey((k) => k + 1);
    setValue("");
  };
  const goTo = (next: Stage) => {
    setStage(next);
    setValue("");
    setMessage(null);
  };

  const onComplete = async (pin: string) => {
    if (verifying) {
      setBusy(true);
      const outcome = await submitPin(pin);
      setBusy(false);
      if (outcome.kind === "right") return stage === "verify" ? settle("passed") : goTo("new");
      if (outcome.kind === "wrong") return showProblem(wrongPin(outcome.triesLeft));
      if (outcome.kind === "wiped") return settle("wiped");
      if (outcome.kind === "missing") return settle("no-pin");
      return showProblem(t(PIN_COPY.checkFailed));
    }
    if (stage === "new") {
      setFirstEntry(pin);
      return goTo("repeat");
    }
    if (pin !== firstEntry) {
      setStage("new");
      return showProblem(t(PIN_COPY.mismatch));
    }
    setBusy(true);
    try {
      await nextFrame();
      await usePinStore.getState().setPin(pin);
      settle("passed");
    } catch {
      setBusy(false);
      setStage("new");
      showProblem(t(PIN_COPY.saveFailed));
    }
  };

  const runPhoneCheck = async () => {
    if (!request.biometricPrompt) return;
    phoneCheckRunning.current = true;
    const result = await confirmOwner(request.biometricPrompt);
    phoneCheckRunning.current = false;
    if (result === "passed") {
      await usePinStore.getState().resetWrongCount();
      settle("passed");
    } else if (result === "failed") setMessage(t(PIN_COPY.biometricFailed));
  };

  const forgot = async () => {
    setBusy(true);
    await signOutEveryAccount("forgot-pin");
    settle("wiped");
  };

  const title = {
    verify: request.title ?? t(PIN_COPY.enter),
    current: t(PIN_COPY.current),
    new: t(PIN_COPY.create, { length: PIN_LENGTH }),
    repeat: t(PIN_COPY.repeat),
  }[stage];

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={() => !busy && settle("cancelled")}>
      <View
        style={[styles.screen, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg }]}
        testID="modal-pin-prompt"
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => settle("cancelled")}
            disabled={busy}
            hitSlop={8}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel={t(PIN_COPY.close)}
            testID="btn-pin-close"
          >
            <CloseIcon size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.body}>
          <PinPad
            value={value}
            onChange={(next) => {
              setValue(next);
              if (next) setMessage(null);
            }}
            onComplete={(pin) => void onComplete(pin)}
            disabled={busy}
            shakeKey={shakeKey}
            message={message}
          />
        </View>
        <PinAltActions
          phoneCheckLabel={verifying && stage === "verify" ? phoneLabel : null}
          onPhoneCheck={() => void runPhoneCheck()}
          onForgotConfirmed={verifying ? () => void forgot() : undefined}
          busy={busy}
        />
      </View>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp, paddingHorizontal: spacing.xl },
  header: { minHeight: 44, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
  title: { ...typography.title, color: colors.textPrimary, textAlign: "center", marginTop: spacing.xl },
  body: { flex: 1, justifyContent: "center" },
}));
