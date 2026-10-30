import { useState } from "react";
import { onlineManager } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ListRow } from "@/components/ui/grouped-list";
import { SignOutGlyph } from "@/components/ui/grouped-list/list-icons";
import { i18n, TranslationKey } from "@/lib/i18n";
import { useColors } from "@/lib/theme";
import { useSessionStore } from "@/stores/session-store";
import { useToastStore } from "@/stores/toast-store";
import { REVOKE_ALL_COPY, useRevokeAllSessionsMutation } from "@/features/security/api/use-revoke-all-sessions-mutation";

/** The group footer under this row on the Security screen. */
export const REVOKE_ALL_FOOTER = "security.revokeAll.footer" satisfies TranslationKey;

/** "Đăng xuất mọi thiết bị" on the Security screen (spec US-08). */
export function RevokeAllSessionsRow() {
  const { t } = useTranslation();
  const colors = useColors();
  const email = useSessionStore((s) => s.email);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const revokeAll = useRevokeAllSessionsMutation();

  const confirm = () => {
    // S-ASW-64: the dialog's own loading state plus this guard = one request.
    if (revokeAll.isPending) return;
    setConfirmOpen(false);
    if (!onlineManager.isOnline()) {
      useToastStore.getState().show(i18n.t(REVOKE_ALL_COPY.offline), "warning");
      return;
    }
    revokeAll.mutate();
  };

  return (
    <>
      <ListRow
        title={t("security.revokeAll.label")}
        icon={SignOutGlyph}
        tone={colors.peach}
        variant="destructive"
        onPress={() => setConfirmOpen(true)}
        loading={revokeAll.isPending}
        testID="btn-revoke-all-sessions"
      />
      <ConfirmDialog
        visible={confirmOpen}
        title={t("security.revokeAll.confirmTitle")}
        message={t("security.revokeAll.confirmMessage", { email: email ?? "" })}
        confirmLabel={t("common.action.signOut")}
        onConfirm={confirm}
        onCancel={() => setConfirmOpen(false)}
        loading={revokeAll.isPending}
        testID="dialog-revoke-all-sessions"
      />
    </>
  );
}
