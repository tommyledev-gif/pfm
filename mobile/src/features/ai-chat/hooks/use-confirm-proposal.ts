import { useMemo, useState } from "react";

import { getErrorCode, getErrorMessage } from "@/lib/axios";
import { userIdFromAccessToken } from "@/lib/jwt";
import { useCreateTransactionMutation } from "@/features/transactions/api/use-create-transaction-mutation";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { isConfirmAllEligible, isSavableProposal, proposalLinesGap } from "@/features/ai-chat/proposal-wallet";
import { ChatMessage } from "@/features/ai-chat/types";
import { useChatStore } from "@/stores/chat-store";
import { useRecentPhrasesStore } from "@/stores/recent-phrases-store";
import { useSessionStore } from "@/stores/session-store";
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
  const wallets = useWalletsQuery();
  const createTransaction = useCreateTransactionMutation();

  const walletById = useMemo(() => new Map(wallets.data?.map((w) => [w.id, w])), [wallets.data]);

  /**
   * ⚠️ A proposal without a VND Wallet is never sent (spec BR-13, AC-34): it
   * returns false with no request, so confirm-all counts it as not saved and
   * it stays pending until the User edits a VND Wallet onto it. Nothing is
   * sent before the Wallet list has loaded, so the currency check is real.
   */
  const save = async (message: ChatMessage): Promise<boolean> => {
    if (!message.action || !wallets.data) return false;
    const { payload, idempotency_key } = message.action;
    if (payload.wallet_id === null || !isSavableProposal(payload, walletById)) return false;
    // ⚠️ Lines that miss the amount are never sent (spec BR-15): the card's
    // Save opens the edit form instead, where the User closes the gap.
    if (proposalLinesGap(payload) !== 0) return false;
    // A transfer names its destination and goes without a category (the
    // server files it under its own) or items (it has none); income/expense
    // must not name a destination at all.
    const { category_id, to_wallet_id, items, adjustments, ...common } = payload;
    const kindFields =
      payload.type === "transfer" ? { to_wallet_id: to_wallet_id ?? undefined } : { category_id, items, adjustments };
    try {
      const transaction = await createTransaction.mutateAsync({
        ...common,
        ...kindFields,
        wallet_id: payload.wallet_id,
        note: payload.note ?? undefined,
        idempotency_key,
      });
      updateMessage(message.id, { confirmed: true, transactionId: transaction.id });
      // Every confirm path (chat, pending review, confirm-all) runs through
      // here, and only a confirm does — so a discarded proposal's wording
      // never becomes a suggestion.
      const userId = userIdFromAccessToken(useSessionStore.getState().accessToken);
      if (userId && message.sourceText) useRecentPhrasesStore.getState().record(userId, message.sourceText);
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
      // A possible duplicate is the User's call on its own card (spec BR-17).
      if (!isConfirmAllEligible(message)) continue;
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
