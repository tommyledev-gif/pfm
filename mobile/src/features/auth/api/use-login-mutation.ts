import { useMutation } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { LoginRequest, LoginResponse } from "@/features/auth/types";

// Returns the token pair only — committing it is the caller's job
// (features/accounts/complete-login.ts): a plain login and "+ Thêm tài khoản"
// while another User is active commit differently, and the switch token can
// only be requested once the new session is the current one
// (specs/mobile-account-switch plan.md Findings #7/#8).
export function useLoginMutation() {
  return useMutation({
    mutationFn: async (body: LoginRequest): Promise<LoginResponse> => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: LoginResponse }>(
        "/auth/login",
        body,
      );
      return unwrap(res.data);
    },
  });
}
