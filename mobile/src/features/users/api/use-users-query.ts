import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ListUsersResult } from "@/features/users/types";

// GET /admin/users — backend enforces the admin-only check server-side
// (403 for members); mobile does not gate this screen client-side, same as
// frontend/src/app/app/users/page.tsx.
export function useUsersQuery() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: ListUsersResult }>(
        "/admin/users",
      );
      return unwrap(res.data);
    },
  });
}
