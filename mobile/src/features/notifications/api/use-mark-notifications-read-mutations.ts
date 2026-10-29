import { InfiniteData, QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/axios";
import { useToastStore } from "@/stores/toast-store";
import { ListNotificationsResult } from "@/features/notifications/types";

type NotificationPages = InfiniteData<ListNotificationsResult, string | undefined>;

const READ_ALL_FAILED = "Chưa đánh dấu được. Thử lại sau.";

// Flips is_read in the paged lists already in the cache, without refetching
// them: a refetch would reorder nothing but re-render every row, and the
// screen decides itself when a dot goes away (useSeenNotifications).
export function markReadInCache(queryClient: QueryClient, ids: ReadonlySet<string> | "all") {
  queryClient.setQueriesData<NotificationPages>({ queryKey: ["notifications", "pages"] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            data: page.data.map((n) => (!n.is_read && (ids === "all" || ids.has(n.id)) ? { ...n, is_read: true } : n)),
          })),
        }
      : data,
  );
}

/**
 * POST /notifications/read — the rows the Notifications screen has shown.
 * Seeing a notification counts as reading it. Only the bell's dot is
 * refetched; the list is updated in place.
 */
export function useMarkNotificationsSeenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await apiClient.post("/notifications/read", { ids });
    },
    onSuccess: (_data, ids) => {
      markReadInCache(queryClient, new Set(ids));
      void queryClient.invalidateQueries({ queryKey: ["notifications", "has-unread"] });
    },
  });
}

/** POST /notifications/read-all — the screen's "Đánh dấu đã đọc". Optimistic. */
export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.post("/notifications/read-all");
    },
    onMutate: () => markReadInCache(queryClient, "all"),
    onError: () => useToastStore.getState().show(READ_ALL_FAILED, "warning"),
    // Success or failure, the server's answer replaces the optimistic one.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
