import { useEffect, useRef } from "react";
import { Image } from "expo-image";

import { openMojiUrlForIcon } from "@/lib/openmoji";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";

/**
 * Warms expo-image's memory+disk cache with every icon the user's own
 * categories and wallets use — their OpenMoji artwork and any uploaded photo
 * — as soon as those lists load.
 *
 * Those icons appear on nearly every screen (transaction rows, the wallet
 * carousel, the category picker), so fetching them up front means the first
 * list the user opens draws them from cache instead of loading row by row.
 * Only the user's real set, not a guessed "popular" list: a guess would spend
 * bandwidth on icons the user never sees.
 *
 * Each URL is prefetched once per session; the cache itself persists on disk
 * across launches, where a prefetch of a cached URL is a no-op anyway.
 */
export function usePrefetchRecordIcons() {
  const categories = useCategoriesQuery();
  const wallets = useWalletsQuery();
  const prefetched = useRef(new Set<string>());

  useEffect(() => {
    const records = [...(categories.data ?? []), ...(wallets.data ?? [])];
    const urls: string[] = [];
    for (const record of records) {
      for (const url of [record.icon_url, openMojiUrlForIcon(record.icon)]) {
        if (url && !prefetched.current.has(url)) {
          prefetched.current.add(url);
          urls.push(url);
        }
      }
    }
    if (urls.length > 0) void Image.prefetch(urls, "memory-disk");
  }, [categories.data, wallets.data]);
}
