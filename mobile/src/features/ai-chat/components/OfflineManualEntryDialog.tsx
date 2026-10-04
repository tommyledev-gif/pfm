import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

const TITLE = "Đang ngoại tuyến";
const MESSAGE =
  "Trợ lý cần kết nối mạng để đọc tin nhắn. Bạn có thể nhập giao dịch này thủ công — nội dung vừa gõ sẽ được điền sẵn, giao dịch được lưu trên máy và tự đồng bộ khi có mạng.";
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
