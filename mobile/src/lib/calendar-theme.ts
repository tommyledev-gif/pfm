import { LocaleConfig } from "react-native-calendars";

import { colors } from "@/lib/theme";

// Every <Calendar> in the app imports its theme from here, so registering the
// Vietnamese locale as a side effect of this module is what translates the
// month title ("Tháng 9 2026") and the weekday row (CN, T2, …) everywhere —
// left alone the library renders them in English.
LocaleConfig.locales.vi = {
  monthNames: Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`),
  monthNamesShort: Array.from({ length: 12 }, (_, i) => `Th${i + 1}`),
  dayNames: ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"],
  dayNamesShort: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
  today: "Hôm nay",
};
LocaleConfig.defaultLocale = "vi";

// Today gets a rounded-square outline rather than just green text, so it
// stays findable at a glance next to a filled selection. Keyed by the flat
// "stylesheet.day.*" names the library actually reads at runtime.
const TODAY_OUTLINE = { borderWidth: 1.5, borderColor: colors.green, borderRadius: 8 };

// Shared `theme` prop for every react-native-calendars <Calendar> in the app.
//
// Every color the library would otherwise fall back to its own default for is
// pinned to a theme token here. Left unset, it paints selected days / arrows /
// dots in its stock blue-violet (`#00adf5`) — the one palette in the app that
// belongs to no design token at all, which is exactly what lib/theme.ts's
// "components must reference these, never inline a color literal" rule exists
// to prevent. Each calendar still overrides per-day colors through its own
// `markedDates`; this only fixes the chrome underneath.
export const CALENDAR_THEME = {
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
  "stylesheet.day.basic": { today: TODAY_OUTLINE },
  "stylesheet.day.period": { today: TODAY_OUTLINE },
};
