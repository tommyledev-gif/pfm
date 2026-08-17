import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { InviteUserRequest, InviteUserResult } from "@/features/users/types";

// POST /admin/users/invite — triggers the backend's SMTP activation email
// (backend/internal/service/smtp_email_sender.go), same endpoint as
// frontend/src/features/users/api/use-invite-user-mutation.ts.
export function useInviteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: InviteUserRequest) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: InviteUserResult }>(
        "/admin/users/invite",
        body,
      );
      return unwrap(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
