import { useMutation } from "@tanstack/react-query";

import { apiClient } from "@/lib/axios";

export interface RequestAccessBody {
  email: string;
  admin_email: string;
}

// POST /auth/access-requests — no session. 202 with no data, also when the
// email already has an account (the server never says which), so success
// only means "an admin with that email will see it".
export function useRequestAccessMutation() {
  return useMutation({
    mutationFn: async (body: RequestAccessBody): Promise<void> => {
      await apiClient.post("/auth/access-requests", body);
    },
  });
}
