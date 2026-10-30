import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { errorText, isNetworkError } from "@/lib/api-envelope";
import { copyOf, i18n } from "@/lib/i18n";
import { withAlpha } from "@/lib/color";
import { useRequireOnline } from "@/lib/connectivity";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { useToastStore } from "@/stores/toast-store";
import { isRequestNoLongerWaiting, REQUEST_NOT_WAITING } from "@/features/users/access-request-errors";
import { useRejectAccessRequestMutation } from "@/features/users/api/use-reject-access-request-mutation";

interface RejectRequestButtonProps {
  userId: string;
  email: string;
}

const COPY = copyOf({
  LABEL: "users.reject.button",
  CONFIRM_TITLE: "users.reject.title",
  KEEP_LABEL: "common.action.keep",
  SUCCESS: "users.reject.toast",
});

// The server sends the requester nothing, so the admin is told; and the
// request is removed rather than blocked, so asking again stays open.
const confirmMessage = (email: string) => i18n.t("users.reject.body", { email });

// Rejects an access request (status "requested"), next to ApproveRequestButton.
// The request is removed: its row leaves Thành viên and the notification
// about it loses both buttons.
export function RejectRequestButton({ userId, email }: RejectRequestButtonProps) {
  useTranslation(); // COPY reads the current language: re-render on a switch
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const showToast = useToastStore((s) => s.show);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const reject = useRejectAccessRequestMutation();

  const confirm = () => {
    setConfirmOpen(false);
    if (reject.isPending) return;
    requireOnline(() =>
      reject.mutate(userId, {
        onSuccess: () => showToast(COPY.SUCCESS, "info"),
        onError: (error) => {
          if (isRequestNoLongerWaiting(error)) return showToast(i18n.t(REQUEST_NOT_WAITING), "info");
          // The server's own message is shown only for "no connection".
          showToast(isNetworkError(error) ? errorText(error) : i18n.t("users.reject.failed"), "error");
        },
      }),
    );
  };

  return (
    <>
      <Pressable
        style={[styles.button, reject.isPending && styles.buttonBusy]}
        onPress={() => setConfirmOpen(true)}
        disabled={reject.isPending}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={i18n.t("users.reject.a11y", { email })}
        accessibilityState={{ disabled: reject.isPending, busy: reject.isPending }}
        testID={`btn-reject-request-${userId}`}
      >
        {reject.isPending ? <ActivityIndicator size="small" color={colors.peach} /> : null}
        <Text style={styles.label}>{COPY.LABEL}</Text>
      </Pressable>
      <ConfirmDialog
        visible={confirmOpen}
        title={COPY.CONFIRM_TITLE}
        message={confirmMessage(email)}
        confirmLabel={COPY.LABEL}
        cancelLabel={COPY.KEEP_LABEL}
        onConfirm={confirm}
        onCancel={() => setConfirmOpen(false)}
        testID="dialog-reject-request"
      />
    </>
  );
}

const useStyles = createStyles((colors) => ({
  // Same footprint as ApproveRequestButton's pill; the 1px border is taken
  // out of the vertical padding so the two sit at one height.
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: withAlpha(colors.peach, 0.5),
  },
  buttonBusy: { opacity: 0.7 },
  label: { ...typography.tiny, fontWeight: "700", color: colors.peach },
}));
