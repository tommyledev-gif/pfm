import { useMutation } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ChatRequest, ChatResponse } from "@/features/ai-chat/types";

export function useSendChatMessageMutation() {
  return useMutation({
    mutationFn: async (body: ChatRequest) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: ChatResponse }>(
        "/ai/chat",
        body,
      );
      return unwrap(res.data);
    },
  });
}
