import { useState } from "react";

import { getErrorCode } from "@/lib/axios";
import { useSendChatMessageMutation } from "@/features/ai-chat/api/use-send-chat-message-mutation";
import { useUpdateTransactionMutation } from "@/features/transactions/api/use-update-transaction-mutation";
import { ChatMessage, EditHistoryEntry, TransactionActionPayload } from "@/features/ai-chat/types";
import { nextMessageId, newIdempotencyKey } from "@/features/ai-chat/message-id";
import { toReplyMessages } from "@/features/ai-chat/reply-fanout";
import { proposalLinesChanged } from "@/features/ai-chat/proposal-lines";
import { useConfirmProposal } from "@/features/ai-chat/hooks/use-confirm-proposal";
import { useNeedsFirstWallet } from "@/features/wallets/use-open-wallet-creator";
import { useChatStore } from "@/stores/chat-store";

// The typing indicator is meant to be felt, not just technically present —
// even a fast reply holds the dots for a beat before the answer appears.
export const MIN_TYPING_MS = 1300;

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
  // Saving a proposal lives in its own hook, shared with the pending-review screen.
  const { confirmingId, confirm: confirmAction } = useConfirmProposal();

  const sendMessage = useSendChatMessageMutation();
  const noWallets = useNeedsFirstWallet();
  const updateTransaction = useUpdateTransactionMutation();

  // Shared by a fresh send and a resend-after-editing flow — same pacing
  // either way, only the resulting message's `edited` flag differs. A
  // rate-limit or service-unavailable failure gets its own copy plus a
  // manual-entry offer, instead of the generic failure text. A reply with
  // several proposals becomes one message per proposal (reply-fanout.ts).
  const requestAssistantReply = async (message: string, edited?: boolean): Promise<ChatMessage[]> => {
    const startedAt = Date.now();
    try {
      const response = await sendMessage.mutateAsync({ message });
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_TYPING_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_TYPING_MS - elapsed));
      }
      return toReplyMessages(response, { sourceText: message, edited, noWallets });
    } catch (err) {
      const code = getErrorCode(err);
      const isBusy = code === "RATE_LIMITED" || code === "AI_SERVICE_UNAVAILABLE";
      return [
        {
          id: nextMessageId(),
          role: "assistant",
          text: isBusy ? "Hệ thống đang bận. Thử lại sau ít phút." : "Chưa xử lý được tin nhắn này. Thử lại.",
          offerManualEntry: isBusy,
          edited,
        },
      ];
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    addMessage({ id: nextMessageId(), role: "user", text: trimmed });
    onSent();
    setSending(true);
    (await requestAssistantReply(trimmed)).forEach(addMessage);
    setSending(false);
  };

  // Editing a user message patches its text in place but re-runs extraction on
  // the correction rather than leaving the old reply attached to stale input.
  // The new reply is appended, never substituted, so nothing visible is
  // destroyed. Every unconfirmed proposal of the old reply — all messages up to
  // the next user message — is superseded so no Confirm can save a stale
  // guess; confirmed ones stay as they are (spec AC-39).
  const editUserMessage = async (target: ChatMessage, newText: string) => {
    const trimmed = newText.trim();
    if (!trimmed || sending) return;
    updateMessage(target.id, { text: trimmed });

    const index = thread.findIndex((m) => m.id === target.id);
    for (const next of index < 0 ? [] : thread.slice(index + 1)) {
      if (next.role === "user") break;
      if (next.action && !next.confirmed && !next.removalState) updateMessage(next.id, { superseded: true });
    }

    setSending(true);
    (await requestAssistantReply(trimmed, true)).forEach(addMessage);
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
      const linesChanged = target.action ? proposalLinesChanged(target.action.payload, payload) : false;
      updateTransaction.mutate(
        {
          id: target.transactionId,
          body: {
            amount: payload.amount,
            category_id: payload.category_id,
            occurred_at: payload.occurred_at,
            note: payload.note ?? undefined,
            // Both lists together, [] for "removed": PATCH replaces them as a pair.
            ...(linesChanged ? { items: payload.items ?? [], adjustments: payload.adjustments ?? [] } : {}),
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

  return { sending, confirmingId, send, editUserMessage, editAction, confirmAction };
}
