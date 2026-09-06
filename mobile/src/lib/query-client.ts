import { QueryClient } from "@tanstack/react-query";

// Single QueryClient instance, provided once in app/_layout.tsx — mirrors
// frontend/src/lib/query-client.ts. All server state (wallets, transactions,
// etc., once those features exist) flows through TanStack Query here, never
// through Zustand or component useState (dev.md rule, same as web).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// Home's snapshot card (wallets/budgets/report-summary/categories) is read
// far more often than it changes — a 5-minute staleTime well past the
// default 30s keeps re-focusing the tab from re-fetching every field on the
// card, while still updating instantly on an actual transaction create/
// update/delete: every one of those mutations explicitly invalidateQueries
// on these same keys (use-create-transaction-mutation.ts and friends), and
// an explicit invalidation always refetches regardless of staleTime.
export const SNAPSHOT_STALE_TIME_MS = 5 * 60 * 1000;
