import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ChatMessage } from "@/features/ai-chat/types";

interface ChatThreadMessageWire {
  client_message_id: string;
  payload: ChatMessage;
}

// Plain async functions, not just hook exports — stores/chat-store.ts's own
// debounced autosave and profile.tsx's best-effort logout flush both run
// outside any React component, so they call these directly (same precedent
// as features/auth/api/use-refresh-mutation.ts's refreshTokenRequest).

// Bulk-upserts the caller's entire current thread, keyed by each message's
// own client-generated id — cheap enough to resend in full given a chat
// thread's size, and it sidesteps ever tracking a separate "dirty since last
// sync" set client-side.
export async function syncChatThreadRequest(messages: ChatMessage[]): Promise<void> {
  const body = {
    messages: messages.map((m): ChatThreadMessageWire => ({ client_message_id: m.id, payload: m })),
  };
  await apiClient.post("/ai/chat/thread/sync", body);
}

// Restores a device's synced thread — used once, on ai-chat.tsx mount, only
// when the local (AsyncStorage-persisted) thread is empty, i.e. after a
// logout/reinstall/new device wiped it.
export async function fetchChatThreadRequest(): Promise<ChatMessage[]> {
  const res = await apiClient.get<{ success: boolean; message: string; data?: { messages: ChatThreadMessageWire[] } }>(
    "/ai/chat/thread",
  );
  const data = unwrap(res.data);
  return data.messages.map((m) => m.payload);
}

export function useChatThreadQuery(enabled: boolean) {
  return useQuery({
    queryKey: ["chat-thread"],
    queryFn: fetchChatThreadRequest,
    enabled,
  });
}
