import { isAxiosError } from "axios";

import { getErrorCode } from "@/lib/axios";
import { isNetworkError } from "@/lib/api-envelope";
import { i18n } from "@/lib/i18n";
import { useImageProposalsMutation } from "@/features/ai-chat/api/use-image-proposals-mutation";
import { captureExists } from "@/features/ai-chat/image-capture";
import { nextMessageId } from "@/features/ai-chat/message-id";
import { appReply } from "@/features/ai-chat/message-text";
import { toReplyMessages } from "@/features/ai-chat/reply-fanout";
import { ChatMessage } from "@/features/ai-chat/types";
import { useNeedsFirstWallet } from "@/features/wallets/use-open-wallet-creator";
import { captureChatEpoch, useChatStore } from "@/stores/chat-store";
import { useImageReadingSessionStore } from "@/stores/image-reading-session-store";
import { useToastStore } from "@/stores/toast-store";

// Reply copy for a failed reading (specs/ai-chat-image-capture BR-18, BR-19,
// UI states), per pfm-ux-copy: what failed, then the one next step as a button.
// Stored in the thread as keys (message-text.ts).
const SECONDS_PER_MINUTE = 60;
const BUSY_DEFAULT_MINUTES = 1;
const IMAGE_READING_OFF = "chat.image.reply.readingOff";
const IMAGE_LIMIT_REACHED = "chat.image.reply.limitReached";
const IMAGE_UNAVAILABLE = "chat.image.reply.unavailable";
const IMAGE_TOO_LARGE = "chat.image.reply.tooLarge";
const IMAGE_WRONG_TYPE = "chat.image.reply.wrongType";
// A toast: short phrase, no final period.
const CAPTURE_GONE = "chat.image.captureGone.toast";

interface UseImageCaptureActionsOptions {
  sending: boolean;
  setSending: (sending: boolean) => void;
  onSent: () => void;
  minTypingMs: number;
}

/**
 * Sending a photo for reading, and re-sending it after a failure. Shares the
 * chat's `sending` flag so the typing indicator and the disabled inputs are
 * one state. The proposals come back as ordinary cards (reply-fanout.ts).
 */
export function useImageCaptureActions({ sending, setSending, onSent, minTypingMs }: UseImageCaptureActionsOptions) {
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const readImage = useImageProposalsMutation();
  const noWallets = useNeedsFirstWallet();

  const requestReading = async (imageMessage: ChatMessage): Promise<ChatMessage[]> => {
    const uri = imageMessage.imageCapture?.localUri ?? "";
    const caption = imageMessage.imageCapture?.caption;
    const startedAt = Date.now();
    try {
      const response = await readImage.mutateAsync({ uri, caption });
      const elapsed = Date.now() - startedAt;
      if (elapsed < minTypingMs) await new Promise((resolve) => setTimeout(resolve, minTypingMs - elapsed));
      // No sourceText: a caption never becomes a recent phrase (AC-20).
      return toReplyMessages(response, { noWallets, imageOrigin: true });
    } catch (error) {
      return [failedReply(error, imageMessage.id)];
    }
  };

  const run = async (imageMessage: ChatMessage) => {
    setSending(true);
    const stillCurrent = captureChatEpoch();
    const replies = await requestReading(imageMessage);
    if (stillCurrent()) replies.forEach(addMessage);
    setSending(false);
  };

  const sendImage = async (uri: string, caption: string) => {
    if (sending) return;
    const trimmed = caption.trim();
    const imageMessage: ChatMessage = {
      id: nextMessageId(),
      role: "user",
      // The caption is the only text that ever syncs for this message (AC-23).
      text: trimmed,
      imageCapture: { localUri: uri, caption: trimmed || undefined },
    };
    addMessage(imageMessage);
    onSent();
    await run(imageMessage);
  };

  /** Re-sends the photo of a failed reading, while it is still on the device. */
  const retryImage = async (failedReply: ChatMessage) => {
    if (sending || !failedReply.retryImageMessageId) return;
    const imageMessage = useChatStore.getState().thread.find((m) => m.id === failedReply.retryImageMessageId);
    if (!imageMessage || !captureExists(imageMessage.imageCapture?.localUri)) {
      useToastStore.getState().show(i18n.t(CAPTURE_GONE), "error");
      return;
    }
    updateMessage(failedReply.id, { retryImageMessageId: undefined });
    onSent();
    await run(imageMessage);
  };

  return { sendImage, retryImage };
}

function failedReply(error: unknown, imageMessageId: string): ChatMessage {
  const base = { id: nextMessageId(), role: "assistant" as const };
  const code = getErrorCode(error);
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (code === "AI_IMAGE_DISABLED") {
    useImageReadingSessionStore.getState().markOff();
    return { ...base, ...appReply(IMAGE_READING_OFF), offerManualEntry: true };
  }
  if (code === "AI_IMAGE_BUSY") {
    const minutes = Math.max(BUSY_DEFAULT_MINUTES, Math.ceil((retryAfterSeconds(error) ?? 0) / SECONDS_PER_MINUTE));
    return { ...base, ...appReply("chat.image.reply.busy", { count: minutes }), offerManualEntry: true, retryImageMessageId: imageMessageId };
  }
  if (code === "RATE_LIMITED") return { ...base, ...appReply(IMAGE_LIMIT_REACHED), offerManualEntry: true };
  if (code === "IMAGE_TOO_LARGE" || status === 413) return { ...base, ...appReply(IMAGE_TOO_LARGE) };
  if (code === "UNSUPPORTED_IMAGE_TYPE") return { ...base, ...appReply(IMAGE_WRONG_TYPE) };
  if (isNetworkError(error)) return { ...base, ...appReply("errors.network"), retryImageMessageId: imageMessageId };
  return { ...base, ...appReply(IMAGE_UNAVAILABLE), offerManualEntry: true, retryImageMessageId: imageMessageId };
}

function retryAfterSeconds(error: unknown): number | null {
  if (!isAxiosError<{ details?: { retry_after_seconds?: number | null } }>(error)) return null;
  const value = error.response?.data?.details?.retry_after_seconds;
  return typeof value === "number" ? value : null;
}
