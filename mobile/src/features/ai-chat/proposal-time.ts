import { ChatMessage } from "@/features/ai-chat/types";

// When a proposal first appeared in the chat (epoch ms). Messages carry no
// timestamp of their own; the "created" entry of the edit history is the only
// record, so proposals from before that history existed return undefined
// rather than a guessed time.
export function proposalCreatedAt(message: ChatMessage): number | undefined {
  return message.editHistory?.find((entry) => entry.source === "created")?.timestamp;
}

// Newest proposal first. Ties and proposals with no known creation time keep
// their reverse thread order, which is itself newest-first.
export function sortProposalsNewestFirst(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .map((message, index) => ({ message, index, createdAt: proposalCreatedAt(message) }))
    .sort((a, b) => {
      if (a.createdAt !== undefined && b.createdAt !== undefined && a.createdAt !== b.createdAt) {
        return b.createdAt - a.createdAt;
      }
      return b.index - a.index;
    })
    .map(({ message }) => message);
}
