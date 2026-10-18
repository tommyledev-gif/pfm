import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ChatMessage } from "@/features/ai-chat/types";

// Exported so chat-store.ts can keep this cache entry in step with what it
// last pushed — see the setQueryData call there. Keyed by User: one account's
// late sync must never land in another account's entry.
export const chatThreadQueryKey = (userId: string) => ["chat-thread", userId] as const;

interface ChatThreadMessageWire {
  client_message_id: string;
  payload: ChatMessage;
}

// Plain async functions, not just hook exports — stores/chat-store.ts's own
// debounced autosave and settings.tsx's best-effort logout flush both run
// outside any React component, so they call these directly (same precedent
// as features/auth/api/use-refresh-mutation.ts's refreshTokenRequest).

// Bulk-upserts the caller's entire current thread, keyed by each message's
// own client-generated id — cheap enough to resend in full given a chat
// thread's size, and it sidesteps ever tracking a separate "dirty since last
// sync" set client-side.
export async function syncChatThreadRequest(messages: ChatMessage[]): Promise<void> {
  const body = {
    messages: messages.map((m): ChatThreadMessageWire => ({ client_message_id: m.id, payload: withoutDevicePath(m) })),
  };
  await apiClient.post("/ai/chat/thread/sync", body);
}

// Restores a device's synced thread — used once, on ai-chat.tsx mount, only
// when the local (AsyncStorage-persisted) thread is empty, i.e. after a
// logout/reinstall/new device wiped it.
// ⚠️ A photo never leaves the device: its message syncs as the caption only,
// without the file path (specs/ai-chat-image-capture AC-23). Another device
// shows a placeholder (AC-24).
function withoutDevicePath(message: ChatMessage): ChatMessage {
  if (!message.imageCapture?.localUri) return message;
  return { ...message, imageCapture: { caption: message.imageCapture.caption } };
}

export async function fetchChatThreadRequest(): Promise<ChatMessage[]> {
  const res = await apiClient.get<{ success: boolean; message: string; data?: { messages: ChatThreadMessageWire[] } }>(
    "/ai/chat/thread",
  );
  const data = unwrap(res.data);
  return data.messages.map((m) => m.payload);
}

/**
 * ⚠️ The cached result of this outlives the chat screen. The screen unmounts on
 * every bottom-nav tab change while the QueryClient does not, so `data` is
 * still sitting here — a snapshot of the thread as the SERVER had it at fetch
 * time — when the screen mounts again. Anything consuming it has to decide
 * whether it still wants it; `data` being present says nothing about it being
 * newer than the local thread. See chat-store's hydrateThread.
 */
export function useChatThreadQuery(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: chatThreadQueryKey(userId ?? ""),
    queryFn: fetchChatThreadRequest,
    enabled: enabled && userId !== null,
  });
}
