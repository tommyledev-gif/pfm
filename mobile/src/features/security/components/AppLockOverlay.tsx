import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { entrance, exit } from "@/components/motion/motion-tokens";
import { Avatar } from "@/components/ui/Avatar";
import { PillButton } from "@/components/ui/PillButton";
import { FingerprintIcon, LockIcon } from "@/components/ui/Icon";
import { createStyles, spacing, typography, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { BrandMark } from "@/features/auth/components/BrandMark";
import { useProfileIdentity } from "@/features/profile/use-profile-identity";
import { useAppLockStore } from "@/features/security/app-lock";
import { confirmOwner } from "@/features/security/identity-check";
import { AppLockGlow, AppLockHalo } from "@/features/security/components/AppLockHalo";

const COPY = {
  locked: "Ứng dụng đang khóa",
  unlock: "Mở khóa",
  prompt: "Mở khóa ứng dụng",
  hint: "Dùng vân tay hoặc mã khóa màn hình",
  failed: "Xác thực chưa khớp. Thử lại.",
} as const;

const AVATAR_SIZE = 96;
const HALO_SIZE = 112;
const BADGE_SIZE = 32;
const SHAKE_OFFSET = 10;
const SHAKE_STEP_MS = 50;

type Status = "checking" | "idle" | "failed";

/**
 * Covers the signed-in area while the app lock is on (US-12). Asks for the
 * owner check as soon as it shows; cancelled or failed keeps it up with a
 * button to try again. A phone whose screen lock was removed since the lock
 * was turned on lets the User through — there is nothing left to check
 * against.
 *
 * Whose app it is stays on screen (avatar + name, like the saved-account
 * login), with the halo pulsing while the system prompt is up and the
 * identity block shaking once on a failed check. Fades out on unlock.
 */
export function AppLockOverlay() {
  const locked = useAppLockStore((s) => s.locked);
  if (!locked) return null;
  return <LockScreen />;
}

function LockScreen() {
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { name, avatarUrl } = useProfileIdentity();
  const [status, setStatus] = useState<Status>("checking");
  const checking = useRef(false);
  const shakeX = useSharedValue(0);

  const shake = useCallback(() => {
    if (reduceMotion) return;
    shakeX.value = withSequence(
      withTiming(-SHAKE_OFFSET, { duration: SHAKE_STEP_MS }),
      withTiming(SHAKE_OFFSET, { duration: SHAKE_STEP_MS }),
      withTiming(-SHAKE_OFFSET / 2, { duration: SHAKE_STEP_MS }),
      withTiming(SHAKE_OFFSET / 2, { duration: SHAKE_STEP_MS }),
      withTiming(0, { duration: SHAKE_STEP_MS }),
    );
  }, [reduceMotion, shakeX]);

  const tryUnlock = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    setStatus("checking");
    try {
      const result = await confirmOwner(COPY.prompt);
      if (result === "passed" || result === "unavailable") {
        useAppLockStore.getState().unlock();
        return;
      }
      setStatus(result === "failed" ? "failed" : "idle");
      if (result === "failed") shake();
    } finally {
      checking.current = false;
    }
  }, [shake]);

  useEffect(() => {
    void tryUnlock();
  }, [tryUnlock]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  return (
    <Animated.View
      style={[styles.cover, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl }]}
      exiting={exit("fade")}
      testID="overlay-app-lock"
    >
      <AppLockGlow />

      <Animated.View entering={entrance("fadeDown")} style={styles.brand}>
        <BrandMark />
      </Animated.View>

      <Animated.View style={[styles.identity, shakeStyle]}>
        <Animated.View entering={entrance("zoom", 80)}>
          <AppLockHalo size={HALO_SIZE} active={status === "checking"} reduceMotion={reduceMotion}>
            <View style={styles.avatarRing}>
              <Avatar name={name} iconUrl={avatarUrl} size={AVATAR_SIZE} fallback="initial" />
            </View>
            <View style={styles.badge}>
              <LockIcon size={16} color={colors.onGreen} strokeWidth={2.2} />
            </View>
          </AppLockHalo>
        </Animated.View>
        <Animated.View entering={entrance("fadeUp", 160)} style={styles.texts}>
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="middle">
            {name}
          </Text>
          <Text style={styles.locked}>{COPY.locked}</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View entering={entrance("fadeUp", 240)} style={styles.actions}>
        <PillButton
          label={COPY.unlock}
          icon={<FingerprintIcon size={20} color={colors.onGreen} strokeWidth={2} />}
          onPress={tryUnlock}
          style={styles.button}
          testID="btn-app-unlock"
        />
        <Text
          style={[styles.hint, status === "failed" && styles.hintFailed]}
          accessibilityLiveRegion="polite"
        >
          {status === "failed" ? COPY.failed : COPY.hint}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = createStyles((colors) => ({
  cover: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.bgApp,
  },
  brand: { alignItems: "center" },
  identity: { alignItems: "center", gap: spacing.xl },
  avatarRing: {
    padding: 3,
    borderRadius: AVATAR_SIZE / 2 + 3,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  badge: {
    position: "absolute",
    right: (HALO_SIZE - AVATAR_SIZE) / 2 - 2,
    bottom: (HALO_SIZE - AVATAR_SIZE) / 2 - 2,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    borderWidth: 3,
    borderColor: colors.bgApp,
  },
  texts: { alignItems: "center", gap: spacing.xs, maxWidth: "100%" },
  name: { ...typography.title, color: colors.textPrimary },
  locked: { ...typography.body, fontWeight: "500", color: colors.textSecondary },
  actions: { alignSelf: "stretch", alignItems: "center", gap: spacing.md },
  button: { alignSelf: "stretch" },
  hint: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
  hintFailed: { color: colors.error },
}));
