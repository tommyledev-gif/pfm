import { IntentionItemState } from "@/features/spending-intentions/types";
import { useChatStore } from "@/stores/chat-store";

/**
 * Writes what became of one draft of an intention card onto its chat message.
 * Read from the store at the moment of the write, never from a render: two
 * drafts saved one after the other (Save all) would otherwise each start from
 * the same old list and the second would undo the first.
 */
export function setIntentionState(messageId: string, index: number, next: IntentionItemState): void {
  const store = useChatStore.getState();
  const message = store.thread.find((m) => m.id === messageId);
  const states = [...(message?.intentionStates ?? [])];
  while (states.length <= index) states.push({});
  states[index] = next;
  store.updateMessage(messageId, { intentionStates: states });
}
