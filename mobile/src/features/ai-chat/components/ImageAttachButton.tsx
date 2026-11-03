import { useRef } from "react";
import { Linking, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

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
// (toasts are short phrases without a final period). Locale keys.
const READING_OFF = "chat.image.readingOff.toast";
const NEEDS_CONNECTION = "chat.image.needsConnection.toast";
const DENIED_COPY = {
  camera: { title: "chat.image.denied.camera.title", message: "chat.image.denied.camera.body" },
  library: { title: "chat.image.denied.library.title", message: "chat.image.denied.library.body" },
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
  const { t } = useTranslation();
  const readingOff = useImageReadingSessionStore((s) => s.off);
  const online = useIsOnline();
  const buttonRef = useRef<View>(null);
  const attach = useImageAttach();
  const unavailable = readingOff || !online;

  const handlePress = () => {
    if (readingOff || !online) {
      useToastStore.getState().show(t(readingOff ? READING_OFF : NEEDS_CONNECTION), "info");
      return;
    }
    // Page coordinates: see PopoverAnchor.
    buttonRef.current?.measure((_x, _y, width, height, pageX, pageY) => void attach.open({ x: pageX, y: pageY, width, height }));
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
        accessibilityLabel={t("chat.image.attach.a11y")}
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
          {
            Icon: CameraIcon,
            label: t("chat.image.source.camera"),
            onPress: () => void attach.choose("camera"),
            testID: "btn-image-source-camera",
          },
          {
            Icon: ImageIcon,
            label: t("chat.image.source.library"),
            onPress: () => void attach.choose("library"),
            testID: "btn-image-source-library",
          },
        ]}
      />

      <ConfirmDialog
        visible={attach.noticeOpen}
        title={t("chat.image.privacy.title")}
        message={t("chat.image.privacy.body")}
        confirmLabel={t("common.action.continue")}
        cancelLabel={t("common.action.later")}
        onConfirm={() => void attach.acceptNotice()}
        onCancel={attach.declineNotice}
        // Nothing is removed here: the app's own primary action, not red.
        tone="default"
        testID="dialog-image-privacy"
      />

      <ConfirmDialog
        visible={denied !== null}
        title={denied ? t(denied.title) : ""}
        message={denied ? t(denied.message) : ""}
        confirmLabel={t("common.action.openSettings")}
        cancelLabel={t("common.action.later")}
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
