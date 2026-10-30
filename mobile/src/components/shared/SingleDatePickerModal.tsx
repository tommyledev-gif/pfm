import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { DateData } from "react-native-calendars";

import { Drawer } from "@/components/shared/Drawer";
import { MonthYearCalendar } from "@/components/shared/MonthYearCalendar";
import { PillButton } from "@/components/ui/PillButton";
import { formatDateShort } from "@/lib/format-date";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface SingleDatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  value: string; // "YYYY-MM-DD"
  onApply: (date: string) => void;
}

// Single-day variant of DateRangePickerModal.tsx — same react-native-calendars
// month/year-jump calendar (MonthYearCalendar) and modal chrome, but one selected day
// (transaction occurred_at) instead of a range. Backend accepts a bare
// "YYYY-MM-DD" string directly (backend/internal/dto/transaction_request.go),
// no time suffix needed.
export function SingleDatePickerModal({ visible, onClose, value, onApply }: SingleDatePickerModalProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const [selected, setSelected] = useState(value);

  // ⚠️ Re-seeded from the caller's applied value on every open. Without this a
  // day picked and then abandoned (backdrop tap, back button) survived into
  // the next open, showing a date that was never applied.
  useEffect(() => {
    if (!visible) return;
    setSelected(value);
  }, [visible, value]);

  const apply = () => {
    onApply(selected);
    onClose();
  };

  return (
    <Drawer visible={visible} onClose={onClose}>
      <Text style={styles.title}>{t("ui.datePicker.title")}</Text>
      <Text style={styles.subtitle}>{formatDateShort(selected)}</Text>

      <MonthYearCalendar
        initialDate={value}
        markedDates={{ [selected]: { selected: true, selectedColor: colors.green, selectedTextColor: colors.onGreen } }}
        onDayPress={(day: DateData) => setSelected(day.dateString)}
        style={styles.calendar}
      />

      <View style={styles.actions}>
        <PillButton label={t("common.action.cancel")} variant="outline" onPress={onClose} style={styles.flexButton} />
        <PillButton label={t("common.action.apply")} onPress={apply} style={styles.flexButton} />
      </View>
    </Drawer>
  );
}

const useStyles = createStyles((colors) => ({
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  calendar: { borderRadius: radii.listCard },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1 },
}));
