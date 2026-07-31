import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { InviteUserRequest, InviteUserResult } from "@/features/users/types";

async function inviteUser(req: InviteUserRequest): Promise<InviteUserResult> {
  const { data } = await apiClient.post<ApiEnvelope<InviteUserResult>>("/admin/users/invite", req);
  return unwrap(data);
}

// Sends the invite request that triggers the backend's SMTP activation email
// (backend/internal/service/smtp_email_sender.go) — invalidates the users
// list on success rather than manually patching cached query data.
export function useInviteUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: inviteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
