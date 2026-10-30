import { useRef, useState } from "react";
import { Keyboard } from "react-native";

import { PopoverAnchor } from "@/components/shared/ActionPopover";
import { ImageSource, pickImage } from "@/features/ai-chat/image-capture";
import { hasSeenImagePrivacyNotice, markImagePrivacyNoticeSeen } from "@/features/ai-chat/image-privacy-notice";
import { i18n } from "@/lib/i18n";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { useToastStore } from "@/stores/toast-store";

// Toasts: short phrases, no final period (pfm-ux-copy patterns §1).
const IMAGE_TOO_LARGE = "chat.image.tooLarge.toast";
const IMAGE_UNREADABLE = "chat.image.unreadable.toast";

/**
 * The steps between tapping attach and the preview (specs/ai-chat-image-
 * capture US-01 steps 1–5): the privacy notice on first use (BR-21), the
 * camera / library choice, the device permission, then the picked photo.
 * Nothing leaves the device here.
 */
export function useImageAttach() {
  const userId = useCurrentUserId();
  const anchorRef = useRef<PopoverAnchor | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<PopoverAnchor | null>(null);
  const [deniedSource, setDeniedSource] = useState<ImageSource | null>(null);
  const [pickedUri, setPickedUri] = useState<string | null>(null);

  const open = async (anchor: PopoverAnchor) => {
    Keyboard.dismiss();
    anchorRef.current = anchor;
    if (!userId || !(await hasSeenImagePrivacyNotice(userId))) {
      setNoticeOpen(true);
      return;
    }
    setMenuAnchor(anchor);
  };

  const acceptNotice = async () => {
    setNoticeOpen(false);
    if (userId) await markImagePrivacyNoticeSeen(userId);
    setMenuAnchor(anchorRef.current);
  };

  const choose = async (source: ImageSource) => {
    setMenuAnchor(null);
    const result = await pickImage(source);
    switch (result.kind) {
      case "picked":
        setPickedUri(result.uri);
        return;
      case "denied":
        setDeniedSource(result.source);
        return;
      case "too_large":
        useToastStore.getState().show(i18n.t(IMAGE_TOO_LARGE), "error");
        return;
      case "failed":
        useToastStore.getState().show(i18n.t(IMAGE_UNREADABLE), "error");
        return;
      case "cancelled":
        return;
    }
  };

  return {
    open,
    noticeOpen,
    acceptNotice,
    // "Để sau": nothing taken, the notice comes back on the next tap (S-AIIMG-72).
    declineNotice: () => setNoticeOpen(false),
    menuAnchor,
    closeMenu: () => setMenuAnchor(null),
    choose,
    deniedSource,
    closeDenied: () => setDeniedSource(null),
    pickedUri,
    clearPicked: () => setPickedUri(null),
  };
}
