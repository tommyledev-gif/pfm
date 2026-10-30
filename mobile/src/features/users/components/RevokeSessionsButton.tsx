import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { isAxiosError } from "axios";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { errorText, isNetworkError } from "@/lib/api-envelope";
import { copyOf, i18n } from "@/lib/i18n";
import { useRequireOnline } from "@/lib/connectivity";
import { HTTP_STATUS } from "@/lib/constants";
import { createStyles, spacing, typography, useColors } from "@/lib/theme";
import { useToastStore } from "@/stores/toast-store";
import { useRevokeUserSessionsMutation } from "@/features/users/api/use-revoke-user-sessions-mutation";

interface RevokeSessionsButtonProps {
  userId: string;
  email: string;
}

// Spec US-09 / S-ASW-69 / S-ASW-71 copy.
const COPY = copyOf({
  LABEL: "users.revokeSessions.button",
  CONFIRM_TITLE: "users.revokeSessions.title",
  CONFIRM_LABEL: "common.action.signOut",
  NOT_FOUND: "users.revokeSessions.notFound",
  OFFLINE: "users.revokeSessions.offline",
});

const confirmMessage = (email: string) => i18n.t("users.revokeSessions.body", { email });
const successMessage = (email: string) => i18n.t("users.revokeSessions.toast", { email });

/** Admin's per-member "sign out everywhere" (spec US-09). */
export function RevokeSessionsButton({ userId, email }: RevokeSessionsButtonProps) {
  useTranslation(); // COPY reads the current language: re-render on a switch
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const showToast = useToastStore((s) => s.show);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const revoke = useRevokeUserSessionsMutation();

  const confirm = () => {
    setConfirmOpen(false);
    if (revoke.isPending) return;
    requireOnline(() =>
      revoke.mutate(userId, {
        onSuccess: () => showToast(successMessage(email), "info"),
        onError: (error) => {
          if (isNetworkError(error)) return showToast(COPY.OFFLINE, "warning");
          const notFound = isAxiosError(error) && error.response?.status === HTTP_STATUS.notFound;
          showToast(notFound ? COPY.NOT_FOUND : errorText(error, "users.revokeSessions.failed"), "error");
        },
      }),
    );
  };

  return (
    <>
      <Pressable
        style={styles.button}
        onPress={() => setConfirmOpen(true)}
        disabled={revoke.isPending}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ busy: revoke.isPending }}
        testID={`btn-user-revoke-sessions-${userId}`}
      >
        {revoke.isPending ? <ActivityIndicator size="small" color={colors.peach} /> : null}
        <Text style={styles.label}>{COPY.LABEL}</Text>
      </Pressable>
      <ConfirmDialog
        visible={confirmOpen}
        title={COPY.CONFIRM_TITLE}
        message={confirmMessage(email)}
        confirmLabel={COPY.CONFIRM_LABEL}
        onConfirm={confirm}
        onCancel={() => setConfirmOpen(false)}
        testID="dialog-user-revoke-sessions"
      />
    </>
  );
}

const useStyles = createStyles((colors) => ({
  button: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  label: { ...typography.tiny, fontWeight: "700", color: colors.peach },
}));
