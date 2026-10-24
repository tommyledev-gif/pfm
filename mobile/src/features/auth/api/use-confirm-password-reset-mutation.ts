import { useMutation } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import { LoginResult, PasswordResetConfirmBody } from "@/features/auth/types";

// POST /auth/password-reset/confirm — no session. Returns the same pair as a
// password login; committing it (completeLogin) is the caller's job.
export function useConfirmPasswordResetMutation() {
  return useMutation({
    mutationFn: async (body: PasswordResetConfirmBody): Promise<LoginResult> => {
      const res = await apiClient.post<ApiEnvelope<LoginResult>>("/auth/password-reset/confirm", body);
      return unwrap(res.data);
    },
  });
}
