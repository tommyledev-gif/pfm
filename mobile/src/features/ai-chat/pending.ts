import { ChatMessage } from "@/features/ai-chat/types";

// An AI transaction proposal still awaiting the user's decision: not yet
// saved, not replaced by a later correction, not discarded or deleted.
// Shared by Home's pending section and the full pending-review screen so the
// two can never disagree about what is still waiting.
export function isPendingProposal(message: ChatMessage): boolean {
  return Boolean(message.action) && !message.confirmed && !message.superseded && !message.removalState;
}
