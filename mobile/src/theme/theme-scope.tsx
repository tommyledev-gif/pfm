import { ComponentType, ReactNode, createContext, useEffect, useState } from "react";
import { useIsFocused } from "@react-navigation/native";

import { useThemeStore } from "@/stores/theme-store";
import { ThemeName } from "@/theme/palettes";

// The theme a screen draws with, when it is not the live one yet.
//
// ⚠️ A theme switch used to re-render every themed component in the app in ONE
// synchronous commit, and all five tabs stay mounted behind whatever is on
// screen. The switch is made from a pushed screen (Cài đặt người dùng), which
// is a handful of rows: nearly everything that was re-rendered was a tab nobody
// could see, and the commit held the JS thread for seconds (the screen froze
// under its snapshot, with no spinner).
//
// Now a tab is wrapped in a scope. While it is in view it follows the live
// theme in the same commit as everyone else. While it is not (another tab on
// top, or a screen pushed over the tabs) it keeps the theme it last showed and
// takes the new one a moment later, one tab at a time, when nothing is waiting
// on the JS thread. useThemeName reads the scope's name, and only subscribes
// to the store outside a scope, so the hidden tab's components are not
// re-rendered by the switch at all.
//
// A tab that comes into view first takes the live theme in that very render,
// so it is never seen in the old one.
export const ThemeScopeContext = createContext<ThemeName | null>(null);

// How long after the switch the first hidden tab catches up, and how far
// apart they follow, so no two of them share a commit.
const CATCH_UP_START_MS = 600;
const CATCH_UP_STEP_MS = 400;

interface ThemeScopeProps {
  /** The tab's position: its turn to catch up. */
  order: number;
  children: ReactNode;
}

export function ThemeScope({ order, children }: ThemeScopeProps) {
  const live = useThemeStore((s) => s.themeName);
  const focused = useIsFocused();
  const [shown, setShown] = useState(live);
  const name = focused ? live : shown;

  useEffect(() => {
    if (shown === live) return;
    // In view: already drawn with `live` above; only the record catches up.
    if (focused) {
      setShown(live);
      return;
    }
    const timer = setTimeout(() => setShown(live), CATCH_UP_START_MS + order * CATCH_UP_STEP_MS);
    return () => clearTimeout(timer);
  }, [focused, live, shown, order]);

  return <ThemeScopeContext.Provider value={name}>{children}</ThemeScopeContext.Provider>;
}

/** A tab screen's route component, drawn inside a ThemeScope. */
export function withThemeScope(Screen: ComponentType, order: number) {
  function Scoped() {
    return (
      <ThemeScope order={order}>
        <Screen />
      </ThemeScope>
    );
  }
  Scoped.displayName = `Scoped(${Screen.displayName ?? Screen.name})`;
  return Scoped;
}
