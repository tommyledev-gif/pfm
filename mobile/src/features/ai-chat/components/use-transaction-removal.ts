import { useCallback, useMemo, useState } from "react";

import { getErrorCode, getErrorMessage } from "@/lib/axios";
import { useRequireOnline } from "@/lib/connectivity";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { useDeleteTransactionMutation } from "@/features/transactions/api/use-delete-transaction-mutation";
import { hasPersistedTransaction } from "@/features/ai-chat/tombstone";
import { ChatMessage } from "@/features/ai-chat/types";
import { useChatStore } from "@/stores/chat-store";
import { useToastStore } from "@/stores/toast-store";

// A delete against an id the server has never heard of, or has already
// removed, means the outcome the user asked for already holds.
const ALREADY_GONE_CODES = ["TRANSACTION_NOT_FOUND", "NOT_FOUND"];

export interface TransactionRemoval {
  /** The message awaiting confirmation, or null. */
  target: ChatMessage | null;
  /** True when confirming would call the server rather than only mark locally. */
  targetIsPersisted: boolean;
  deleting: boolean;
  request: (message: ChatMessage) => void;
  cancel: () => void;
  confirm: () => void;
}

/**
 * Removing a transaction proposal, in the two shapes it actually comes in.
 *
 * ⚠️ The message is never taken out of the thread. Both branches mark it
 * instead, which is what keeps the conversation a truthful record of what the
 * user asked for and what became of it.
 *
 *   - confirmed  — a real Transaction exists, so it is soft-deleted through
 *                  the API and the tombstone is written ONLY after that
 *                  succeeds. A tombstone on a failed delete would claim a
 *                  removal that never happened.
 *   - unconfirmed — nothing was ever written, so no request is made and there
 *                  is no server-side history for it afterwards.
 */
export function useTransactionRemoval(): TransactionRemoval {
  const updateMessage = useChatStore((s) => s.updateMessage);
  const [target, setTarget] = useState<ChatMessage | null>(null);
  const deleteTransaction = useDeleteTransactionMutation();
  const requireOnline = useRequireOnline();

  const markRemoved = useCallback(
    (message: ChatMessage, removalState: "deleted" | "discarded") => {
      updateMessage(message.id, { removalState, removedAt: new Date().toISOString() });
    },
    [updateMessage],
  );

  const confirm = useLatestCallback(() => {
    const message = target;
    if (!message) return;

    if (!hasPersistedTransaction(message)) {
      markRemoved(message, "discarded");
      setTarget(null);
      return;
    }

    deleteTransaction.mutate(message.transactionId as string, {
      onSuccess: () => {
        markRemoved(message, "deleted");
        setTarget(null);
      },
      onError: (error) => {
        if (ALREADY_GONE_CODES.includes(getErrorCode(error) ?? "")) {
          markRemoved(message, "deleted");
          setTarget(null);
          return;
        }
        // ⚠️ No tombstone here: the transaction still exists, so the card has
        // to stay a live card the user can act on again.
        useToastStore.getState().show(getErrorMessage(error, "Chưa xóa được giao dịch"), "error");
        setTarget(null);
      },
    });
  });

  // Deleting a saved Transaction needs the server (AC-OFF-08) — refused
  // before the confirmation opens. Discarding an unconfirmed proposal is
  // local only and stays available offline.
  const request = useLatestCallback((message: ChatMessage) => {
    if (hasPersistedTransaction(message)) requireOnline(() => setTarget(message));
    else setTarget(message);
  });
  // Guarded so tapping the backdrop mid-request cannot leave a second
  // confirmation able to fire the same delete again.
  const cancel = useLatestCallback(() => {
    if (!deleteTransaction.isPending) setTarget(null);
  });
  const deleting = deleteTransaction.isPending;

  // One object per change, so the overlays that take it can skip renders.
  return useMemo(
    () => ({
      target,
      targetIsPersisted: target ? hasPersistedTransaction(target) : false,
      deleting,
      request,
      cancel,
      confirm,
    }),
    [target, deleting, request, cancel, confirm],
  );
}
