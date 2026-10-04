import { QueryClient } from "@tanstack/react-query";

import { QUERY_CACHE_MAX_AGE_MS } from "@/lib/constants";
import { PERSISTED_QUERY_ROOTS } from "@/lib/query-persistence/persist-policy";

// Single QueryClient instance, provided once in app/_layout.tsx — mirrors
// frontend/src/lib/query-client.ts. All server state (wallets, transactions,
// etc., once those features exist) flows through TanStack Query here, never
// through Zustand or component useState (dev.md rule, same as web).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Home alone fires 6 parallel requests the instant it mounts (wallets,
      // categories, budgets, and 3 report-summary calls) — right at app
      // launch, before the OS network stack has finished warming up, that
      // burst can transiently fail. A single retry (~1s later, per TanStack's
      // default exponential backoff) isn't always enough for that warm-up to
      // finish, and once a query settles into an error state with no data,
      // nothing refetches it again until either a manual pull-to-refresh or a
      // brand-new query key (e.g. switching Home's Ngày/Tháng/Năm tab) comes
      // along — which is why the snapshot card used to render blank on first
      // paint and only "come alive" once a different tab forced a fresh
      // query. More retries with the same backoff gives cold start enough
      // room to recover on its own.
      retry: 3,
      staleTime: 30_000,
    },
    // TanStack's default "online" mode PAUSES a mutation while offline: the
    // button would sit pending forever and the write would silently fire on
    // reconnect — even a delete the User has long forgotten. "always" makes
    // an offline mutation fail fast with a network error instead, shown via
    // getErrorMessage's network branch (specs/mobile-offline-support
    // AC-OFF-08, EC-OFF-05). Queries keep "online": paused, showing the data
    // they already have.
    mutations: {
      networkMode: "always",
    },
  },
});

// Saved-for-offline queries live as long as their saved copy may be shown
// (specs/mobile-offline-support BR-OFF-P08): with the default 5-minute gcTime
// a restored entry that no screen has mounted yet would be dropped — and the
// next save would then erase it from the device as well.
PERSISTED_QUERY_ROOTS.forEach((root) => queryClient.setQueryDefaults([root], { gcTime: QUERY_CACHE_MAX_AGE_MS }));

// Home's snapshot card (wallets/budgets/report-summary/categories) is read
// far more often than it changes — a 5-minute staleTime well past the
// default 30s keeps re-focusing the tab from re-fetching every field on the
// card, while still updating instantly on an actual transaction create/
// update/delete: every one of those mutations explicitly invalidateQueries
// on these same keys (use-create-transaction-mutation.ts and friends), and
// an explicit invalidation always refetches regardless of staleTime.
export const SNAPSHOT_STALE_TIME_MS = 5 * 60 * 1000;
