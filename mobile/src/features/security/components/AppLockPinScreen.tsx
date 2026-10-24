import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { entrance, exit } from "@/components/motion/motion-tokens";
import { Avatar } from "@/components/ui/Avatar";
import { createStyles, spacing, typography } from "@/lib/theme";
import { useProfileIdentity } from "@/features/profile/use-profile-identity";
import { useAppLockStore } from "@/features/security/app-lock";
import { confirmOwner, phoneCheckLabel } from "@/features/security/identity-check";
import { PinAltActions } from "@/features/security/components/PinAltActions";
import { PinPad } from "@/features/security/components/PinPad";
import { PIN_COPY, wrongPin } from "@/features/security/pin/pin-copy";
import { submitPin } from "@/features/security/pin/pin-entry";
import { usePinStore } from "@/features/security/pin/pin-store";
import { signOutEveryAccount } from "@/features/security/pin/sign-out-device";

const UNLOCK_PROMPT = "Mở khóa ứng dụng";
const AVATAR_SIZE = 64;

/**
 * The app lock with an app PIN set (specs/mobile-app-pin US-02): whose app it
 * is, six dots and a keypad. When the phone has its own lock, that prompt
 * opens once on its own, as without a PIN, and stays a button after.
 *
 * A 5th wrong PIN or a confirmed "Quên mã PIN?" signs every account out,
 * which takes this screen away with the session (app-lock.ts). An unreadable
 * PIN record turns the PIN off, and the overlay falls back to the phone's
 * check (EC-4).
 */
export function AppLockPinScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { name, avatarUrl } = useProfileIdentity();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [phoneLabel, setPhoneLabel] = useState<string | null>(null);
  const checking = useRef(false);

  const runPhoneCheck = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const result = await confirmOwner(UNLOCK_PROMPT);
      if (result === "passed") {
        await usePinStore.getState().resetWrongCount();
        useAppLockStore.getState().unlock();
      } else if (result === "failed") setMessage(PIN_COPY.biometricFailed);
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    let live = true;
    void phoneCheckLabel().then((label) => {
      if (!live) return;
      setPhoneLabel(label);
      if (label) void runPhoneCheck();
    });
    return () => {
      live = false;
    };
  }, [runPhoneCheck]);

  const onComplete = async (pin: string) => {
    setBusy(true);
    const outcome = await submitPin(pin);
    if (outcome.kind === "right") return useAppLockStore.getState().unlock();
    // "wiped" and "missing" take this screen away on their own.
    if (outcome.kind === "wiped" || outcome.kind === "missing") return;
    setBusy(false);
    setMessage(outcome.kind === "wrong" ? wrongPin(outcome.triesLeft) : PIN_COPY.checkFailed);
    setShakeKey((k) => k + 1);
    setValue("");
  };

  const forgot = async () => {
    setBusy(true);
    await signOutEveryAccount("forgot-pin");
  };

  return (
    <Animated.View
      style={[styles.cover, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}
      exiting={exit("fade")}
      testID="overlay-app-lock"
    >
      <Animated.View entering={entrance("fadeDown")} style={styles.identity}>
        <Avatar name={name} iconUrl={avatarUrl} size={AVATAR_SIZE} fallback="initial" />
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="middle">
          {name}
        </Text>
        <Text style={styles.title} accessibilityRole="header">
          {PIN_COPY.enter}
        </Text>
      </Animated.View>
      <Animated.View entering={entrance("fadeUp", 120)} style={styles.pad}>
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
      </Animated.View>
      <PinAltActions
        phoneCheckLabel={phoneLabel}
        onPhoneCheck={() => void runPhoneCheck()}
        onForgotConfirmed={() => void forgot()}
        busy={busy}
      />
    </Animated.View>
  );
}

const useStyles = createStyles((colors) => ({
  cover: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.bgApp,
  },
  identity: { alignItems: "center", gap: spacing.sm, maxWidth: "100%" },
  name: { ...typography.cardTitle, color: colors.textPrimary },
  title: { ...typography.body, fontWeight: "500", color: colors.textSecondary },
  pad: { flex: 1, alignSelf: "stretch", justifyContent: "center" },
}));
