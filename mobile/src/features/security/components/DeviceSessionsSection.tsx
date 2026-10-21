import { useState } from "react";
import { ActivityIndicator } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ListCell, ListInlineButton, ListRow, ListSection } from "@/components/ui/grouped-list";
import { DeviceGlyph } from "@/components/ui/grouped-list/list-icons";
import { HTTP_STATUS } from "@/lib/constants";
import { formatDateDMY } from "@/lib/format-date";
import { useColors } from "@/lib/theme";
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
 * One row per device in one group; "Đăng xuất" is a text action at the end
 * of the row rather than a button of its own.
 */
export function DeviceSessionsSection() {
  const colors = useColors();
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
    <>
      <ListSection header={COPY.title} testID="section-device-sessions">
        {sessions.isLoading ? (
          <ListCell>
            <ActivityIndicator color={colors.green} />
          </ListCell>
        ) : sessions.isError ? (
          <ListRow
            title={COPY.loadFailed}
            trailing={
              <ListInlineButton label={COPY.retry} onPress={() => sessions.refetch()} testID="btn-device-sessions-retry" />
            }
          />
        ) : (
          (sessions.data ?? []).map((s) => (
            <ListRow
              key={s.id}
              title={nameOf(s)}
              titleLines={1}
              subtitle={activeLine(s)}
              icon={DeviceGlyph}
              // This phone stands out from the others at a glance.
              tone={s.is_current ? colors.green : undefined}
              trailing={
                s.is_current ? null : (
                  <ListInlineButton
                    label={COPY.signOut}
                    tone="destructive"
                    onPress={() => setConfirming(s)}
                    disabled={signOut.isPending}
                    loading={signOut.isPending && signOut.variables === s.id}
                    accessibilityLabel={`${COPY.signOut} ${nameOf(s)}`}
                    testID="btn-device-sign-out"
                  />
                )
              }
              testID="row-device-session"
            />
          ))
        )}
      </ListSection>

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
    </>
  );
}
