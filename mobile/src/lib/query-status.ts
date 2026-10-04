// The only part of a TanStack Query result this needs — structural, so plain
// and infinite queries both fit without casting.
interface QueryStatusLike {
  isPending: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
}

/**
 * True when a query has nothing to show and is paused for lack of a network
 * (specs/mobile-offline-support EC-OFF-06). Such a query is neither "loading"
 * nor "empty": a skeleton would spin forever and an empty state would claim
 * there is no data. Screens show OfflinePlaceholder instead.
 */
export function isWaitingForNetwork(query: QueryStatusLike): boolean {
  return query.isPending && query.fetchStatus === "paused";
}
