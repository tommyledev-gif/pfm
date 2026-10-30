import { useCallback } from "react";

import { useReduceMotion } from "@/lib/use-reduce-motion";
import { Language } from "@/locales/languages";
import { useUiPrefsStore } from "@/stores/ui-prefs-store";
import { useThemeTransitionStore } from "@/theme/theme-transition-store";
import { loadViewShot } from "@/theme/view-shot";

// Switches the app language with the same cross-fade as a theme switch
// (useSwitchTheme, specs/mobile-language-switch D-06): every mounted screen
// re-renders in the new language, but not all in one frame, so the change is
// made beneath a snapshot of the screen and the snapshot then dissolves. No
// frame mixes the two languages. Instant when reduce-motion is on, the binary
// has no view-shot, or the capture fails.
export function useSwitchLanguage(): (language: Language) => void {
  const reduceMotion = useReduceMotion();

  return useCallback(
    (language: Language) => {
      const { language: current, setLanguage } = useUiPrefsStore.getState();
      const transition = useThemeTransitionStore.getState();
      // S-LNG-03: tapping the language already in use changes nothing; a tap
      // mid-fade would stack a second snapshot on the first.
      if (language === current || transition.snapshotUri) return;
      const viewShot = reduceMotion ? null : loadViewShot();
      if (!viewShot) {
        setLanguage(language);
        return;
      }
      viewShot.captureScreen({ format: "jpg", quality: 0.9, result: "tmpfile" })
        .then((uri) => transition.begin(uri, { kind: "language", language }))
        .catch(() => setLanguage(language));
    },
    [reduceMotion],
  );
}
