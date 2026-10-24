import { useMutation } from "@tanstack/react-query";

import { apiClient } from "@/lib/axios";
import { PasswordResetRequestBody } from "@/features/auth/types";

// POST /auth/password-reset/request — no session. 200 with no data whether or
// not the identifier has an account (the server never says which), so
// success only means "if there is an account, a code is on its way".
export function useRequestPasswordResetMutation() {
  return useMutation({
    mutationFn: async (body: PasswordResetRequestBody): Promise<void> => {
      await apiClient.post("/auth/password-reset/request", body);
    },
  });
}
