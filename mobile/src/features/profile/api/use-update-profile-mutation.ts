import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import { applyProfile } from "@/features/profile/api/apply-profile";
import { User } from "@/features/users/types";

// PATCH /users/me — the display name, the only field this endpoint takes. The
// server cleans the name (spacing, Unicode form) and answers with the stored
// one, which is what gets shown.
export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fullName: string) =>
      unwrap((await apiClient.patch<ApiEnvelope<User>>("/users/me", { full_name: fullName })).data),
    onSuccess: (user) => applyProfile(queryClient, user),
  });
}
