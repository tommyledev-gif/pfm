import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";

import { Drawer } from "@/components/shared/Drawer";
import { PillButton } from "@/components/ui/PillButton";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface SingleDatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  value: string; // "YYYY-MM-DD"
  onApply: (date: string) => void;
}

// Single-day variant of DateRangePickerModal.tsx — same react-native-calendars
// Calendar and modal chrome, but one selected day (transaction occurred_at)
// instead of a range. Backend accepts a bare "YYYY-MM-DD" string directly
// (backend/internal/dto/transaction_request.go), no time suffix needed.
export function SingleDatePickerModal({ visible, onClose, value, onApply }: SingleDatePickerModalProps) {
  const [selected, setSelected] = useState(value);

  const apply = () => {
    onApply(selected);
    onClose();
  };

  return (
    <Drawer visible={visible} onClose={onClose}>
      <Text style={styles.title}>Date</Text>

      <Calendar
        current={selected}
        markingType="dot"
        markedDates={{ [selected]: { selected: true, selectedColor: colors.green, selectedTextColor: colors.onGreen } }}
        onDayPress={(day: DateData) => setSelected(day.dateString)}
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
        <PillButton label="Cancel" variant="outline" onPress={onClose} style={styles.flexButton} />
        <PillButton label="Apply" onPress={apply} style={styles.flexButton} />
      </View>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.textPrimary },
  calendar: { borderRadius: radii.listCard },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1 },
});
