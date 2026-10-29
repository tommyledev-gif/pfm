import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ListUsersResult, User } from "@/features/users/types";

// The endpoint's maximum page (common.MaxListLimit).
const USERS_PAGE_LIMIT = 100;

async function fetchUsersPage(params: { cursor?: string; status?: User["status"] }) {
  const res = await apiClient.get<{ success: boolean; message: string; data?: ListUsersResult }>("/admin/users", {
    params: {
      limit: USERS_PAGE_LIMIT,
      ...(params.cursor ? { cursor: params.cursor } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
  });
  return unwrap(res.data);
}

// GET /admin/users — backend enforces the admin-only check server-side
// (403 for members); mobile does not gate this screen client-side, same as
// frontend/src/app/app/users/page.tsx.
//
// Every page, loaded as the list scrolls (fetchNextPage from onEndReached).
// It used to read one page of 100 and ignore next_cursor, so past that many
// accounts the rest silently fell off the end, count included.
export function useUsersQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: ["users", "pages"],
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchUsersPage({ cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.pagination.next_cursor ?? undefined,
  });
}

/**
 * The access requests still waiting for an admin (status "requested") —
 * what the notifications screen needs to offer "Duyệt yêu cầu" / "Từ chối".
 * Its own query so the answer does not depend on how many member pages the
 * Members screen happens to have loaded. Under the "users" prefix, so
 * approving or rejecting (which invalidate ["users"]) refreshes it.
 */
export function useWaitingAccessRequestsQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["users", "requested"],
    enabled,
    queryFn: () => fetchUsersPage({ status: "requested" }),
  });
}
