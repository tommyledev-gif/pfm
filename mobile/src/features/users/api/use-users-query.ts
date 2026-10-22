import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ListUsersResult } from "@/features/users/types";

// GET /admin/users — backend enforces the admin-only check server-side
// (403 for members); mobile does not gate this screen client-side, same as
// frontend/src/app/app/users/page.tsx. Asks for the endpoint's maximum page:
// without a limit the server returns its default 20, and the screen never
// asked for a second page, so a household past 20 lost members off the end.
const USERS_PAGE_LIMIT = 100;
export function useUsersQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["users"],
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: ListUsersResult }>(
        "/admin/users",
        { params: { limit: USERS_PAGE_LIMIT } },
      );
      return unwrap(res.data);
    },
  });
}
