import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

const TITLE = "Không có kết nối mạng";
const MESSAGE =
  "Trợ lý cần mạng để đọc tin nhắn. Nhập thủ công thì giao dịch lưu trên máy và tự đồng bộ khi có mạng.";
const CONFIRM_LABEL = "Nhập thủ công";

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
  return (
    <ConfirmDialog
      visible={visible}
      title={TITLE}
      message={MESSAGE}
      confirmLabel={CONFIRM_LABEL}
      tone="default"
      onConfirm={onConfirm}
      onCancel={onCancel}
      testID="dialog-chat-offline-manual-entry"
    />
  );
}
