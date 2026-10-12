import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import { applyProfile } from "@/features/profile/api/apply-profile";
import { User } from "@/features/users/types";

// PUT /users/me/username — gives an account activated before tên đăng nhập
// existed (backend mig 030) its username, once; the server refuses a second
// one. It stores the lowercase form and answers with the profile.
export function useClaimUsernameMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) =>
      unwrap((await apiClient.put<ApiEnvelope<User>>("/users/me/username", { username })).data),
    onSuccess: (user) => applyProfile(queryClient, user),
  });
}
