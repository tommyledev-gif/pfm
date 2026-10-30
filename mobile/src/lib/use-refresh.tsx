import { useCallback, useRef, useState } from "react";
import { RefreshControl } from "react-native";
import { onlineManager } from "@tanstack/react-query";

import { OFFLINE_REFRESH_MESSAGE } from "@/lib/constants";
import { i18n } from "@/lib/i18n";
import { useColors } from "@/lib/theme";
import { useToastStore } from "@/stores/toast-store";

// The only part of a TanStack Query result this needs. Typed structurally
// rather than as UseQueryResult so a screen can mix plain queries and
// infinite queries in the same call without any casting.
interface Refetchable {
  refetch: () => Promise<unknown>;
}

// Pull-to-refresh for a screen that reads from more than one query.
//
// Every screen in this app composes several independent queries (a list plus
// wallets plus categories plus a report total), and "refresh" has to mean all
// of them — refetching only the list leaves the wallet currency or category
// names the row renders with stale, which is exactly the case a user pulls to
// fix. Spinner state is owned here rather than read off any one query's
// `isRefetching`, so it stays up until the last one settles instead of
// disappearing when the fastest finishes.
//
// ⚠️ `refreshControl` is a real <RefreshControl> element and MUST stay one —
// never wrap it in a component of your own. On Android, ScrollView renders
// `cloneElement(refreshControl, {style}, <NativeScrollView>…content…)`, so the
// entire scroll body is handed to this element as its children. A wrapper that
// renders <RefreshControl/> without forwarding {children} silently drops the
// whole screen and leaves a blank page — which is exactly what happened the
// first time this was built as an <AppRefreshControl> component. iOS hides the
// mistake, because there the control is merely a sibling of the content.
//
// The query list is read through a ref so callers can pass a fresh array
// literal on every render (they always will) without the returned callback
// changing identity.
export function useRefresh(queries: Refetchable[]) {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const queriesRef = useRef(queries);
  queriesRef.current = queries;

  const onRefresh = useCallback(async () => {
    // Offline, a refetch would just pause — and the spinner with it, until
    // the network returns. End at once and say why (AC-OFF-06).
    if (!onlineManager.isOnline()) {
      useToastStore.getState().show(i18n.t(OFFLINE_REFRESH_MESSAGE), "warning");
      return;
    }
    setRefreshing(true);
    try {
      // allSettled, not all: one failing query (an expired token on the
      // reports call, say) must not leave the spinner stuck forever on a
      // rejected promise while the others have already come back.
      await Promise.allSettled(queriesRef.current.map((query) => query.refetch()));
    } finally {
      setRefreshing(false);
    }
  }, []);

  return {
    refreshing,
    onRefresh,
    // Themed explicitly because RefreshControl's platform defaults are both
    // wrong on this dark background: Android's `colors` array defaults to the
    // system accent (a blue wheel) and iOS's `tintColor` to a near-black grey
    // that is invisible against colors.bgApp.
    refreshControl: (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor={colors.green}
        colors={[colors.green]}
        progressBackgroundColor={colors.surface}
      />
    ),
  };
}
