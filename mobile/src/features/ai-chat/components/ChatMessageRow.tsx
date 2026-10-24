import { memo } from "react";
import Animated from "react-native-reanimated";

import { useFreshEntrance } from "@/components/motion/use-fresh-entrance";
import { ActionPopover } from "@/components/shared/ActionPopover";
import { AI_CONFIDENCE_THRESHOLD, FALLBACK_CURRENCY, TRANSFER_CATEGORY_ICON } from "@/lib/constants";
import { BudgetWizardCard } from "@/features/ai-chat/components/BudgetWizardCard";
import { ChatBubble } from "@/features/ai-chat/components/ChatBubble";
import { SwipeableMessageRow } from "@/features/ai-chat/components/SwipeableMessageRow";
import { TransactionActionCard } from "@/features/ai-chat/components/TransactionActionCard";
import { TransactionTombstoneCard } from "@/features/ai-chat/components/TransactionTombstoneCard";
import { useHoldMenu } from "@/features/ai-chat/hooks/use-hold-menu";
import { useMessageActions } from "@/features/ai-chat/hooks/use-message-actions";
import { isEditLocked } from "@/features/ai-chat/edit-lock";
import { useAutoPinLabel } from "@/features/ai-chat/proposal-auto-pin";
import { proposalCategoryName } from "@/features/ai-chat/proposal-kind";
import { isSavableProposal, proposalLinesGap, proposalWalletName } from "@/features/ai-chat/proposal-wallet";
import { isRemovable, tombstoneKind } from "@/features/ai-chat/tombstone";
import { ChatMessage } from "@/features/ai-chat/types";
import { Category } from "@/features/categories/types";
import { Wallet } from "@/features/wallets/types";
import { ManualEntryButton } from "@/features/ai-chat/components/ManualEntryButton";
import { CreateWalletButton } from "@/features/ai-chat/components/CreateWalletButton";
import { ImageThumbnail } from "@/features/ai-chat/components/ImageThumbnail";
import { RetryImageButton } from "@/features/ai-chat/components/RetryImageButton";

// Message ids carry their creation time (message-id.ts: `msg_<ms>_<n>`).
const ID_TIME = /^msg_(\d+)_/;

/** When a message was created, read from its id; undefined if it has none. */
export function messageCreatedAt(id: string): number | undefined {
  const match = ID_TIME.exec(id);
  return match ? Number(match[1]) : undefined;
}

