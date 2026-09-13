import { ChatMessage } from "@/features/ai-chat/types";

// Whether swipe-to-edit is closed on a bubble.
//
// The rule is structural, not a per-case list: **the only editable bubbles
// are the user's own messages and transaction proposals.** Everything the
// assistant says in prose — a failed-request apology, a clarifying question,
// a budget-wizard card, an ordinary reply — is the assistant's own words, and
// "editing" one only ever rewrote the text in place client-side without
// re-running anything. That was a no-op dressed up as a feature.
//
// Deliberately not keyed on a `failed` flag, which was the first attempt:
// chat-store.ts persists the thread to AsyncStorage and syncs it to the
// server, so every failed bubble already in a user's history predates any
// flag we add and would stay swipeable forever. Asking "what kind of bubble
// is this" needs no migration and no backfill.
//
// A transaction proposal is the one assistant bubble with real, user-owned
// content behind it — it opens EditTransactionModal, not EditMessageModal,
// and stays editable whether or not it's already confirmed.
export function isEditLocked(message: ChatMessage): boolean {
  if (message.role !== "assistant") return false;
  return !message.action;
}
