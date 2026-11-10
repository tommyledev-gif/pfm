import { ComponentType, createContext, memo, useContext, useMemo } from "react";
import { useLocalSearchParams } from "expo-router";

type Params = Record<string, string | string[] | undefined>;

const TabParamsContext = createContext<Params | null>(null);

/**
 * A tab screen's route component, with its search params read once at the
 * route and handed down with a stable identity, for useTabParams.
 *
 * ⚠️ Every tap on the bottom nav (router.navigate) replaces the tab's
 * `route.params` with a new object, even when nothing in it changed, and
 * expo-router's useLocalSearchParams is a context fed that object. So a screen
 * calling it re-rendered whole on every switch to it, memo or not, and
 * bottom-tabs only starts its slide after that render commits: the slide
 * started 45-75ms later on Transactions, AI Chat and Insights (emulator,
 * production bundle, 2026-11-10; more on a phone). Here only this wrapper
 * re-renders on a tap, and the screen when a param's value really changes.
 */
export function withTabParams(Screen: ComponentType) {
  const Content = memo(Screen);
  function TabRoute() {
    const params = useLocalSearchParams() as Params;
    // Same values, same object: compared by value, not by identity.
    const key = JSON.stringify(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const stable = useMemo(() => params, [key]);
    return (
      <TabParamsContext.Provider value={stable}>
        <Content />
      </TabParamsContext.Provider>
    );
  }
  TabRoute.displayName = `TabRoute(${Screen.displayName ?? Screen.name})`;
  return memo(TabRoute);
}

/** The tab's search params, inside a screen exported through withTabParams. */
export function useTabParams<T extends Params>(): Partial<T> {
  const params = useContext(TabParamsContext);
  if (params === null) throw new Error("useTabParams: the screen is not exported through withTabParams");
  return params as Partial<T>;
}
