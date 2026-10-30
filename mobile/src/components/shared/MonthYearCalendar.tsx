import { useEffect, useMemo, useState } from "react";
import { Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Calendar, CalendarProps } from "react-native-calendars";

import { MonthYearWheelSheet } from "@/components/shared/MonthYearWheelSheet";
import { useCalendarTheme } from "@/lib/calendar-theme";
import { todayDateOnly } from "@/lib/date-range";
import { typography, createStyles } from "@/lib/theme";

// react-native-calendars' `renderHeader` hands back its internal `XDate`
// instance — no `@types/xdate` package exists, so this is just the sliver of
// its API this file actually calls.
interface CalendarMonth {
  getMonth(): number;
  getFullYear(): number;
}

// Years offered, oldest first as a wheel reads: far enough back for any
// realistic account age, and one year ahead so a transaction can be dated
// into early next year.
const YEARS_BACK = 15;
const YEARS_AHEAD = 1;

function monthStartIso(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

type MonthYearCalendarProps = Omit<CalendarProps, "initialDate" | "renderHeader" | "theme"> & {
  /** The month shown when this mounts / when this value changes. */
  initialDate?: string;
};

/**
 * A react-native-calendars Calendar whose "Tháng 9, 2026 ▾" title jumps to
 * any month and year — used by every date picker in the app.
 *
 * The title opens MonthYearWheelSheet, a month | year wheel in its own modal
 * window (see that file for why it must not live inside the host sheet).
 */
export function MonthYearCalendar({ initialDate, ...calendarProps }: MonthYearCalendarProps) {
  const { t } = useTranslation();
  const calendarTheme = useCalendarTheme();
  const styles = useStyles();
  // Calendar re-reads `initialDate` on every change (unlike `current`), which
  // is what lets a picked month move the grid.
  const [jumpDate, setJumpDate] = useState(initialDate ?? todayDateOnly());
  const [wheelOpen, setWheelOpen] = useState(false);
  // The month the grid is showing right now (it changes with the arrows too),
  // which is what the wheel should open on.
  const [shown, setShown] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });

  useEffect(() => {
    setJumpDate(initialDate ?? todayDateOnly());
  }, [initialDate]);

  const monthNames = useMemo(() => t("format.calendar.monthNames").split(", "), [t]);

  const years = useMemo(() => {
    const oldest = new Date().getFullYear() - YEARS_BACK;
    return Array.from({ length: YEARS_BACK + YEARS_AHEAD + 1 }, (_, i) => oldest + i);
  }, []);

  return (
    <>
      <Calendar
        {...calendarProps}
        theme={calendarTheme}
        initialDate={jumpDate}
        // ⚠️ Always six week rows. A month spans 4, 5 or 6 weeks, and without
        // this the calendar — and the whole sheet around it — shrank and grew
        // every time the user paged to a different month.
        showSixWeeks
        hideExtraDays={false}
        renderHeader={(month: CalendarMonth) => (
          <Pressable
            style={styles.headerButton}
            onPress={() => {
              setShown({ year: month.getFullYear(), month: month.getMonth() });
              setWheelOpen(true);
            }}
            hitSlop={8}
            accessibilityLabel={t("ui.calendar.pickMonthYear")}
          >
            <Text style={styles.headerLabel}>
              {t("ui.calendar.monthYear", { month: monthNames[month.getMonth()], year: month.getFullYear() })}
            </Text>
            <Text style={styles.headerCaret}>▾</Text>
          </Pressable>
        )}
      />

      <MonthYearWheelSheet
        visible={wheelOpen}
        years={years}
        month={shown.month}
        year={shown.year}
        onClose={() => setWheelOpen(false)}
        onApply={(year, month) => {
          setJumpDate(monthStartIso(year, month));
          setWheelOpen(false);
        }}
      />
    </>
  );
}

const useStyles = createStyles((colors) => ({
  headerButton: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "center", paddingVertical: 6 },
  headerLabel: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  headerCaret: { ...typography.caption, color: colors.textSecondary },
}));
