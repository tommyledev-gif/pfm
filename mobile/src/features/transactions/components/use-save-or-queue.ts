import { useState } from "react";
import { onlineManager } from "@tanstack/react-query";

import { isNetworkError } from "@/lib/api-envelope";
import { i18n } from "@/lib/i18n";
import { useOutboxStore } from "@/stores/outbox-store";
import { useToastStore } from "@/stores/toast-store";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { useCreateTransactionMutation } from "@/features/transactions/api/use-create-transaction-mutation";
import { flushOutbox } from "@/features/transactions/outbox/flush-outbox";
import { OutboxDisplay, OutboxPayload } from "@/features/transactions/outbox/outbox-types";

// Keys, translated when the toast is shown.
export const QUEUE_COPY = {
  queued: "transactions.sync.queued",
  full: "transactions.sync.queueFull",
} as const;

/**
 * The create path of the Transaction form (specs/mobile-offline-support
 * US-04, BR-OFF-P09): online it saves as before; offline, or when the save
 * gets no answer, the same payload — same idempotency key — goes into the
 * signed-in User's outbox. A server refusal is never queued: it stays in
 * the form for the User to fix (BR-OFF-07).
 */
export function useSaveOrQueue() {
  const userId = useCurrentUserId();
  const [queueing, setQueueing] = useState(false);
  const createTransaction = useCreateTransactionMutation();

  const enqueue = async (payload: OutboxPayload, display: OutboxDisplay, maybeSent: boolean): Promise<boolean> => {
    if (!userId) return false;
    setQueueing(true);
    try {
      const result = await useOutboxStore.getState().enqueue(userId, { payload, display, maybeSent });
      if (result === "full") {
        useToastStore.getState().show(i18n.t(QUEUE_COPY.full), "warning");
        return false;
      }
      // "duplicate" is the double tap of S-OFF-26: already queued once.
      useToastStore.getState().show(i18n.t(QUEUE_COPY.queued), "info");
      return true;
    } finally {
      setQueueing(false);
    }
  };

  const save = (payload: OutboxPayload, display: OutboxDisplay, onSaved: () => void) => {
    if (queueing) return;
    if (!onlineManager.isOnline()) {
      void enqueue(payload, display, false).then((ok) => ok && onSaved());
      return;
    }
    createTransaction.mutate(payload, {
      onSuccess: onSaved,
      onError: (error) => {
        if (!isNetworkError(error)) return;
        // The request may have reached the server; the shared key makes the
        // later send safe (S-OFF-23). No error is left showing in the form.
        createTransaction.reset();
        void enqueue(payload, display, true).then((ok) => ok && onSaved());
      },
    });
  };

  // Editing a queued item keeps its key; a Failed item becomes Waiting
  // (S-OFF-46). It stays a create whatever is changed (EC-OFF-22).
  const saveQueued = (key: string, payload: OutboxPayload, display: OutboxDisplay, onSaved: () => void) => {
    if (!userId) return;
    useOutboxStore.getState().replacePayload(userId, key, payload, display);
    onSaved();
    if (onlineManager.isOnline()) void flushOutbox("edit");
  };

  return { createTransaction, save, saveQueued, queueing };
}
