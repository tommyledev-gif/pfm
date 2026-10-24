import { useRef } from "react";
import { Linking, Pressable, View } from "react-native";

import { ActionPopover } from "@/components/shared/ActionPopover";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CameraIcon, ImageIcon } from "@/components/ui/Icon";
import { ImagePreviewModal } from "@/features/ai-chat/components/ImagePreviewModal";
import { useImageAttach } from "@/features/ai-chat/hooks/use-image-attach";
import { useIsOnline } from "@/lib/connectivity";
import { createStyles, radii, useColors } from "@/lib/theme";
import { useImageReadingSessionStore } from "@/stores/image-reading-session-store";
import { useToastStore } from "@/stores/toast-store";

// Copy: spec BR-18, BR-21, the S-AIIMG-24 permission case — per pfm-ux-copy
// (toasts are short phrases without a final period).
const READING_OFF = "Đọc ảnh đang tạm dừng";
const NEEDS_CONNECTION = "Đọc ảnh cần kết nối mạng";
const PRIVACY_TITLE = "Ảnh được gửi đi để đọc";
const PRIVACY_BODY = "Dịch vụ AI bên ngoài đọc ảnh rồi xóa ngay. Ảnh chỉ còn trên điện thoại này.";
const DENIED_COPY = {
  camera: { title: "Cần quyền camera", message: "Cho phép camera trong Cài đặt để chụp hóa đơn." },
  library: { title: "Cần quyền truy cập ảnh", message: "Cho phép truy cập ảnh trong Cài đặt để chọn hóa đơn." },
} as const;
const ICON_SIZE = 20;

interface ImageAttachButtonProps {
  /** A reply is pending: nothing new can be sent (AC-01). */
  disabled: boolean;
  onSend: (uri: string, caption: string) => void;
}

/**
 * The recording composer's attach button and everything it opens: privacy
 * notice, camera / library choice, permission help and the preview
 * (specs/ai-chat-image-capture US-01). Offline or switched off, it stays
 * tappable only to say why (AC-01, BR-18).
 */
export function ImageAttachButton({ disabled, onSend }: ImageAttachButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const readingOff = useImageReadingSessionStore((s) => s.off);
  const online = useIsOnline();
  const buttonRef = useRef<View>(null);
  const attach = useImageAttach();
  const unavailable = readingOff || !online;

  const handlePress = () => {
    if (readingOff || !online) {
      useToastStore.getState().show(readingOff ? READING_OFF : NEEDS_CONNECTION, "info");
      return;
    }
    buttonRef.current?.measureInWindow((x, y, width, height) => void attach.open({ x, y, width, height }));
  };

  const handleSend = (caption: string) => {
    if (attach.pickedUri) onSend(attach.pickedUri, caption);
    attach.clearPicked();
  };

  const denied = attach.deniedSource ? DENIED_COPY[attach.deniedSource] : null;

  return (
    <>
      <Pressable
        ref={buttonRef}
        testID="btn-attach-image"
        accessibilityRole="button"
        accessibilityLabel="Đọc giao dịch từ ảnh"
        accessibilityState={{ disabled: disabled || unavailable }}
        disabled={disabled}
        onPress={handlePress}
        style={styles.button}
      >
        <CameraIcon size={ICON_SIZE} color={disabled || unavailable ? colors.textMuted : colors.textSecondary} />
      </Pressable>

      <ActionPopover
        visible={attach.menuAnchor !== null}
        anchor={attach.menuAnchor}
        align="left"
        onClose={attach.closeMenu}
        actions={[
          { Icon: CameraIcon, label: "Chụp ảnh", onPress: () => void attach.choose("camera"), testID: "btn-image-source-camera" },
          { Icon: ImageIcon, label: "Chọn ảnh có sẵn", onPress: () => void attach.choose("library"), testID: "btn-image-source-library" },
        ]}
      />

      <ConfirmDialog
        visible={attach.noticeOpen}
        title={PRIVACY_TITLE}
        message={PRIVACY_BODY}
        confirmLabel="Tiếp tục"
        cancelLabel="Để sau"
        onConfirm={() => void attach.acceptNotice()}
        onCancel={attach.declineNotice}
        // Nothing is removed here: the app's own primary action, not red.
        tone="default"
        testID="dialog-image-privacy"
      />

      <ConfirmDialog
        visible={denied !== null}
        title={denied?.title ?? ""}
        message={denied?.message ?? ""}
        confirmLabel="Mở Cài đặt"
        cancelLabel="Để sau"
        onConfirm={() => {
          attach.closeDenied();
          void Linking.openSettings();
        }}
        onCancel={attach.closeDenied}
        tone="default"
        testID="dialog-image-permission"
      />

      <ImagePreviewModal uri={attach.pickedUri} onSend={handleSend} onCancel={attach.clearPicked} />
    </>
  );
}

const useStyles = createStyles(() => ({
  // Same footprint as the clear and send buttons, so the field never shifts.
  button: { width: 36, height: 40, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
}));
