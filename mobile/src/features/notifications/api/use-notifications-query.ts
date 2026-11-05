import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ListNotificationsResult } from "@/features/notifications/types";

// One page of GET /notifications/ (cursor-paginated; the server's default
// page is 20, its max 100).
async function fetchNotificationsPage(params: { unreadOnly: boolean; cursor?: string; limit?: number }) {
  const res = await apiClient.get<{ success: boolean; message: string; data?: ListNotificationsResult }>(
    "/notifications/",
    {
      params: {
        ...(params.unreadOnly ? { is_read: "false" } : {}),
        ...(params.cursor ? { cursor: params.cursor } : {}),
        ...(params.limit ? { limit: params.limit } : {}),
      },
    },
  );
  return unwrap(res.data);
}

/** The first page only — what the Notifications screen showed before paging. */
export function useNotificationsQuery(unreadOnly: boolean) {
  return useQuery({
    queryKey: ["notifications", { unreadOnly }],
    queryFn: () => fetchNotificationsPage({ unreadOnly }),
  });
}

/**
 * Every page, loaded as the list scrolls (fetchNextPage from onEndReached).
 * The first-page hook above stopped at 20: anything older could never be
 * reached. Under the same "notifications" key prefix, so marking one read
 * (use-mark-notification-read-mutation) refreshes this too.
 */
//
// Switching Tất cả / Chưa đọc keeps the other list as placeholder data, so the
// header's "mark all read" holds still; the screen shows a skeleton in the
// list meanwhile (isPlaceholderData), not the other filter's rows.
export function useNotificationsInfiniteQuery(unreadOnly: boolean) {
  return useInfiniteQuery({
    queryKey: ["notifications", "pages", { unreadOnly }],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchNotificationsPage({ unreadOnly, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.pagination.next_cursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}

/**
 * Whether anything is unread — the bell's dot. One row is enough to know,
 * where the dot used to fetch a whole page of 20 just to test for one.
 */
export function useHasUnreadNotifications(): boolean {
  const unread = useQuery({
    queryKey: ["notifications", "has-unread"],
    queryFn: () => fetchNotificationsPage({ unreadOnly: true, limit: 1 }),
  });
  return (unread.data?.data.length ?? 0) > 0;
}
