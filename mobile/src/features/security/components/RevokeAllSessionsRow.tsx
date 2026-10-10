import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { onlineManager } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { useSessionStore } from "@/stores/session-store";
import { useToastStore } from "@/stores/toast-store";
import { REVOKE_ALL_COPY, useRevokeAllSessionsMutation } from "@/features/security/api/use-revoke-all-sessions-mutation";

const LABEL = "Đăng xuất mọi thiết bị";
const HINT = "Mọi thiết bị khác phải đăng nhập lại bằng mật khẩu. Thiết bị này vẫn giữ đăng nhập.";
const CONFIRM_TITLE = "Đăng xuất mọi thiết bị?";
const CONFIRM_LABEL = "Đăng xuất";

const confirmMessage = (email: string) =>
  `Tài khoản ${email} sẽ bị đăng xuất khỏi mọi thiết bị khác, kể cả các máy đã lưu tài khoản để chuyển nhanh.`;

/** "Đăng xuất mọi thiết bị" on the Security screen (spec US-08). */
export function RevokeAllSessionsRow() {
  const colors = useColors();
  const styles = useStyles();
  const email = useSessionStore((s) => s.email);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const revokeAll = useRevokeAllSessionsMutation();

  const confirm = () => {
    // S-ASW-64: the dialog's own loading state plus this guard = one request.
    if (revokeAll.isPending) return;
    setConfirmOpen(false);
    if (!onlineManager.isOnline()) {
      useToastStore.getState().show(REVOKE_ALL_COPY.offline, "warning");
      return;
    }
    revokeAll.mutate();
  };

  return (
    <>
      <Pressable
        style={styles.row}
        onPress={() => setConfirmOpen(true)}
        disabled={revokeAll.isPending}
        accessibilityRole="button"
        accessibilityState={{ busy: revokeAll.isPending }}
        testID="btn-revoke-all-sessions"
      >
        <View style={styles.text}>
          <Text style={styles.label}>{LABEL}</Text>
          <Text style={styles.hint}>{HINT}</Text>
        </View>
        {revokeAll.isPending ? <ActivityIndicator size="small" color={colors.peach} /> : null}
      </Pressable>
      <ConfirmDialog
        visible={confirmOpen}
        title={CONFIRM_TITLE}
        message={confirmMessage(email ?? "")}
        confirmLabel={CONFIRM_LABEL}
        onConfirm={confirm}
        onCancel={() => setConfirmOpen(false)}
        loading={revokeAll.isPending}
        testID="dialog-revoke-all-sessions"
      />
    </>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
  },
  text: { flex: 1, gap: spacing.xs },
  label: { ...typography.body, color: colors.peach },
  hint: { ...typography.caption, color: colors.textSecondary },
}));
