import { useState } from "react";

import { getErrorCode, getErrorMessage } from "@/lib/axios";
import { useSendChatMessageMutation } from "@/features/ai-chat/api/use-send-chat-message-mutation";
import { useCreateTransactionMutation } from "@/features/transactions/api/use-create-transaction-mutation";
import { useUpdateTransactionMutation } from "@/features/transactions/api/use-update-transaction-mutation";
import { ChatMessage, EditHistoryEntry, TransactionActionPayload } from "@/features/ai-chat/types";
import { nextMessageId, newIdempotencyKey } from "@/features/ai-chat/message-id";
import { useChatStore } from "@/stores/chat-store";
import { useToastStore } from "@/stores/toast-store";

// The typing indicator is meant to be felt, not just technically present —
// even a fast reply holds the dots for a beat before the answer appears.
const MIN_TYPING_MS = 1300;

interface UseChatActionsOptions {
  /** Scrolls the thread to the newest message after the user sends. */
  onSent: () => void;
}

/**
 * Everything the chat screen does to the thread.
 *
 * Extracted from the screen so ai-chat.tsx stays layout and dispatch only.
 * None of this changed when swipe-to-delete arrived — it is lifted verbatim,
 * and the removal path lives separately in use-transaction-removal.
 */
export function useChatActions({ onSent }: UseChatActionsOptions) {
  const thread = useChatStore((s) => s.thread);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);

  const [sending, setSending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const sendMessage = useSendChatMessageMutation();
  const createTransaction = useCreateTransactionMutation();
  const updateTransaction = useUpdateTransactionMutation();

  // Shared by a fresh send and a resend-after-editing flow — same pacing
  // either way, only the resulting message's `edited` flag differs. A
  // rate-limit or service-unavailable failure gets its own copy plus a
  // manual-entry offer, instead of the generic failure text.
  const requestAssistantReply = async (message: string, edited?: boolean): Promise<ChatMessage> => {
    const startedAt = Date.now();
    try {
      const response = await sendMessage.mutateAsync({ message });
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_TYPING_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_TYPING_MS - elapsed));
      }
      const action = response.actions[0];
      return {
        id: nextMessageId(),
        role: "assistant",
        text: response.message,
        action,
        intent: response.intent === "ambiguous" ? "ambiguous" : undefined,
        actionType: response.action_type,
        edited,
        editHistory: action ? [{ payload: action.payload, timestamp: Date.now(), source: "created" }] : undefined,
      };
    } catch (err) {
      const code = getErrorCode(err);
      const isBusy = code === "RATE_LIMITED" || code === "AI_SERVICE_UNAVAILABLE";
      return {
        id: nextMessageId(),
        role: "assistant",
        text: isBusy ? "Hệ thống đang bận, vui lòng thử lại sau." : "Xin lỗi, mình chưa xử lý được. Vui lòng thử lại.",
        offerManualEntry: isBusy,
        edited,
      };
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    addMessage({ id: nextMessageId(), role: "user", text: trimmed });
    onSent();
    setSending(true);
    addMessage(await requestAssistantReply(trimmed));
    setSending(false);
  };

  // Editing a user message patches its text in place but re-runs extraction on
  // the correction rather than leaving the old reply attached to stale input.
  // The new reply is appended, never substituted, so nothing visible is
  // destroyed. If the reply after it was an unconfirmed proposal, that
  // proposal is superseded so its Confirm cannot save the stale guess.
  const editUserMessage = async (target: ChatMessage, newText: string) => {
    const trimmed = newText.trim();
    if (!trimmed || sending) return;
    updateMessage(target.id, { text: trimmed });

    const index = thread.findIndex((m) => m.id === target.id);
    const next = thread[index + 1];
    if (next?.role === "assistant" && next.action && !next.confirmed) {
      updateMessage(next.id, { superseded: true });
    }

    setSending(true);
    addMessage(await requestAssistantReply(trimmed, true));
    setSending(false);
  };

  /**
   * Editing a proposed transaction never calls the AI again — the user is
   * supplying the corrected fields directly. Either branch mutates the target
   * in place and appends to its history; no new message is created.
   *
   * ⚠️ A confirmed proposal PATCHes its existing transaction. It must never
   * fall back to a create, which would leave a duplicate transaction behind
   * and orphan the original.
   */
  const editAction = (target: ChatMessage, payload: TransactionActionPayload) => {
    const timestamp = Date.now();
    const priorHistory: EditHistoryEntry[] =
      target.editHistory ?? (target.action ? [{ payload: target.action.payload, timestamp, source: "created" }] : []);
    const editHistory = [...priorHistory, { payload, timestamp, source: "edited" as const }];

    if (target.confirmed && target.transactionId) {
      updateTransaction.mutate(
        {
          id: target.transactionId,
          body: {
            amount: payload.amount,
            category_id: payload.category_id,
            occurred_at: payload.occurred_at,
            note: payload.note ?? undefined,
          },
        },
        {
          onSuccess: () =>
            updateMessage(target.id, { action: { ...target.action!, payload }, edited: true, editHistory }),
        },
      );
      return;
    }

    // A fresh idempotency key: the one on record may already have been spent
    // by a prior failed attempt.
    updateMessage(target.id, {
      action: { ...target.action!, payload, idempotency_key: newIdempotencyKey() },
      edited: true,
      editHistory,
    });
  };

  const confirmAction = (message: ChatMessage) => {
    if (!message.action) return;
    setConfirmingId(message.id);
    const { payload, idempotency_key } = message.action;
    createTransaction.mutate(
      { ...payload, note: payload.note ?? undefined, idempotency_key },
      {
        onSuccess: (transaction) => updateMessage(message.id, { confirmed: true, transactionId: transaction.id }),
        onError: (error) => {
          if (getErrorCode(error) === "INSUFFICIENT_BALANCE") {
            useToastStore.getState().show(getErrorMessage(error, "Số dư không đủ"), "error");
          }
        },
        onSettled: () => setConfirmingId(null),
      },
    );
  };

  return { sending, confirmingId, send, editUserMessage, editAction, confirmAction };
}
