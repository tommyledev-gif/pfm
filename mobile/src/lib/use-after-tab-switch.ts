import { useEffect, useRef } from "react";
import { useNavigation } from "@react-navigation/native";

import { useLatestCallback } from "@/lib/use-latest-callback";

// The tab switch slides for 220ms (app/(app)/(tabs)/_layout.tsx). Without an
// end to wait for (the tab was already in view) this is how long it waits.
const FALLBACK_MS = 600;

// bottom-tabs' own event: not in @react-navigation/native's event map, and the
// package comes with expo-router rather than being one of ours to import.
type TabTransitionEvents = { addListener: (type: "transitionEnd", listener: () => void) => () => void };

/**
 * Runs a callback once this tab has finished sliding in: for a sheet a deep
 * link opens on arrival (Home's pending row → "Sửa" in the AI chat).
 *
 * ⚠️ A Drawer opened during the slide chased it. The sheet is laid out in the
 * screen and placed over the window by measuring where the screen is
 * (useOverlayOrigin) — every frame for a moment after opening — and the screen
 * was moving: the sheet followed a frame late, jittering sideways, while the
 * scene's fade-in dimmed it in and out. Opened after the slide, it opens once.
 */
export function useAfterTabSwitch() {
  const navigation = useNavigation() as unknown as TabTransitionEvents;
  const cancel = useRef<(() => void) | null>(null);
  useEffect(() => () => cancel.current?.(), []);

  return useLatestCallback((fn: () => void) => {
    cancel.current?.();
    let done = false;
    const stop = () => {
      done = true;
      unsubscribe();
      clearTimeout(timer);
    };
    const run = () => {
      if (done) return;
      stop();
      fn();
    };
    const unsubscribe = navigation.addListener("transitionEnd", run);
    const timer = setTimeout(run, FALLBACK_MS);
    cancel.current = stop;
  });
}
