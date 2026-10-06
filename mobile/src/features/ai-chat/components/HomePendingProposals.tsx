import { memo, useCallback, useMemo } from "react";
import { useRouter } from "expo-router";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FALLBACK_CURRENCY } from "@/lib/constants";
import { PendingConfirmationsSection } from "@/features/ai-chat/components/PendingConfirmationsSection";
import { useTransactionRemoval } from "@/features/ai-chat/components/use-transaction-removal";
import { isPendingProposal } from "@/features/ai-chat/pending";
import { removalDialogCopy } from "@/features/ai-chat/removal-copy";
import { Category } from "@/features/categories/types";
import { useChatStore } from "@/stores/chat-store";

interface HomePendingProposalsProps {
  categoryById: Map<string, Category>;
  /** Wallet id → currency, so each row is formatted in its own Wallet's currency. */
  walletCurrencyById: Map<string, string>;
}

/**
 * Home's "awaiting confirmation" block together with its discard dialog.
 *
 * ⚠️ Owns the chat-thread subscription on purpose. Home used to read the
 * thread itself, and tabs stay mounted — so every message sent from the AI
 * tab re-rendered ALL of Home behind it (snapshot card, wallet carousel,
 * recent list), leaving the JS thread busy right when the User tapped back to
 * Home. Same rule as the AI chat screen's memoized rows: an update re-renders
 * only the part that shows it.
 *
 * ⚠️ Confirming a discard here writes nothing to the server — every row is an
 * unconfirmed proposal, so the message is marked discarded and stays in the
 * thread. It is never deleted from it.
 */
function HomePendingProposalsView({ categoryById, walletCurrencyById }: HomePendingProposalsProps) {
  const router = useRouter();
  const thread = useChatStore((s) => s.thread);
  const removal = useTransactionRemoval();

  // Selecting the raw, referentially stable thread and filtering in a memo —
  // a selector returning a fresh array every call makes the store see a
  // changed snapshot on every render and re-render forever.
  const pending = useMemo(() => thread.filter(isPendingProposal), [thread]);

  const removalCopy = removalDialogCopy(removal.target, removal.targetIsPersisted, {
    currency: walletCurrencyById.get(removal.target?.action?.payload.wallet_id ?? "") ?? FALLBACK_CURRENCY,
    resolveCategoryName: (id) => categoryById.get(id)?.name,
  });

  // Deep-links into the chat at the exact message, instead of the chat's own
  // default of landing on the newest one. The nonce lets the same item be
  // re-opened twice in a row.
  const openMessage = useCallback(
    (messageId: string, openEdit?: boolean) =>
      router.push({
        pathname: "/ai-chat",
        params: { focusMessageId: messageId, focusedAt: String(Date.now()), ...(openEdit ? { openEdit: "1" } : {}) },
      }),
    [router],
  );
  const openReview = useCallback(() => router.push("/pending"), [router]);

  return (
    <>
      <PendingConfirmationsSection
        messages={pending}
        categoryById={categoryById}
        walletCurrencyById={walletCurrencyById}
        onViewAll={openReview}
        onOpenMessage={openMessage}
        onRequestRemove={removal.request}
      />
      <ConfirmDialog
        visible={removal.target !== null}
        title={removalCopy.title}
        message={removalCopy.message}
        confirmLabel={removalCopy.confirmLabel}
        loading={removal.deleting}
        onCancel={removal.cancel}
        onConfirm={removal.confirm}
      />
    </>
  );
}

export const HomePendingProposals = memo(HomePendingProposalsView);
