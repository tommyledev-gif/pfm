import { BudgetWizardCard } from "@/features/ai-chat/components/BudgetWizardCard";
import { ChatBubble } from "@/features/ai-chat/components/ChatBubble";
import { SwipeableMessageRow } from "@/features/ai-chat/components/SwipeableMessageRow";
import { TransactionActionCard } from "@/features/ai-chat/components/TransactionActionCard";
import { TransactionTombstoneCard } from "@/features/ai-chat/components/TransactionTombstoneCard";
import { isEditLocked } from "@/features/ai-chat/edit-lock";
import { isRemovable, tombstoneKind } from "@/features/ai-chat/tombstone";
import { ChatMessage } from "@/features/ai-chat/types";
import { Category } from "@/features/categories/types";
import { Wallet } from "@/features/wallets/types";
import { ManualEntryButton } from "@/features/ai-chat/components/ManualEntryButton";

const FALLBACK_CURRENCY = "VND";

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
}

/**
 * One row of the chat thread.
 *
 * Extracted from the screen so ai-chat.tsx stays under the 300-line limit and
 * so the swipe/tombstone decision tree lives next to the components it picks
 * between, rather than inside a render callback.
 */
export function ChatMessageRow({
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
}: ChatMessageRowProps) {
  const currency = message.action
    ? walletById.get(message.action.payload.wallet_id)?.currency ?? FALLBACK_CURRENCY
    : FALLBACK_CURRENCY;
  const budget = message.action
    ? budgetByCategoryCurrency.get(`${message.action.payload.category_id}|${currency}`)
    : undefined;
  const category = message.action ? categoryById.get(message.action.payload.category_id) : undefined;
  const kind = tombstoneKind(message);

  return (
    <SwipeableMessageRow
      // User bubbles are right-aligned, assistant bubbles left-aligned, so
      // each is dragged away from the edge it already sits on.
      direction={message.role === "user" ? "left" : "right"}
      disabled={isEditLocked(message)}
      onTriggerEdit={() => onTriggerEdit(message)}
      onTriggerDelete={isRemovable(message) ? () => onTriggerDelete(message) : undefined}
      closeSignal={closeSignal}
    >
      <ChatBubble role={message.role} text={message.text}>
        {kind && message.action ? (
          <TransactionTombstoneCard
            kind={kind}
            payload={message.action.payload}
            categoryName={category?.name ?? "Danh mục"}
            currency={currency}
            removedAt={message.removedAt}
            onPressHistory={() => onPressHistory(message)}
          />
        ) : message.action && !message.superseded ? (
          <TransactionActionCard
            action={message.action}
            budgetLimit={budget?.amount_limit}
            budgetSpent={budget?.spent}
            walletName={walletById.get(message.action.payload.wallet_id)?.name ?? "Ví"}
            categoryName={category?.name ?? "Danh mục"}
            categoryIcon={category?.icon}
            categoryIconUrl={category?.icon_url}
            currency={currency}
            confirmed={Boolean(message.confirmed)}
            saving={confirming}
            onConfirm={() => onConfirm(message)}
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
        ) : null}
      </ChatBubble>
    </SwipeableMessageRow>
  );
}
