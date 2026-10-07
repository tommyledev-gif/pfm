import { memo } from "react";

import { ActionPopover } from "@/components/shared/ActionPopover";
import { FALLBACK_CURRENCY } from "@/lib/constants";
import { BudgetWizardCard } from "@/features/ai-chat/components/BudgetWizardCard";
import { ChatBubble } from "@/features/ai-chat/components/ChatBubble";
import { SwipeableMessageRow } from "@/features/ai-chat/components/SwipeableMessageRow";
import { TransactionActionCard } from "@/features/ai-chat/components/TransactionActionCard";
import { TransactionTombstoneCard } from "@/features/ai-chat/components/TransactionTombstoneCard";
import { useHoldMenu } from "@/features/ai-chat/hooks/use-hold-menu";
import { useMessageActions } from "@/features/ai-chat/hooks/use-message-actions";
import { isEditLocked } from "@/features/ai-chat/edit-lock";
import { isSavableProposal, NO_WALLET_LABEL } from "@/features/ai-chat/proposal-wallet";
import { isRemovable, tombstoneKind } from "@/features/ai-chat/tombstone";
import { ChatMessage } from "@/features/ai-chat/types";
import { Category } from "@/features/categories/types";
import { Wallet } from "@/features/wallets/types";
import { ManualEntryButton } from "@/features/ai-chat/components/ManualEntryButton";
import { CreateWalletButton } from "@/features/ai-chat/components/CreateWalletButton";

interface ChatMessageRowProps {
  message: ChatMessage;
  walletById: Map<string, Wallet>;
  categoryById: Map<string, Category>;
  /** Keyed "categoryId|currency" — a proposal in one currency must never be
   *  measured against a budget limit in another. */
  budgetByCategoryCurrency: Map<string, { amount_limit: number; spent: number }>;
  confirming: boolean;
  /** Bumped by the thread on scroll or content change — closes a parked row. */
  closeSignal: number;
  onConfirm: (message: ChatMessage) => void;
  onTriggerEdit: (message: ChatMessage) => void;
  onTriggerDelete: (message: ChatMessage) => void;
  onPressHistory: (message: ChatMessage) => void;
  onOpenBudgetWizard: (message: ChatMessage) => void;
  onOpenManualEntry: () => void;
  /** Present only while the User owns no VND Wallet — see TransactionActionCard. */
  onCreateWallet?: () => void;
  /** Opens the new-wallet form — for a reply flagged `offerCreateWallet`. */
  onOpenWalletCreator: () => void;
}

/**
 * One row of the chat thread.
 *
 * Extracted from the screen so ai-chat.tsx stays under the 300-line limit and
 * so the swipe/tombstone decision tree lives next to the components it picks
 * between, rather than inside a render callback.
 *
 * Memoized (export below): callers pass stable callbacks, so a row re-renders
 * only when its own message or flags change.
 */
function ChatMessageRowView({
  message,
  walletById,
  categoryById,
  budgetByCategoryCurrency,
  confirming,
  closeSignal,
  onConfirm,
  onTriggerEdit,
  onTriggerDelete,
  onPressHistory,
  onOpenBudgetWizard,
  onOpenManualEntry,
  onCreateWallet,
  onOpenWalletCreator,
}: ChatMessageRowProps) {
  const wallet = message.action ? walletById.get(message.action.payload.wallet_id ?? "") : undefined;
  const currency = wallet?.currency ?? FALLBACK_CURRENCY;
  const budget = message.action
    ? budgetByCategoryCurrency.get(`${message.action.payload.category_id}|${currency}`)
    : undefined;
  const category = message.action ? categoryById.get(message.action.payload.category_id) : undefined;
  const kind = tombstoneKind(message);
  const walletName = wallet?.name ?? (message.action?.payload.wallet_id === null ? NO_WALLET_LABEL : "Ví");
  // A proposal without a VND Wallet opens the edit form instead of saving
  // (spec AC-31, AC-32).
  const walletRequired = message.action ? !isSavableProposal(message.action.payload, walletById) : false;
  const categoryName = category?.name ?? "Danh mục";
  const onEdit = isEditLocked(message) ? undefined : () => onTriggerEdit(message);
  const onDelete = isRemovable(message) ? () => onTriggerDelete(message) : undefined;

  const menu = useHoldMenu();
  const menuActions = useMessageActions({
    message,
    proposal: message.action ? { categoryName, walletName, currency } : undefined,
    onEdit,
    onDelete,
    // Only the User's own words make sense as a phrase to type again.
    phraseActions: message.role === "user",
  });

  return (
    <SwipeableMessageRow
      // User bubbles are right-aligned, assistant bubbles left-aligned, so
      // each is dragged away from the edge it already sits on.
      direction={message.role === "user" ? "left" : "right"}
      disabled={isEditLocked(message)}
      onTriggerEdit={() => onTriggerEdit(message)}
      onTriggerDelete={onDelete}
      closeSignal={closeSignal}
      locked={menu.visible}
    >
      {/* A tombstone speaks for itself — see ChatBubble on the empty text. */}
      <ChatBubble
        role={message.role}
        text={kind ? "" : message.text}
        testID={`msg-chat-${message.id}`}
        onLongPress={menuActions.length > 0 ? menu.open : undefined}
      >
        {kind && message.action ? (
          <TransactionTombstoneCard
            kind={kind}
            payload={message.action.payload}
            categoryName={categoryName}
            currency={currency}
            removedAt={message.removedAt}
            onPressHistory={() => onPressHistory(message)}
          />
        ) : message.action && !message.superseded ? (
          <TransactionActionCard
            action={message.action}
            budgetLimit={budget?.amount_limit}
            budgetSpent={budget?.spent}
            walletName={walletName}
            categoryName={categoryName}
            categoryIcon={category?.icon}
            categoryIconUrl={category?.icon_url}
            currency={currency}
            confirmed={Boolean(message.confirmed)}
            saving={confirming}
            onConfirm={() => (walletRequired ? onTriggerEdit(message) : onConfirm(message))}
            walletRequired={walletRequired}
            onCreateWallet={onCreateWallet}
            testIDSuffix={message.id}
            edited={message.edited}
            onPressHistory={message.editHistory ? () => onPressHistory(message) : undefined}
          />
        ) : message.actionType === "budget_wizard" ? (
          <BudgetWizardCard
            submitted={Boolean(message.budgetWizardSubmitted)}
            createdCount={message.budgetWizardCreatedCount}
            onPress={() => onOpenBudgetWizard(message)}
          />
        ) : message.offerManualEntry ? (
          <ManualEntryButton onPress={onOpenManualEntry} />
        ) : message.offerCreateWallet ? (
          <CreateWalletButton onPress={onOpenWalletCreator} />
        ) : null}
      </ChatBubble>
      <ActionPopover
        visible={menu.visible}
        anchor={menu.anchor}
        align={message.role === "user" ? "right" : "left"}
        onClose={menu.close}
        actions={menuActions}
      />
    </SwipeableMessageRow>
  );
}

export const ChatMessageRow = memo(ChatMessageRowView);
