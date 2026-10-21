import { useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { isAxiosError } from "axios";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { getErrorMessage, isNetworkError } from "@/lib/api-envelope";
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
const LABEL = "Đăng xuất mọi thiết bị";
const CONFIRM_TITLE = "Đăng xuất mọi thiết bị?";
const CONFIRM_LABEL = "Đăng xuất";
const NOT_FOUND = "Không tìm thấy người dùng.";
const OFFLINE = "Cần kết nối mạng để đăng xuất mọi thiết bị.";
const FALLBACK_ERROR = "Chưa đăng xuất được mọi thiết bị. Thử lại.";

const confirmMessage = (email: string) =>
  `Đăng xuất ${email} khỏi mọi thiết bị? Người này sẽ phải đăng nhập lại bằng mật khẩu.`;
const successMessage = (email: string) => `Đã đăng xuất ${email} khỏi mọi thiết bị.`;

/** Admin's per-member "sign out everywhere" (spec US-09). */
export function RevokeSessionsButton({ userId, email }: RevokeSessionsButtonProps) {
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
          if (isNetworkError(error)) return showToast(OFFLINE, "warning");
          const notFound = isAxiosError(error) && error.response?.status === HTTP_STATUS.notFound;
          showToast(notFound ? NOT_FOUND : getErrorMessage(error, FALLBACK_ERROR), "error");
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
        <Text style={styles.label}>{LABEL}</Text>
      </Pressable>
      <ConfirmDialog
        visible={confirmOpen}
        title={CONFIRM_TITLE}
        message={confirmMessage(email)}
        confirmLabel={CONFIRM_LABEL}
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
