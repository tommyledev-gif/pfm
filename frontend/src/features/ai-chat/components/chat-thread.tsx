"use client";

import { useState } from "react";

import { useSendChatMessageMutation } from "@/features/ai-chat/api/use-send-chat-message-mutation";
import { ChatInput } from "@/features/ai-chat/components/chat-input";
import { ChatMessageBubble } from "@/features/ai-chat/components/chat-message-bubble";
import type { ChatThreadItem } from "@/features/ai-chat/types";
import { getErrorMessage } from "@/lib/axios";

// The thread is client-only state, not TanStack Query cache (see
// features/ai-chat/types.ts) — every POST /ai/chat call is independently
// evaluated (specs/ai-chat-assistant/spec.md Resolved design decision #6),
// so there is nothing here to invalidate/refetch, only to append to.
export function ChatThread() {
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [thread, setThread] = useState<ChatThreadItem[]>([]);
  const { mutate: sendMessage, isPending } = useSendChatMessageMutation();

  function handleSend(message: string) {
    setThread((prev) => [...prev, { kind: "user", id: crypto.randomUUID(), content: message }]);

    sendMessage(
      { message, conversation_id: conversationId },
      {
        onSuccess: (resp) => {
          setConversationId(resp.conversation_id);
          setThread((prev) => [
            ...prev,
            { kind: "assistant", id: crypto.randomUUID(), content: resp.message, actions: resp.actions },
          ]);
        },
        onError: (err) => {
          setThread((prev) => [
            ...prev,
            {
              kind: "error",
              id: crypto.randomUUID(),
              message: getErrorMessage(err, "The assistant is temporarily unavailable, please try again."),
            },
          ]);
        },
      },
    );
  }

  return (
    <div className="flex h-[70vh] flex-col gap-4">
      <div className="flex-1 space-y-3 overflow-y-auto rounded-md border p-4">
        {thread.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Xin chào! Ghi lại chi tiêu của bạn bằng cách nhắn tin tự nhiên, ví dụ &quot;ăn trưa 50k&quot;.
          </p>
        )}
        {thread.map((item) => (
          <ChatMessageBubble key={item.id} item={item} />
        ))}
        {isPending && (
          <div data-testid="indicator-chat-loading" className="text-sm text-muted-foreground">
            Đang xử lý...
          </div>
        )}
      </div>
      <ChatInput onSend={handleSend} disabled={isPending} />
    </div>
  );
}
