import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { errorText } from "@/lib/api-envelope";
import { i18n } from "@/lib/i18n";
import { withAlpha } from "@/lib/color";
import { useRequireOnline } from "@/lib/connectivity";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { useToastStore } from "@/stores/toast-store";
import { useResendInviteMutation } from "@/features/users/api/use-resend-invite-mutation";

const TICK_MS = 1000;

function formatWait(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Re-sends a pending member's activation email. Disabled with a live
// countdown until the server's invite_resend_available_at — 1 minute after
// the invite, then 30 minutes after each resend — so the button never offers
// a tap the backend is going to refuse.
export function ResendInviteButton({ userId, availableAt }: { userId: string; availableAt: string }) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const resend = useResendInviteMutation();
  const showToast = useToastStore((s) => s.show);
  const availableAtMs = new Date(availableAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  const waitMs = availableAtMs - now;
  const waiting = waitMs > 0;

  // Ticks only while there is something to count down.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [waiting]);

  const onPress = () => {
    resend.mutate(userId, {
      onSuccess: () => showToast(i18n.t("users.resend.toast"), "info"),
      onError: (error) => showToast(errorText(error, "users.resend.failed"), "error"),
    });
  };

  const disabled = waiting || resend.isPending;
  return (
    <Pressable
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={() => requireOnline(onPress)}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: resend.isPending }}
      testID={`btn-resend-invite-${userId}`}
    >
      {resend.isPending ? <ActivityIndicator size="small" color={colors.green} /> : null}
      <Text style={[styles.label, disabled && styles.labelDisabled]}>
        {waiting ? t("users.resend.wait", { time: formatWait(waitMs) }) : t("users.resend.button")}
      </Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  button: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: withAlpha(colors.green, 0.4),
    backgroundColor: withAlpha(colors.green, 0.08),
  },
  buttonDisabled: { borderColor: colors.surfaceBorder, backgroundColor: "transparent" },
  label: { ...typography.tiny, fontWeight: "700", color: colors.green },
  labelDisabled: { color: colors.textMuted },
}));
