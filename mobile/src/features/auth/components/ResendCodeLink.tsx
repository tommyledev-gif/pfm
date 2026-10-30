import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { PASSWORD_RESET_RESEND_SECONDS } from "@/lib/constants";
import { createStyles, typography } from "@/lib/theme";
import { useRequestPasswordResetMutation } from "@/features/auth/api/use-request-password-reset-mutation";
import { requestErrorMessage, resendIn, RESET_COPY } from "@/features/auth/password-reset-copy";

const TICK_MS = 1000;

interface ResendCodeLinkProps {
  identifier: string;
  /** A failed resend's sentence, or null to clear it. */
  onError: (message: string | null) => void;
}

// "Gửi lại mã", held for the server's per-account cooldown after each send
// (the screen mounts this right after the first one), so it never offers a
// tap the server would quietly ignore.
export function ResendCodeLink({ identifier, onError }: ResendCodeLinkProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const request = useRequestPasswordResetMutation();
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(sentAt);
  const left = Math.max(0, Math.ceil((sentAt + PASSWORD_RESET_RESEND_SECONDS * 1000 - now) / 1000));
  const waiting = left > 0;

  // Ticks only while there is something to count down.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [waiting]);

  const resend = () => {
    onError(null);
    request.mutate(
      { identifier },
      {
        onSuccess: () => {
          const at = Date.now();
          setSentAt(at);
          setNow(at);
        },
        onError: (error) => onError(requestErrorMessage(error)),
      },
    );
  };

  const disabled = waiting || request.isPending;
  return (
    <Pressable
      onPress={resend}
      disabled={disabled}
      hitSlop={8}
      style={styles.row}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: request.isPending }}
      testID="btn-reset-resend"
    >
      <Text style={[styles.link, disabled && styles.waiting]}>{waiting ? resendIn(left) : t(RESET_COPY.resend)}</Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  row: { alignSelf: "center", paddingVertical: 4 },
  link: { ...typography.label, fontWeight: "600", color: colors.green },
  waiting: { fontWeight: "500", color: colors.textMuted },
}));
