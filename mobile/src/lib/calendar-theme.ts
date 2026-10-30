import { useMemo } from "react";

import { useColors } from "@/lib/theme";

// Month and weekday names ("Tháng 9 2026", CN, T2, … / "September 2026",
// Sun, Mon, …) are registered with the library's LocaleConfig by lib/i18n.ts,
// which also moves its default with the app language.

// Shared `theme` prop for every react-native-calendars <Calendar> in the app,
// for the active app theme. The library builds its stylesheets from this
// once per mount, so a calendar already on screen keeps its old colors — fine
// today, since every calendar lives in a modal that is never open while the
// theme is being switched.
//
// Every color the library would otherwise fall back to its own default for is
// pinned to a theme token here. Left unset, it paints selected days / arrows /
// dots in its stock blue-violet (`#00adf5`) — the one palette in the app that
// belongs to no design token at all, which is exactly what lib/theme.ts's
// "components must reference these, never inline a color literal" rule exists
// to prevent. Each calendar still overrides per-day colors through its own
// `markedDates`; this only fixes the chrome underneath.
export function useCalendarTheme() {
  const colors = useColors();
  return useMemo(() => {
    // Today gets a rounded-square outline rather than just green text, so it
    // stays findable at a glance next to a filled selection. Keyed by the flat
    // "stylesheet.day.*" names the library actually reads at runtime.
    const todayOutline = { borderWidth: 1.5, borderColor: colors.green, borderRadius: 8 };
    return {
      calendarBackground: "transparent",
      monthTextColor: colors.textPrimary,
      textMonthFontWeight: "700" as const,
      arrowColor: colors.green,
      dayTextColor: colors.textPrimary,
      textDisabledColor: colors.textMuted,
      textSectionTitleColor: colors.textSecondary,
      todayTextColor: colors.green,
      selectedDayBackgroundColor: colors.green,
      selectedDayTextColor: colors.onGreen,
      dotColor: colors.green,
      selectedDotColor: colors.onGreen,
      indicatorColor: colors.green,
      "stylesheet.day.basic": { today: todayOutline },
      "stylesheet.day.period": { today: todayOutline },
    };
  }, [colors]);
}
