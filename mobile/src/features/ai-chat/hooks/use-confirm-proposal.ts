import { useState } from "react";

import { getErrorCode, getErrorMessage } from "@/lib/axios";
import { useCreateTransactionMutation } from "@/features/transactions/api/use-create-transaction-mutation";
import { ChatMessage } from "@/features/ai-chat/types";
import { useChatStore } from "@/stores/chat-store";
import { useToastStore } from "@/stores/toast-store";

/**
 * Saving an AI transaction proposal as a real Transaction.
 *
 * Shared by the chat thread's Confirm button and the pending-review screen,
 * so both mark the message confirmed the same way.
 */
export function useConfirmProposal() {
  const updateMessage = useChatStore((s) => s.updateMessage);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const createTransaction = useCreateTransactionMutation();

  const save = async (message: ChatMessage): Promise<boolean> => {
    if (!message.action) return false;
    const { payload, idempotency_key } = message.action;
    try {
      const transaction = await createTransaction.mutateAsync({
        ...payload,
        note: payload.note ?? undefined,
        idempotency_key,
      });
      updateMessage(message.id, { confirmed: true, transactionId: transaction.id });
      return true;
    } catch (error) {
      if (getErrorCode(error) === "INSUFFICIENT_BALANCE") {
        useToastStore.getState().show(getErrorMessage(error, "Số dư không đủ"), "error");
      }
      return false;
    }
  };

  const confirm = (message: ChatMessage) => {
    setConfirmingId(message.id);
    save(message).finally(() => setConfirmingId(null));
  };

  /**
   * ⚠️ One at a time, not in parallel: each save moves a wallet balance, and
   * an insufficient-balance failure has to be judged against the balance the
   * previous saves already left behind. A failure skips that item and moves
   * on — it stays pending for the user to fix.
   */
  const confirmAll = async (messages: ChatMessage[]) => {
    setConfirmingAll(true);
    let saved = 0;
    for (const message of messages) {
      setConfirmingId(message.id);
      if (await save(message)) saved += 1;
    }
    setConfirmingId(null);
    setConfirmingAll(false);
    const failed = messages.length - saved;
    useToastStore
      .getState()
      .show(
        failed > 0 ? `Đã duyệt ${saved} mục, ${failed} mục chưa lưu được` : `Đã duyệt ${saved} mục`,
        failed > 0 ? "warning" : "info",
      );
  };

  return { confirmingId, confirmingAll, confirm, confirmAll };
}
