import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DehydratedState } from "@tanstack/react-query";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

import { MAX_PERSISTED_TRANSACTION_DETAILS, MAX_PERSISTED_TRANSACTION_QUERIES, QUERY_CACHE_STORAGE_KEY_PREFIX } from "@/lib/constants";
import { isTransactionDetailQueryKey, isTransactionsQueryKey } from "@/lib/query-persistence/persist-policy";

type DehydratedQuery = DehydratedState["queries"][number];

export interface UserCachePersister extends Persister {
  /** Stops every later write; resolves once a write already started has landed. */
  close: () => Promise<void>;
}

export function queryCacheStorageKey(userId: string): string {
  return `${QUERY_CACHE_STORAGE_KEY_PREFIX}${userId}`;
}

interface InfiniteData {
  pages: unknown[];
  pageParams: unknown[];
}

function isInfiniteData(data: unknown): data is InfiniteData {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as Partial<InfiniteData>;
  return Array.isArray(candidate.pages) && Array.isArray(candidate.pageParams);
}

// Only the first page of a Transactions list is kept (S-OFF-16): older pages
// would grow the blob without bound, and the list re-pages from the server.
function firstPageOnly(query: DehydratedQuery): DehydratedQuery {
  const data: unknown = query.state.data;
  if (!isInfiniteData(data)) return query;
  return {
    ...query,
    state: { ...query.state, data: { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } },
  };
}

// Keeps the stored row well under Android's ~2 MB AsyncStorage read limit.
function trimClientState(state: DehydratedState): DehydratedState {
  const transactions = state.queries
    .filter((q) => isTransactionsQueryKey(q.queryKey))
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
    .slice(0, MAX_PERSISTED_TRANSACTION_QUERIES)
    .map(firstPageOnly);
  const details = state.queries
    .filter((q) => isTransactionDetailQueryKey(q.queryKey))
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
    .slice(0, MAX_PERSISTED_TRANSACTION_DETAILS);
  const others = state.queries.filter((q) => !isTransactionsQueryKey(q.queryKey) && !isTransactionDetailQueryKey(q.queryKey));
  return { ...state, queries: [...others, ...transactions, ...details] };
}

/**
 * One User's saved query cache, at `pfm_query_cache:<userId>` (BR-OFF-P05).
 * Storage failures are swallowed on purpose (EC-OFF-08): a full disk only
 * means less saved data offline, never a broken online app.
 */
export function createUserCachePersister(userId: string): UserCachePersister {
  const key = queryCacheStorageKey(userId);
  let closed = false;
  // Writes are chained so a removal or a close always lands after them.
  let lastWrite: Promise<void> = Promise.resolve();

  return {
    persistClient(client: PersistedClient) {
      if (closed) return lastWrite;
      const trimmed: PersistedClient = { ...client, clientState: trimClientState(client.clientState) };
      lastWrite = lastWrite
        .then(() => (closed ? undefined : AsyncStorage.setItem(key, JSON.stringify(trimmed))))
        .catch(() => {});
      return lastWrite;
    },
    async restoreClient() {
      try {
        const raw = await AsyncStorage.getItem(key);
        return raw ? (JSON.parse(raw) as PersistedClient) : undefined;
      } catch {
        return undefined;
      }
    },
    async removeClient() {
      await lastWrite;
      await AsyncStorage.removeItem(key).catch(() => {});
    },
    async close() {
      closed = true;
      await lastWrite;
    },
  };
}

/** Removes a User's saved cache without attaching to it (account removed from the device). */
export async function removeUserQueryCache(userId: string): Promise<void> {
  await AsyncStorage.removeItem(queryCacheStorageKey(userId)).catch(() => {});
}
