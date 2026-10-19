import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { LockIcon } from "@/components/ui/Icon";
import { createStyles, spacing, typography, useColors } from "@/lib/theme";
import { useAppLockStore } from "@/features/security/app-lock";
import { confirmOwner } from "@/features/security/identity-check";

const COPY = {
  title: "Ứng dụng đang khóa",
  unlock: "Mở khóa",
  prompt: "Mở khóa ứng dụng",
} as const;

/**
 * Covers the signed-in area while the app lock is on (US-12). Asks for the
 * owner check as soon as it shows; cancelled or failed keeps it up with a
 * button to try again. A phone whose screen lock was removed since the lock
 * was turned on lets the User through — there is nothing left to check
 * against.
 */
export function AppLockOverlay() {
  const colors = useColors();
  const styles = useStyles();
  const locked = useAppLockStore((s) => s.locked);
  const checking = useRef(false);

  const tryUnlock = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const result = await confirmOwner(COPY.prompt);
      if (result === "passed" || result === "unavailable") useAppLockStore.getState().unlock();
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    if (locked) void tryUnlock();
  }, [locked, tryUnlock]);

  if (!locked) return null;
  return (
    <View style={styles.cover} testID="overlay-app-lock">
      <LockIcon size={40} color={colors.green} />
      <Text style={styles.title}>{COPY.title}</Text>
      <PillButton label={COPY.unlock} onPress={tryUnlock} testID="btn-app-unlock" />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  cover: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.bgApp,
  },
  title: { ...typography.title, color: colors.textPrimary },
}));