interface ChatMessageRowProps {
  message: ChatMessage;
  walletById: Map<string, Wallet>;
  categoryById: Map<string, Category>;
  /** Keyed "categoryId|currency" — a proposal in one currency must never be
   *  measured against a budget limit in another. */
  budgetByCategoryCurrency: Map<string, { amount_limit: number; spent: number }>;
  confirming: boolean;
  onConfirm: (message: ChatMessage) => void;
  onTriggerEdit: (message: ChatMessage) => void;
  onTriggerDelete: (message: ChatMessage) => void;
  onPressHistory: (message: ChatMessage) => void;
  onOpenBudgetWizard: (message: ChatMessage) => void;
  onOpenManualEntry: () => void;
  /** Re-sends the photo of a failed image reading. */
  onRetryImage: (message: ChatMessage) => void;
  /** Re-sends the text of a failed reply. */
  onRetryText: (message: ChatMessage) => void;
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
 *
 * A message that has just been sent or received rises in (useFreshEntrance);
 * the history already in the thread, restored or remounted, never animates.
 */
function ChatMessageRowView({
  message,
  walletById,
  categoryById,
  budgetByCategoryCurrency,
  confirming,
  onConfirm,
  onTriggerEdit,
  onTriggerDelete,
  onPressHistory,
  onOpenBudgetWizard,
  onOpenManualEntry,
  onRetryImage,
  onRetryText,
  onCreateWallet,
  onOpenWalletCreator,
}: ChatMessageRowProps) {
  const wallet = message.action ? walletById.get(message.action.payload.wallet_id ?? "") : undefined;
  const currency = wallet?.currency ?? FALLBACK_CURRENCY;
  // Only an expense spends a budget.
  const budget =
    message.action?.payload.type === "expense"
      ? budgetByCategoryCurrency.get(`${message.action.payload.category_id}|${currency}`)
      : undefined;
  const isTransfer = message.action?.payload.type === "transfer";
  // A transfer is shown under the system transfer category, never the one it
  // carried before it became one.
  const category = message.action && !isTransfer ? categoryById.get(message.action.payload.category_id) : undefined;
  const kind = tombstoneKind(message);
  const walletName = message.action ? proposalWalletName(message.action.payload, walletById) : "Ví";
  // A proposal without a VND Wallet opens the edit form instead of saving
  // (spec AC-31, AC-32).
  const walletRequired = message.action ? !isSavableProposal(message.action.payload, walletById) : false;
  // Lines that miss the amount are fixed in the edit form first (spec BR-15, AC-42).
  const mustEdit = walletRequired || (message.action ? proposalLinesGap(message.action.payload) !== 0 : false);
  // Shown until the User edits or saves the card (AC-21).
  const lowConfidence =
    Boolean(message.imageOrigin && message.action && !message.edited) &&
    (message.action?.confidence ?? 1) < AI_CONFIDENCE_THRESHOLD;
  const categoryName =
    (message.action && proposalCategoryName(message.action.payload, (id) => categoryById.get(id)?.name)) || "Danh mục";
  const onEdit = isEditLocked(message) ? undefined : () => onTriggerEdit(message);
  const onDelete = isRemovable(message) ? () => onTriggerDelete(message) : undefined;
  const locationLabel = useAutoPinLabel(message);

  const entering = useFreshEntrance(messageCreatedAt(message.id));
  const menu = useHoldMenu();
  const menuActions = useMessageActions({
    message,
    proposal: message.action ? { categoryName, walletName, currency } : undefined,
    onEdit,
    onDelete,
    // Only the User's own words make sense as a phrase to type again.
    phraseActions: message.role === "user",
  });

  const row = (
    <SwipeableMessageRow
      // User bubbles are right-aligned, assistant bubbles left-aligned, so
      // each is dragged away from the edge it already sits on.
      direction={message.role === "user" ? "left" : "right"}
      disabled={isEditLocked(message)}
      onTriggerEdit={() => onTriggerEdit(message)}
      onTriggerDelete={onDelete}
      locked={menu.visible}
    >
      {/* A tombstone speaks for itself — see ChatBubble on the empty text.
          So does a saved proposal: "1 giao dịch chờ xác nhận." is no longer
          true once it is saved, and the card already names it and its amount. */}
      <ChatBubble
        role={message.role}
        text={kind || (message.confirmed && message.action) ? "" : message.text}
        testID={`msg-chat-${message.id}`}
        onLongPress={menuActions.length > 0 ? menu.open : undefined}
        // Only while a card is actually drawn under the text.
        wide={Boolean(message.action) && (Boolean(kind) || !message.superseded)}
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
            locationLabel={locationLabel}
            categoryIcon={isTransfer ? TRANSFER_CATEGORY_ICON : category?.icon}
            categoryIconUrl={category?.icon_url}
            currency={currency}
            confirmed={Boolean(message.confirmed)}
            saving={confirming}
            onConfirm={() => (mustEdit ? onTriggerEdit(message) : onConfirm(message))}
            walletRequired={walletRequired}
            onCreateWallet={onCreateWallet}
            testIDSuffix={message.id}
            edited={message.edited}
            onPressHistory={message.editHistory ? () => onPressHistory(message) : undefined}
            lowConfidence={lowConfidence}
            reviewLineKeys={message.reviewLineKeys}
          />
        ) : message.actionType === "budget_wizard" ? (
          <BudgetWizardCard
            submitted={Boolean(message.budgetWizardSubmitted)}
            createdCount={message.budgetWizardCreatedCount}
            onPress={() => onOpenBudgetWizard(message)}
          />
        ) : message.imageCapture ? (
          <ImageThumbnail capture={message.imageCapture} messageId={message.id} />
        ) : message.retryImageMessageId || message.retryText || message.offerManualEntry ? (
          <>
            {message.retryImageMessageId ? <RetryImageButton messageId={message.id} onPress={() => onRetryImage(message)} /> : null}
            {message.retryText ? (
              <RetryImageButton kind="text" messageId={message.id} onPress={() => onRetryText(message)} />
            ) : null}
            {message.offerManualEntry ? <ManualEntryButton onPress={onOpenManualEntry} /> : null}
          </>
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
  // Decided once at mount, so the wrapper never comes or goes under a row.
  return entering ? <Animated.View entering={entering}>{row}</Animated.View> : row;
}

export const ChatMessageRow = memo(ChatMessageRowView);
