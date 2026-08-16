import { useMutation } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { ChatRequest, ChatResponse } from "@/features/ai-chat/types";

async function sendChatMessage(req: ChatRequest): Promise<ChatResponse> {
  const { data } = await apiClient.post<ApiEnvelope<ChatResponse>>("/ai/chat", req);
  return unwrap(data);
}

// Not idempotent — every call may consult a live LLM and always persists a
// fresh chat_messages pair; resending the same message is a new proposal,
// not a replay (specs/ai-chat-assistant/plan.md §4 Constitution Notes).
export function useSendChatMessageMutation() {
  return useMutation({ mutationFn: sendChatMessage });
}
