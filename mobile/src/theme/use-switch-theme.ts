import { useCallback } from "react";

import { useReduceMotion } from "@/lib/use-reduce-motion";
import { useThemeStore } from "@/stores/theme-store";
import { ThemeName } from "@/theme/palettes";
import { useThemeTransitionStore } from "@/theme/theme-transition-store";
import { loadViewShot } from "@/theme/view-shot";

// Switches theme with a cross-fade instead of a hard cut.
//
// Every themed component re-renders on the switch, but not all in the same
// frame (lists, memoized rows, images), so an un-animated swap shows a frame
// or two of half-old/half-new UI before it settles. Instead: photograph the
// screen as it is, lay the photo over everything, switch underneath it, then
// fade the photo out — the user sees one smooth dissolve from the old theme
// into the fully-settled new one. ThemeTransitionHost runs the second half.
//
// Falls back to an instant switch when reduce-motion is on (see
// use-reduce-motion.ts — no "faster" animation), when the running binary has
// no view-shot native module (see view-shot.ts), or the capture fails.
export function useSwitchTheme(): (name: ThemeName) => void {
  const reduceMotion = useReduceMotion();

  return useCallback(
    (name: ThemeName) => {
      const { themeName, setThemeName } = useThemeStore.getState();
      const transition = useThemeTransitionStore.getState();
      // A tap mid-fade would stack a second snapshot on the first.
      if (name === themeName || transition.snapshotUri) return;
      const viewShot = reduceMotion ? null : loadViewShot();
      if (!viewShot) {
        setThemeName(name);
        return;
      }
      viewShot.captureScreen({ format: "jpg", quality: 0.9, result: "tmpfile" })
        .then((uri) => transition.begin(uri, { kind: "theme", theme: name }))
        .catch(() => setThemeName(name));
    },
    [reduceMotion],
  );
}
