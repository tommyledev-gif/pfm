import type { QueryCacheNotifyEvent } from "@tanstack/react-query";
import {
  persistQueryClientRestore,
  persistQueryClientSave,
  type Persister,
} from "@tanstack/react-query-persist-client";

import { QUERY_CACHE_MAX_AGE_MS, QUERY_CACHE_PERSIST_THROTTLE_MS } from "@/lib/constants";
import { queryClient } from "@/lib/query-client";
import { PERSISTENCE_BUSTER, shouldPersistQuery } from "@/lib/query-persistence/persist-policy";
import { createUserCachePersister, type UserCachePersister } from "@/lib/query-persistence/user-cache-persister";

// Deliberately free of any session-store import: session-store calls
// detachQueryPersistence() itself, before it clears the cache.

interface Attachment {
  userId: string;
  persister: UserCachePersister;
  unsubscribe: (() => void) | null;
  timer: ReturnType<typeof setTimeout> | null;
  restored: Promise<void>;
}

const PERSIST_EVENT_TYPES: readonly QueryCacheNotifyEvent["type"][] = ["added", "removed", "updated"];

let current: Attachment | null = null;

function isCurrent(attachment: Attachment): boolean {
  return current === attachment;
}

// Throttled BEFORE dehydrating (not only before writing, as the stock
// persistQueryClientSubscribe does): a burst of cache events costs one
// dehydrate, and detaching only has to cancel one timer.
function subscribeThrottled(attachment: Attachment): () => void {
  const save = () => {
    attachment.timer = null;
    if (!isCurrent(attachment)) return;
    void persistQueryClientSave({
      queryClient,
      persister: attachment.persister,
      buster: PERSISTENCE_BUSTER,
      dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
    }).catch(() => {});
  };
  return queryClient.getQueryCache().subscribe((event) => {
    if (!PERSIST_EVENT_TYPES.includes(event.type) || attachment.timer) return;
    attachment.timer = setTimeout(save, QUERY_CACHE_PERSIST_THROTTLE_MS);
  });
}

/**
 * Restores `userId`'s saved cache into the (already cleared) query client,
 * then keeps saving it (US-03, BR-OFF-P05). Resolves when the restore is
 * done. A newer attach or a detach while the read is in flight wins: the
 * stale read is dropped, never hydrated under the next User (EC-OFF-09).
 */
export function attachQueryPersistence(userId: string): Promise<void> {
  if (current?.userId === userId) return current.restored;
  if (current) void detachQueryPersistence({ remove: false });

  const persister = createUserCachePersister(userId);
  const attachment: Attachment = { userId, persister, unsubscribe: null, timer: null, restored: Promise.resolve() };
  current = attachment;
  const guarded: Persister = {
    persistClient: persister.persistClient,
    removeClient: persister.removeClient,
    restoreClient: async () => {
      const client = await persister.restoreClient();
      return isCurrent(attachment) ? client : undefined;
    },
  };
  attachment.restored = persistQueryClientRestore({
    queryClient,
    persister: guarded,
    maxAge: QUERY_CACHE_MAX_AGE_MS,
    buster: PERSISTENCE_BUSTER,
  })
    .catch(() => {})
    .then(() => {
      if (isCurrent(attachment)) attachment.unsubscribe = subscribeThrottled(attachment);
    });
  return attachment.restored;
}

/**
 * Stops saving the current User's cache. MUST run before queryClient.clear():
 * the clear itself would otherwise be saved as that User's (empty) cache.
 * Everything that matters happens synchronously, before the first await, so
 * a caller that does not await is still safe. `remove` deletes the saved
 * copy (sign-out, S-OFF-18); an account switch keeps it (EC-OFF-09).
 */
export async function detachQueryPersistence({ remove }: { remove: boolean }): Promise<void> {
  const attachment = current;
  if (!attachment) return;
  current = null;
  attachment.unsubscribe?.();
  if (attachment.timer) clearTimeout(attachment.timer);
  attachment.timer = null;
  await attachment.persister.close();
  if (remove) await attachment.persister.removeClient();
}
