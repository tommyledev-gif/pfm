import { ConfirmationCard } from "@/features/ai-chat/components/confirmation-card";
import type { ChatThreadItem } from "@/features/ai-chat/types";

interface ChatMessageBubbleProps {
  item: ChatThreadItem;
}

export function ChatMessageBubble({ item }: ChatMessageBubbleProps) {
  if (item.kind === "user") {
    return (
      <div
        data-testid="bubble-chat-user"
        className="ml-auto max-w-[80%] rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        {item.content}
      </div>
    );
  }

  if (item.kind === "error") {
    return (
      <div
        data-testid="banner-chat-error"
        className="max-w-[80%] rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive"
      >
        {item.message}
      </div>
    );
  }

  return (
    <div className="max-w-[80%] space-y-3">
      <div data-testid="bubble-chat-assistant" className="rounded-lg bg-muted px-4 py-2 text-sm">
        {item.content}
      </div>
      {item.actions.map((action) => (
        <ConfirmationCard key={action.idempotency_key} action={action} />
      ))}
    </div>
  );
}
