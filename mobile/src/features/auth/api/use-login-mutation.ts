import { useMutation } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { useSessionStore } from "@/stores/session-store";
import { LoginRequest, LoginResponse } from "@/features/auth/types";

export function useLoginMutation() {
  const setTokens = useSessionStore((s) => s.setTokens);
  return useMutation({
    mutationFn: async (body: LoginRequest) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: LoginResponse }>(
        "/auth/login",
        body,
      );
      return unwrap(res.data);
    },
    onSuccess: async (data, variables) => {
      await setTokens(data.access_token, data.refresh_token, variables.email);
    },
  });
}
