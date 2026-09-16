import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { MarkingProps } from "react-native-calendars/src/calendar/day/marking";

import { CALENDAR_THEME } from "@/lib/calendar-theme";
import { Drawer, DrawerChild } from "@/components/shared/Drawer";
import { PillButton } from "@/components/ui/PillButton";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface DateRangePickerModalProps {
  visible: boolean;
  onClose: () => void;
  from?: string;
  to?: string;
  onApply: (range: { from?: string; to?: string }) => void;
}

// react-native-calendars' `renderHeader` hands back its internal `XDate`
// instance — no `@types/xdate` package exists, so this is just the sliver of
// its API this file actually calls, rather than pulling in the untyped lib.
interface CalendarMonth {
  getMonth(): number;
  getFullYear(): number;
}

// Inclusive day count a range may span — a year, generously defined. Anything
// past this stops being "a period to review" and starts being "the whole
// transaction history", which this picker isn't built to browse.
const MAX_RANGE_DAYS = 365;

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`);
// Latest year first, per the design ask — going back far enough to cover any
// realistic account age without scrolling forever.
const YEAR_RANGE = 15;

function buildMarkedDates(start: string | null, end: string | null): Record<string, MarkingProps> {
  if (!start) return {};
  if (!end || end === start) {
    return { [start]: { startingDay: true, endingDay: true, color: colors.green, textColor: colors.onGreen } };
  }

  const marked: Record<string, MarkingProps> = {};
  const cursor = new Date(start);
  const endDate = new Date(end);
  while (cursor <= endDate) {
    const iso = cursor.toISOString().slice(0, 10);
    const isStart = iso === start;
    const isEnd = iso === end;
    marked[iso] = {
      startingDay: isStart,
      endingDay: isEnd,
      color: isStart || isEnd ? colors.green : colors.greenDark,
      textColor: isStart || isEnd ? colors.onGreen : colors.textPrimary,
    };
    cursor.setDate(cursor.getDate() + 1);
  }
  return marked;
}

// Field-by-field, not `new Date(iso)` — a bare YYYY-MM-DD string parses as
// UTC midnight and lands a day early for anyone east of Greenwich (same trap
// budget-pace.ts's own date math avoids).
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthStartIso(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

// Transactions screen's date-range filter — calendar UI with a "period"
// range highlight (start/end days as filled circles, days between them
// joined by a soft band), matching the reference screenshot the user
// supplied. `react-native-calendars`' built-in period marking type is the
// closest match rather than hand-building arc/band geometry.
//
// The month/year label above the grid is its own pressable (via `renderHeader`)
// that opens a Drawer child panel with a 12-month grid and a descending year
// list — react-native-calendars' own header has no such picker, only
// prev/next arrows, which made jumping more than a couple of months away a
// lot of tapping.
export function DateRangePickerModal({ visible, onClose, from, to, onApply }: DateRangePickerModalProps) {
  const [start, setStart] = useState<string | null>(from ?? null);
  const [end, setEnd] = useState<string | null>(to ?? null);
  // Drives react-native-calendars' `initialDate` prop — unlike `current`,
  // Calendar actually re-reads `initialDate` on every change (see its own
  // effect keyed on that prop), so this is the one way to jump the grid to an
  // arbitrary month/year from outside.
  const [jumpDate, setJumpDate] = useState(from ?? new Date().toISOString().slice(0, 10));
  const [monthYearOpen, setMonthYearOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(new Date().getFullYear());
  const [draftMonth, setDraftMonth] = useState(new Date().getMonth());

  // Re-seeds from the caller's own applied range every time the sheet opens —
  // without this, clearing the filter and dismissing without pressing Áp
  // dụng (see `clear` below) left the *next* open showing a stale selection
  // that no longer matched what was actually applied.
  useEffect(() => {
    if (!visible) return;
    setStart(from ?? null);
    setEnd(to ?? null);
    setJumpDate(from ?? new Date().toISOString().slice(0, 10));
  }, [visible, from, to]);

  const markedDates = useMemo(() => buildMarkedDates(start, end), [start, end]);

  // Once a start day is picked (and no end yet), days past the 365-day cap
  // are disabled outright rather than merely rejected on tap — react-native-
  // calendars' own `maxDate` prop greys them out, so the limit reads as a
  // property of the calendar instead of a silent no-op.
  const maxSelectableDate = start && !end ? addDaysIso(start, MAX_RANGE_DAYS - 1) : undefined;

  const onDayPress = (day: DateData) => {
    if (!start || (start && end)) {
      setStart(day.dateString);
      setEnd(null);
    } else if (day.dateString < start) {
      setStart(day.dateString);
      setEnd(null);
    } else {
      setEnd(day.dateString);
    }
  };

  const clear = () => {
    setStart(null);
    setEnd(null);
    // Applies immediately instead of only resetting the calendar's own local
    // selection — previously "Xóa lọc" left the Áp dụng button disabled (no
    // start day left to apply) with no way to actually clear the filter
    // short of picking a whole new range, so the old one silently stayed
    // active even after backing out of the sheet.
    onApply({ from: undefined, to: undefined });
    onClose();
  };

  const apply = () => {
    onApply({ from: start ?? undefined, to: end ?? start ?? undefined });
    onClose();
  };

  const openMonthYearPicker = (month: CalendarMonth) => {
    setDraftYear(month.getFullYear());
    setDraftMonth(month.getMonth());
    setMonthYearOpen(true);
  };

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: YEAR_RANGE }, (_, i) => current - i);
  }, []);

  const monthYearChild: DrawerChild = {
    visible: monthYearOpen,
    onClose: () => setMonthYearOpen(false),
    title: "Chọn tháng, năm",
    children: (
      <View style={styles.monthYearBody}>
        <View style={styles.monthGrid}>
          {MONTH_LABELS.map((label, index) => (
            <Pressable
              key={label}
              style={[styles.monthChip, draftMonth === index && styles.monthChipActive]}
              onPress={() => setDraftMonth(index)}
            >
              <Text style={[styles.monthChipLabel, draftMonth === index && styles.monthChipLabelActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.yearListLabel}>Năm</Text>
        <ScrollView style={styles.yearList} showsVerticalScrollIndicator={false}>
          {years.map((year) => (
            <Pressable
              key={year}
              style={[styles.yearRow, draftYear === year && styles.yearRowActive]}
              onPress={() => setDraftYear(year)}
            >
              <Text style={[styles.yearRowLabel, draftYear === year && styles.yearRowLabelActive]}>{year}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    ),
    footer: (
      <PillButton
        label="Xong"
        onPress={() => {
          setJumpDate(monthStartIso(draftYear, draftMonth));
          setMonthYearOpen(false);
        }}
        style={{ flex: 1 }}
      />
    ),
  };

  return (
    <Drawer visible={visible} onClose={onClose} child={monthYearChild}>
      <Text style={styles.title}>Khoảng thời gian</Text>
      <Text style={styles.subtitle}>
        {start ? `${start}${end && end !== start ? `  –  ${end}` : ""}` : "Chọn ngày bắt đầu"}
      </Text>

      <Calendar
        markingType="period"
        markedDates={markedDates}
        onDayPress={onDayPress}
        theme={CALENDAR_THEME}
        style={styles.calendar}
        initialDate={jumpDate}
        maxDate={maxSelectableDate}
        renderHeader={(month: CalendarMonth) => (
          <Pressable style={styles.headerButton} onPress={() => openMonthYearPicker(month)} hitSlop={8}>
            <Text style={styles.headerLabel}>
              Tháng {month.getMonth() + 1}, {month.getFullYear()}
            </Text>
            <Text style={styles.headerCaret}>▾</Text>
          </Pressable>
        )}
      />

      <Text style={styles.maxRangeHint}>Khoảng thời gian tối đa {MAX_RANGE_DAYS} ngày.</Text>

      <View style={styles.actions}>
        <PillButton label="Xóa lọc" variant="outline" onPress={clear} style={styles.flexButton} />
        <PillButton label="Áp dụng" onPress={apply} disabled={!start} style={styles.flexButton} />
      </View>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  calendar: { borderRadius: radii.listCard },
  maxRangeHint: { ...typography.tiny, color: colors.textMuted, textAlign: "center" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1 },
  headerButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerLabel: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  headerCaret: { ...typography.caption, color: colors.textSecondary },
  monthYearBody: { flex: 1, gap: spacing.md },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  monthChip: {
    width: "31%",
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  monthChipActive: { backgroundColor: colors.green, borderColor: colors.green },
  monthChipLabel: { ...typography.caption, color: colors.textSecondary },
  monthChipLabelActive: { color: colors.onGreen, fontWeight: "700" },
  yearListLabel: { ...typography.caption, color: colors.textSecondary },
  yearList: { flex: 1 },
  yearRow: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.listCard },
  yearRowActive: { backgroundColor: "rgba(133,255,51,0.1)" },
  yearRowLabel: { ...typography.body, color: colors.textPrimary },
  yearRowLabelActive: { color: colors.green, fontWeight: "700" },
});
