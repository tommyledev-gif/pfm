import { useCallback, useState } from "react";
import { Keyboard } from "react-native";

import { isEditLocked } from "@/features/ai-chat/edit-lock";
import { isTombstone } from "@/features/ai-chat/tombstone";
import { ChatMessage } from "@/features/ai-chat/types";

// Gives the input bar's margin time to settle back to its closed-keyboard
// value before a modal opens on top of it, so the sheet does not visibly jump
// as the keyboard closes.
const KEYBOARD_DISMISS_SETTLE_MS = 280;

/**
 * Every "something is open on top of the thread" flag, in one place.
 *
 * Extracted from `ai-chat.tsx` rather than left inline: the screen was
 * already at CLAUDE.md's 300-line cap before the mode switcher, and seven
 * pieces of modal bookkeeping were the largest thing in it that the screen
 * itself did not need to read.
 */
export function useChatOverlays() {
  // A plain bubble opens a text editor; any transaction proposal opens the
  // structured form (editAction decides whether that patches a real
  // transaction or only the unconfirmed proposal).
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editingActionMessage, setEditingActionMessage] = useState<ChatMessage | null>(null);
  const [historyMessage, setHistoryMessage] = useState<ChatMessage | null>(null);
  // A removed proposal opens the full transaction history sheet rather than
  // the proposal-only edit trail — see TransactionHistoryDrawer.
  const [tombstoneMessage, setTombstoneMessage] = useState<ChatMessage | null>(null);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [budgetWizardOpen, setBudgetWizardOpen] = useState(false);
  const [budgetWizardOriginMessageId, setBudgetWizardOriginMessageId] = useState<string | null>(null);

  const openHistory = useCallback((message: ChatMessage) => {
    if (isTombstone(message)) setTombstoneMessage(message);
    else setHistoryMessage(message);
  }, []);

  const openEditTarget = useCallback((item: ChatMessage) => {
    if (isEditLocked(item)) return;
    if (item.action) setEditingActionMessage(item);
    else setEditingMessage(item);
  }, []);

  // If the keyboard is open while the user swipes a bubble above it, dismiss
  // it first and let the input bar settle before the modal opens on top —
  // otherwise the sheet visibly jumps as the keyboard closes underneath it.
  // Read at tap time, so the screen does not re-render on every keyboard event.
  const triggerEdit = useCallback(
    (item: ChatMessage) => {
      if (Keyboard.isVisible()) {
        Keyboard.dismiss();
        setTimeout(() => openEditTarget(item), KEYBOARD_DISMISS_SETTLE_MS);
      } else {
        openEditTarget(item);
      }
    },
    [openEditTarget],
  );

  const openBudgetWizard = useCallback((originMessageId: string | null) => {
    setBudgetWizardOriginMessageId(originMessageId);
    setBudgetWizardOpen(true);
  }, []);

  return {
    editingMessage,
    editingActionMessage,
    historyMessage,
    tombstoneMessage,
    manualEntryOpen,
    budgetWizardOpen,
    budgetWizardOriginMessageId,
    setEditingMessage,
    setEditingActionMessage,
    setHistoryMessage,
    setTombstoneMessage,
    setManualEntryOpen,
    setBudgetWizardOpen,
    openHistory,
    openEditTarget,
    triggerEdit,
    openBudgetWizard,
  };
}
