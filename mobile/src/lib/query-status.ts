// The only part of a TanStack Query result this needs — structural, so plain
// and infinite queries both fit without casting.
//
// isPaused, not fetchStatus: TanStack re-renders a component for every result
// field it has read, and fetchStatus flips on every refetch, so reading it
// re-rendered the whole screen twice per background refresh.
export interface QueryStatusLike {
  isPending: boolean;
  isPaused: boolean;
}

/**
 * True when a query has nothing to show and is paused for lack of a network
 * (specs/mobile-offline-support EC-OFF-06). Such a query is neither "loading"
 * nor "empty": a skeleton would spin forever and an empty state would claim
 * there is no data. Screens show OfflinePlaceholder instead.
 */
export function isWaitingForNetwork(query: QueryStatusLike): boolean {
  return query.isPending && query.isPaused;
}

/**
 * True while a query has nothing to show yet and can still get it: the first
 * fetch, or the saved cache still being read back (useQuery is told
 * "restoring" then, and sits pending without fetching — isLoading is false
 * during that window). Screens show their skeleton for exactly this, so they
 * go skeleton → content once, never empty state → content.
 *
 * Check isWaitingForNetwork first: a paused query is pending too, but it is
 * waiting for a network that may not come.
 */
export function isAwaitingFirstData(query: QueryStatusLike): boolean {
  return query.isPending && !query.isPaused;
}
