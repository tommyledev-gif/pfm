import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { SearchUsersResult } from "@/features/security/types";

export const ACCOUNT_SEARCH_KEY = "account-search";

// GET /admin/users/search?q= — the account deletion tool's search box.
// Matches email or tên đăng nhập; the caller's own account is never in it.
// Pass an already-debounced query: every distinct value is a request.
export function useAccountSearchQuery(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: [ACCOUNT_SEARCH_KEY, q],
    enabled: q.length > 0,
    // Keeps the previous results on screen while the next query loads, so
    // the list does not blink empty on every keystroke.
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: SearchUsersResult }>(
        "/admin/users/search",
        { params: { q } },
      );
      return unwrap(res.data).data;
    },
  });
}
