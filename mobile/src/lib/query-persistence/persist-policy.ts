import Constants from "expo-constants";
import { defaultShouldDehydrateQuery, type Query, type QueryKey } from "@tanstack/react-query";

import { QUERY_CACHE_MAX_AGE_MS, QUERY_CACHE_SCHEMA_VERSION } from "@/lib/constants";

// What may be kept on the device for offline reading (specs/mobile-offline-
// support US-03 step 1, AC-OFF-13). Anything else — chat thread, audit logs,
// users, notifications, the budget-wizard prefill — is never written: it is
// sensitive, volatile, or useless offline (S-OFF-21).
export const PERSISTED_QUERY_ROOTS = ["wallets", "categories", "budgets", "report-summary", "transactions"] as const;

export const TRANSACTIONS_QUERY_ROOT = "transactions";

function rootOf(queryKey: QueryKey): unknown {
  return queryKey[0];
}

export function isTransactionsQueryKey(queryKey: QueryKey): boolean {
  return rootOf(queryKey) === TRANSACTIONS_QUERY_ROOT;
}

// A search result is a one-off answer to a typed phrase, not "my recent
// Transactions" — saving each one would only crowd out the lists that matter.
function hasSearchFilter(queryKey: QueryKey): boolean {
  const filters = queryKey[1];
  if (typeof filters !== "object" || filters === null) return false;
  const search: unknown = (filters as Record<string, unknown>).search;
  return typeof search === "string" && search.length > 0;
}

export function shouldPersistQuery(query: Query): boolean {
  if (!defaultShouldDehydrateQuery(query)) return false;
  // The stored blob's own timestamp is its save time, so an entry must not
  // ride along past the keep age just because the blob was re-saved (S-OFF-19).
  if (Date.now() - query.state.dataUpdatedAt > QUERY_CACHE_MAX_AGE_MS) return false;
  const root = rootOf(query.queryKey);
  if (!PERSISTED_QUERY_ROOTS.some((allowed) => allowed === root)) return false;
  return !(isTransactionsQueryKey(query.queryKey) && hasSearchFilter(query.queryKey));
}

// Saved data written by another app version (or an older cached shape) is
// discarded on restore rather than read into the new code (S-OFF-20).
export const PERSISTENCE_BUSTER = `${Constants.expoConfig?.version ?? "0"}:${QUERY_CACHE_SCHEMA_VERSION}`;
