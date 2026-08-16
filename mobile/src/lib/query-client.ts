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
