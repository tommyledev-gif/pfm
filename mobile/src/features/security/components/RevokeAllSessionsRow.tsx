import { useState } from "react";
import { onlineManager } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ListRow } from "@/components/ui/grouped-list";
import { SignOutGlyph } from "@/components/ui/grouped-list/list-icons";
import { useColors } from "@/lib/theme";
import { useSessionStore } from "@/stores/session-store";
import { useToastStore } from "@/stores/toast-store";
import { REVOKE_ALL_COPY, useRevokeAllSessionsMutation } from "@/features/security/api/use-revoke-all-sessions-mutation";

const LABEL = "Đăng xuất mọi thiết bị";
/** The group footer under this row on the Security screen. */
export const REVOKE_ALL_FOOTER = "Mọi thiết bị khác phải đăng nhập lại bằng mật khẩu. Thiết bị này vẫn giữ đăng nhập.";
const CONFIRM_TITLE = "Đăng xuất mọi thiết bị?";
const CONFIRM_LABEL = "Đăng xuất";

const confirmMessage = (email: string) =>
  `Tài khoản ${email} sẽ bị đăng xuất khỏi mọi thiết bị khác, kể cả các máy đã lưu tài khoản để chuyển nhanh.`;

/** "Đăng xuất mọi thiết bị" on the Security screen (spec US-08). */
export function RevokeAllSessionsRow() {
  const colors = useColors();
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
      <ListRow
        title={LABEL}
        icon={SignOutGlyph}
        tone={colors.peach}
        variant="destructive"
        onPress={() => setConfirmOpen(true)}
        loading={revokeAll.isPending}
        testID="btn-revoke-all-sessions"
      />
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
