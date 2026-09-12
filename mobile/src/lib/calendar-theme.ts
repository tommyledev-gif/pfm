import { colors } from "@/lib/theme";

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
};
