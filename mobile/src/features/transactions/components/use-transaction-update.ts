import { useEffect, useRef, useState } from "react";

import { useRequireOnline } from "@/lib/connectivity";
import { Transaction, UpdateTransactionRequest } from "@/features/transactions/types";
import { useTransactionQuery } from "@/features/transactions/api/use-transaction-query";
import { useUpdateTransactionMutation } from "@/features/transactions/api/use-update-transaction-mutation";
import { isStaleEditError } from "@/features/transactions/items/save-error-message";

interface UseTransactionUpdateOptions {
  visible: boolean;
  editingTransaction?: Transaction | null;
  // Re-seeds the whole form from a fresh copy ("Load latest").
  onReloaded: (fresh: Transaction) => void;
}

/**
 * The edit half of the Transaction form (specs/transaction-line-items US-03,
 * BR-16): loads the detail that carries the Items, sends PATCH with the version
 * the form was seeded from, and turns a 409 TRANSACTION_CHANGED into a choice
 * instead of a silent overwrite. Split from use-transaction-form.ts for its
 * 300-line limit.
 */
export function useTransactionUpdate({ visible, editingTransaction, onReloaded }: UseTransactionUpdateOptions) {
  const transactionId = editingTransaction?.id ?? null;
  const detail = useTransactionQuery(transactionId, { enabled: visible });
  const mutation = useUpdateTransactionMutation();
  const requireOnline = useRequireOnline();
  // updated_at of the copy the form shows — the list row on open, the fresh
  // detail after "Load latest".
  const [baseline, setBaseline] = useState<string | null>(null);
  const [staleOpen, setStaleOpen] = useState(false);
  const pending = useRef<{ body: UpdateTransactionRequest; onSuccess: () => void } | null>(null);

  useEffect(() => {
    if (visible && editingTransaction) setBaseline(editingTransaction.updated_at);
    if (!visible) setStaleOpen(false);
  }, [visible, editingTransaction]);

  const send = (body: UpdateTransactionRequest, onSuccess: () => void) => {
    if (!transactionId) return;
    mutation.mutate(
      { id: transactionId, body },
      {
        onSuccess,
        onError: (error) => {
          if (!isStaleEditError(error)) return;
          pending.current = { body, onSuccess };
          setStaleOpen(true);
        },
      },
    );
  };

  /** Editing is online-only (AC-OFF-08, AC-26). */
  const submit = (body: UpdateTransactionRequest, onSuccess: () => void) =>
    requireOnline(() => send(baseline ? { ...body, expected_updated_at: baseline } : body, onSuccess));

  const saveAnyway = () => {
    setStaleOpen(false);
    const last = pending.current;
    if (!last) return;
    const { expected_updated_at: _skip, ...body } = last.body;
    send(body, last.onSuccess);
  };

  const loadLatest = async () => {
    setStaleOpen(false);
    pending.current = null;
    mutation.reset();
    const result = await detail.refetch();
    if (!result.data) return;
    setBaseline(result.data.updated_at);
    onReloaded(result.data);
  };

  return {
    detail,
    mutation,
    submit,
    stale: {
      visible: staleOpen,
      onSaveAnyway: saveAnyway,
      onLoadLatest: () => void loadLatest(),
      onDismiss: () => setStaleOpen(false),
    },
  };
}
