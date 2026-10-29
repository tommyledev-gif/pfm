import { useCallback, useEffect, useRef, useState } from "react";
import { ViewToken } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";

import { useLatestCallback } from "@/lib/use-latest-callback";
import { useMarkNotificationsSeenMutation } from "@/features/notifications/api/use-mark-notifications-read-mutations";
import { Notification } from "@/features/notifications/types";

// Seen = most of the row on screen for half a second, not swept past.
export const SEEN_VIEWABILITY = { itemVisiblePercentThreshold: 60, minimumViewTime: 500 };
// Rows seen close together go in one request rather than one each.
const BATCH_DELAY_MS = 800;
// The endpoint's cap (dto.MarkNotificationsReadRequest).
const MAX_BATCH = 100;
const NONE: ReadonlySet<string> = new Set();

/**
 * Seeing a notification on the Notifications screen marks it read — the
 * User no longer has to tap each one. Its dot stays for the rest of this
 * visit, so "new" is still readable at a glance; leaving the screen drops
 * the dots, and coming back shows those rows as read.
 *
 * `keptUnread` is the set of rows read on the server during this visit whose
 * dot is still shown. Rows are reported by the list's onViewableItemsChanged
 * (stable identity, as FlatList requires).
 */
export function useSeenNotifications() {
  const markSeen = useMarkNotificationsSeenMutation();
  const [keptUnread, setKeptUnread] = useState<ReadonlySet<string>>(NONE);
  const queued = useRef(new Set<string>());
  const sent = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focused = useRef(false);

  const flush = useLatestCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    // Offline: dropped, not kept — the rows are still unread on the server,
    // so the next visit sees them again.
    if (!onlineManager.isOnline()) {
      queued.current.clear();
      return;
    }
    const ids = Array.from(queued.current).slice(0, MAX_BATCH);
    if (ids.length === 0) return;
    ids.forEach((id) => {
      queued.current.delete(id);
      sent.current.add(id);
    });
    markSeen.mutate(ids, { onError: () => ids.forEach((id) => sent.current.delete(id)) });
    if (queued.current.size > 0) timer.current = setTimeout(flush, BATCH_DELAY_MS);
  });

  const onViewableItemsChanged = useLatestCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (!focused.current) return;
    const fresh: string[] = [];
    for (const token of viewableItems) {
      // Section headers come through too, with no row behind them.
      const item = token.index == null ? null : (token.item as Notification | null);
      if (!item || item.is_read || sent.current.has(item.id) || queued.current.has(item.id)) continue;
      fresh.push(item.id);
    }
    if (fresh.length === 0) return;
    fresh.forEach((id) => queued.current.add(id));
    setKeptUnread((prev) => new Set([...prev, ...fresh]));
    if (!timer.current) timer.current = setTimeout(flush, BATCH_DELAY_MS);
  });

  // Leaving sends whatever was about to go and drops this visit's dots,
  // while the next screen covers this one.
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
        flush();
        setKeptUnread(NONE);
      };
    }, [flush]),
  );
  useEffect(() => () => flush(), [flush]);

  /** "Đánh dấu đã đọc": every dot goes now, not when the User leaves. */
  const clearKept = useCallback(() => {
    queued.current.clear();
    setKeptUnread(NONE);
  }, []);

  return { keptUnread, onViewableItemsChanged, clearKept };
}
