import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { DateData } from "react-native-calendars";
import { MarkingProps } from "react-native-calendars/src/calendar/day/marking";

import { Drawer } from "@/components/shared/Drawer";
import { MonthYearCalendar } from "@/components/shared/MonthYearCalendar";
import { formatDateShort } from "@/lib/format-date";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { PillButton } from "@/components/ui/PillButton";
import { colors, radii, spacing, typography, createStyles } from "@/lib/theme";

interface DateRangePickerModalProps {
  visible: boolean;
  onClose: () => void;
  from?: string;
  to?: string;
  onApply: (range: { from?: string; to?: string }) => void;
}

// Inclusive day count a range may span — a year, generously defined. Anything
// past this stops being "a period to review" and starts being "the whole
// transaction history", which this picker isn't built to browse.
const MAX_RANGE_DAYS = 365;

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

// Transactions screen's date-range filter — calendar UI with a "period"
// range highlight (start/end days as filled circles, days between them
// joined by a soft band), matching the reference screenshot the user
// supplied. `react-native-calendars`' built-in period marking type is the
// closest match rather than hand-building arc/band geometry.
//
// The month/year title above the grid jumps to any month and year inline
// (MonthYearCalendar) — react-native-calendars' own header only has
// prev/next arrows.
//
// ⚠️ The range is handed to the caller once the sheet has slid away (Drawer's
// onExited), never on the tap. A new range re-renders the whole screen behind
// the sheet (Transactions: new queries, the list swapped for its skeleton,
// totals, every row), and on the tap that commit landed while the sheet was
// still sliding down: its frames were dropped, and a re-render of the sheet
// itself mid-slide sent it back to where it started for a frame (a shake and a
// flash). Same order as LanguageSheet. The frame after the exit, so the
// sheet's own unmount is not part of that commit.
export const DateRangePickerModal = memo(function DateRangePickerModal({ visible, onClose, from, to, onApply }: DateRangePickerModalProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [start, setStart] = useState<string | null>(from ?? null);
  const [end, setEnd] = useState<string | null>(to ?? null);
  // The range tapped, applied once the sheet is gone. Null: closed without one.
  const pending = useRef<{ from?: string; to?: string } | null>(null);
  const applyRange = useLatestCallback(onApply);

  // Re-seeds from the caller's own applied range every time the sheet opens —
  // without this, clearing the filter and dismissing without pressing Áp
  // dụng (see `clear` below) left the *next* open showing a stale selection
  // that no longer matched what was actually applied.
  useEffect(() => {
    if (!visible) return;
    // Reopened before the last close had finished: that range was tapped, so it
    // is applied now rather than waiting for an exit this open may never reach
    // by the same route (and then landing on some later dismissal).
    const unapplied = pending.current;
    pending.current = null;
    if (unapplied) applyRange(unapplied);
    setStart(unapplied ? unapplied.from ?? null : from ?? null);
    setEnd(unapplied ? unapplied.to ?? null : to ?? null);
  }, [visible, from, to, applyRange]);

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
    // Applies, instead of only resetting the calendar's own local selection —
    // previously "Xóa lọc" left the Áp dụng button disabled (no start day left
    // to apply) with no way to actually clear the filter short of picking a
    // whole new range, so the old one silently stayed active even after
    // backing out of the sheet. The calendar's own selection is left alone:
    // re-seeding it here would redraw the sheet while it slides away, and the
    // next open re-seeds it from the applied range anyway.
    pending.current = { from: undefined, to: undefined };
    onClose();
  };

  const apply = () => {
    pending.current = { from: start ?? undefined, to: end ?? start ?? undefined };
    onClose();
  };

  const handleExited = () => {
    const range = pending.current;
    pending.current = null;
    if (range) requestAnimationFrame(() => applyRange(range));
  };

  return (
    <Drawer visible={visible} onClose={onClose} onExited={handleExited}>
      <Text style={styles.title}>{t("ui.dateRange.title")}</Text>
      <Text style={styles.subtitle}>
        {start
          ? end && end !== start
            ? t("ui.dateRange.selected", { from: formatDateShort(start), to: formatDateShort(end) })
            : formatDateShort(start)
          : t("ui.dateRange.pickStart")}
      </Text>

      <MonthYearCalendar
        markingType="period"
        markedDates={markedDates}
        onDayPress={onDayPress}
        style={styles.calendar}
        initialDate={from}
        maxDate={maxSelectableDate}
      />

      <Text style={styles.maxRangeHint}>{t("ui.dateRange.maxHint", { count: MAX_RANGE_DAYS })}</Text>

      <View style={styles.actions}>
        <PillButton label={t("common.action.clearFilter")} variant="outline" onPress={clear} style={styles.flexButton} />
        <PillButton label={t("common.action.apply")} onPress={apply} disabled={!start} style={styles.flexButton} />
      </View>
    </Drawer>
  );
});

const useStyles = createStyles((colors) => ({
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  calendar: { borderRadius: radii.listCard },
  maxRangeHint: { ...typography.tiny, color: colors.textMuted, textAlign: "center" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1 },
}));
