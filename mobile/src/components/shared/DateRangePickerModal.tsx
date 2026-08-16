import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { MarkingProps } from "react-native-calendars/src/calendar/day/marking";

import { PillButton } from "@/components/ui/PillButton";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface DateRangePickerModalProps {
  visible: boolean;
  onClose: () => void;
  from?: string;
  to?: string;
  onApply: (range: { from?: string; to?: string }) => void;
}

function buildMarkedDates(start: string | null, end: string | null): Record<string, MarkingProps> {
  if (!start) return {};
  if (!end || end === start) {
    return { [start]: { startingDay: true, endingDay: true, color: colors.lavender, textColor: colors.onGreen } };
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

// Transactions screen's date-range filter — calendar UI with a "period"
// range highlight (start/end days as filled circles, days between them
// joined by a soft band), matching the reference screenshot the user
// supplied. `react-native-calendars`' built-in period marking type is the
// closest match rather than hand-building arc/band geometry.
export function DateRangePickerModal({ visible, onClose, from, to, onApply }: DateRangePickerModalProps) {
  const [start, setStart] = useState<string | null>(from ?? null);
  const [end, setEnd] = useState<string | null>(to ?? null);

  const markedDates = useMemo(() => buildMarkedDates(start, end), [start, end]);

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
  };

  const apply = () => {
    onApply({ from: start ?? undefined, to: end ?? start ?? undefined });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.sheet}>
          <Text style={styles.title}>Date range</Text>
          <Text style={styles.subtitle}>
            {start ? `${start}${end && end !== start ? `  –  ${end}` : ""}` : "Select a start date"}
          </Text>

          <Calendar
            markingType="period"
            markedDates={markedDates}
            onDayPress={onDayPress}
            theme={{
              calendarBackground: "transparent",
              monthTextColor: colors.textPrimary,
              textMonthFontWeight: "700",
              arrowColor: colors.textPrimary,
              dayTextColor: colors.textPrimary,
              textDisabledColor: colors.textMuted,
              textSectionTitleColor: colors.textSecondary,
              todayTextColor: colors.green,
            }}
            style={styles.calendar}
          />

          <View style={styles.actions}>
            <PillButton label="Clear" variant="outline" onPress={clear} style={styles.flexButton} />
            <PillButton label="Apply" onPress={apply} disabled={!start} style={styles.flexButton} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.hero,
    borderTopRightRadius: radii.hero,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  calendar: { borderRadius: radii.listCard },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1 },
});
