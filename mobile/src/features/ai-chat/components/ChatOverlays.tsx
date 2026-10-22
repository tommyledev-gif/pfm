import { memo } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EditHistoryDialog } from "@/features/ai-chat/components/EditHistoryDialog";
import { EditMessageModal } from "@/features/ai-chat/components/EditMessageModal";
import { EditTransactionModal } from "@/features/ai-chat/components/EditTransactionModal";
import { TransactionHistoryDrawer } from "@/features/ai-chat/components/TransactionHistoryDrawer";
import { removalDialogCopy } from "@/features/ai-chat/removal-copy";
import { TransactionRemoval } from "@/features/ai-chat/components/use-transaction-removal";
import { tombstoneKind } from "@/features/ai-chat/tombstone";
import { BudgetWizardModal } from "@/features/budget-wizard/components/BudgetWizardModal";
import { TransactionFormModal } from "@/features/transactions/components/TransactionFormModal";
import { Category } from "@/features/categories/types";
import { ChatMessage, SavedProposalPatch, TransactionActionPayload } from "@/features/ai-chat/types";
import { Wallet } from "@/features/wallets/types";

const FALLBACK_CURRENCY = "VND";

interface ChatOverlaysProps {
  walletById: Map<string, Wallet>;
  categoryById: Map<string, Category>;
  removal: TransactionRemoval;
  editingMessage: ChatMessage | null;
  editingActionMessage: ChatMessage | null;
  historyMessage: ChatMessage | null;
  tombstoneMessage: ChatMessage | null;
  manualEntryOpen: boolean;
  budgetWizardOpen: boolean;
  onCloseEditingMessage: () => void;
  onSaveEditingMessage: (text: string) => void;
  onCloseEditingAction: () => void;
  onSaveEditingAction: (payload: TransactionActionPayload, savedPatch: SavedProposalPatch) => void;
  onCloseHistory: () => void;
  onCloseTombstone: () => void;
  onCloseManualEntry: () => void;
  onCloseBudgetWizard: () => void;
  onBudgetWizardCompleted: (createdCount: number) => void;
}

/**
 * Every sheet, modal and dialog the chat screen can raise.
 *
 * Grouped out of the screen so that file stays under the 300-line limit — it
 * is a flat list of overlays with no logic of its own beyond resolving the
 * currency each one should display in.
 */
export const ChatOverlays = memo(function ChatOverlays({
  walletById,
  categoryById,
  removal,
  editingMessage,
  editingActionMessage,
  historyMessage,
  tombstoneMessage,
  manualEntryOpen,
  budgetWizardOpen,
  onCloseEditingMessage,
  onSaveEditingMessage,
  onCloseEditingAction,
  onSaveEditingAction,
  onCloseHistory,
  onCloseTombstone,
  onCloseManualEntry,
  onCloseBudgetWizard,
  onBudgetWizardCompleted,
}: ChatOverlaysProps) {
  const currencyFor = (message: ChatMessage | null): string =>
    message?.action ? walletById.get(message.action.payload.wallet_id ?? "")?.currency ?? FALLBACK_CURRENCY : FALLBACK_CURRENCY;

  const removalCopy = removalDialogCopy(removal.target, removal.targetIsPersisted, {
    currency: currencyFor(removal.target),
    resolveCategoryName: (id) => categoryById.get(id)?.name,
  });

  return (
    <>
      <EditMessageModal
        visible={Boolean(editingMessage)}
        initialText={editingMessage?.text ?? ""}
        onCancel={onCloseEditingMessage}
        onSave={onSaveEditingMessage}
      />

      <EditTransactionModal
        visible={Boolean(editingActionMessage)}
        payload={editingActionMessage?.action?.payload ?? null}
        confirmed={Boolean(editingActionMessage?.confirmed)}
        transactionId={editingActionMessage?.transactionId ?? null}
        vndOnly={!editingActionMessage?.confirmed}
        onClose={onCloseEditingAction}
        onSave={onSaveEditingAction}
      />

      <EditHistoryDialog
        visible={Boolean(historyMessage)}
        history={historyMessage?.editHistory ?? []}
        currency={currencyFor(historyMessage)}
        onClose={onCloseHistory}
      />

      <TransactionFormModal visible={manualEntryOpen} onClose={onCloseManualEntry} />

      <ConfirmDialog
        visible={removal.target !== null}
        title={removalCopy.title}
        message={removalCopy.message}
        confirmLabel={removalCopy.confirmLabel}
        loading={removal.deleting}
        onCancel={removal.cancel}
        onConfirm={removal.confirm}
      />

      <TransactionHistoryDrawer
        message={tombstoneMessage}
        kind={tombstoneMessage ? tombstoneKind(tombstoneMessage) : null}
        currency={currencyFor(tombstoneMessage)}
        resolveCategoryName={(id) => categoryById.get(id)?.name ?? "Danh mục"}
        resolveWalletName={(id) => walletById.get(id)?.name ?? "Ví"}
        onClose={onCloseTombstone}
      />

      <BudgetWizardModal
        visible={budgetWizardOpen}
        onClose={onCloseBudgetWizard}
        onCompleted={onBudgetWizardCompleted}
      />
    </>
  );
});
