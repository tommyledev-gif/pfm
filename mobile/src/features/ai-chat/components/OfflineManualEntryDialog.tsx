import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface OfflineManualEntryDialogProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shown instead of a "needs a connection" toast when the User sends a
 * message offline: the AI cannot read it, but the manual form can still
 * record it (into the offline queue).
 */
export function OfflineManualEntryDialog({ visible, onConfirm, onCancel }: OfflineManualEntryDialogProps) {
  const { t } = useTranslation();
  return (
    <ConfirmDialog
      visible={visible}
      title={t("chat.offlineEntry.title")}
      message={t("chat.offlineEntry.body")}
      confirmLabel={t("common.action.manualEntry")}
      tone="default"
      onConfirm={onConfirm}
      onCancel={onCancel}
      testID="dialog-chat-offline-manual-entry"
    />
  );
}
