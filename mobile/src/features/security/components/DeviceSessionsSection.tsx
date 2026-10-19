import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PillButton } from "@/components/ui/PillButton";
import { LockIcon } from "@/components/ui/Icon";
import { HTTP_STATUS } from "@/lib/constants";
import { formatDateDMY } from "@/lib/format-date";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { useToastStore } from "@/stores/toast-store";
import { useDeviceSessionsQuery, useSignOutDeviceMutation } from "@/features/security/api/use-device-sessions-query";
import { DeviceSession } from "@/features/security/types";

const COPY = {
  title: "Thiết bị đang đăng nhập",
  unnamed: "Thiết bị không rõ tên",
  current: "Thiết bị này",
  signOut: "Đăng xuất",
  confirmLabel: "Đăng xuất thiết bị",
  keep: "Giữ lại",
  loadFailed: "Chưa tải được danh sách thiết bị.",
  retry: "Thử lại",
  offline: "Cần kết nối mạng để đăng xuất thiết bị.",
  failed: "Chưa đăng xuất được thiết bị. Thử lại sau.",
} as const;

const nameOf = (s: DeviceSession) => s.device_name ?? COPY.unnamed;
const confirmTitle = (name: string) => `Đăng xuất ${name}?`;
const confirmMessage = (name: string) => `${name} cần đăng nhập lại để vào tài khoản này.`;
const signedOutToast = (name: string) => `Đã đăng xuất ${name}`;
const activeLine = (s: DeviceSession) => (s.is_current ? COPY.current : `Hoạt động ${formatDateDMY(s.last_used_at)}`);

/**
 * "Thiết bị đang đăng nhập" on the Security screen (specs/mobile-account-switch
 * US-10): every device this account is signed in on — or saved on for
 * switching — and a way to sign one out, e.g. a lost phone. This device is
 * listed but has no action; it leaves through "Đăng xuất" in Settings.
 */
export function DeviceSessionsSection() {
  const colors = useColors();
  const styles = useStyles();
  const sessions = useDeviceSessionsQuery();
  const signOut = useSignOutDeviceMutation();
  const [confirming, setConfirming] = useState<DeviceSession | null>(null);
  const toast = useToastStore.getState().show;

  const confirm = () => {
    const target = confirming;
    setConfirming(null);
    if (!target || signOut.isPending) return;
    if (!onlineManager.isOnline()) {
      toast(COPY.offline, "warning");
      return;
    }
    signOut.mutate(target.id, {
      onSuccess: () => toast(signedOutToast(nameOf(target)), "info"),
      onError: (error) => {
        // Already gone (ended meanwhile): the refreshed list says so.
        if (isAxiosError(error) && error.response?.status === HTTP_STATUS.notFound) return;
        toast(COPY.failed, "warning");
      },
    });
  };

  return (
    <View style={styles.card} testID="section-device-sessions">
      <View style={styles.header}>
        <LockIcon size={20} color={colors.green} />
        <Text style={styles.title}>{COPY.title}</Text>
      </View>

      {sessions.isLoading ? (
        <ActivityIndicator color={colors.green} />
      ) : sessions.isError ? (
        <View style={styles.failed}>
          <Text style={styles.note}>{COPY.loadFailed}</Text>
          <PillButton label={COPY.retry} variant="outline" onPress={() => sessions.refetch()} testID="btn-device-sessions-retry" />
        </View>
      ) : (
        (sessions.data ?? []).map((s, index) => (
          <View key={s.id} style={[styles.row, index > 0 && styles.divider]} testID="row-device-session">
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>
                {nameOf(s)}
              </Text>
              <Text style={styles.note}>{activeLine(s)}</Text>
            </View>
            {s.is_current ? null : (
              <Pressable
                onPress={() => setConfirming(s)}
                disabled={signOut.isPending}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`${COPY.signOut} ${nameOf(s)}`}
                testID="btn-device-sign-out"
              >
                {signOut.isPending && signOut.variables === s.id ? (
                  <ActivityIndicator size="small" color={colors.peach} />
                ) : (
                  <Text style={styles.action}>{COPY.signOut}</Text>
                )}
              </Pressable>
            )}
          </View>
        ))
      )}

      <ConfirmDialog
        visible={confirming !== null}
        title={confirmTitle(confirming ? nameOf(confirming) : "")}
        message={confirmMessage(confirming ? nameOf(confirming) : "")}
        confirmLabel={COPY.confirmLabel}
        cancelLabel={COPY.keep}
        onConfirm={confirm}
        onCancel={() => setConfirming(null)}
        testID="dialog-device-sign-out"
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
  },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  title: { flex: 1, ...typography.body, color: colors.textPrimary },
  failed: { gap: spacing.sm, alignItems: "flex-start" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  text: { flex: 1, gap: spacing.xs },
  name: { ...typography.body, color: colors.textPrimary },
  note: { ...typography.caption, color: colors.textSecondary },
  action: { ...typography.label, color: colors.peach },
}));
