import { useMutation } from "@tanstack/react-query";

import { apiClient } from "@/lib/axios";
import { PasswordResetVerifyBody } from "@/features/auth/types";

// POST /auth/password-reset/verify — no session. Checks the code before the
// new password is asked for; a right code stays usable for /confirm, a wrong
// one spends a try (RESET_CODE_INVALID).
export function useVerifyPasswordResetMutation() {
  return useMutation({
    mutationFn: async (body: PasswordResetVerifyBody): Promise<void> => {
      await apiClient.post("/auth/password-reset/verify", body);
    },
  });
}
