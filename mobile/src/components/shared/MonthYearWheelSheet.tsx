import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WHEEL_ITEM_HEIGHT, WHEEL_VISIBLE_ROWS, WheelColumn } from "@/components/shared/WheelColumn";
import { CloseIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`);

interface MonthYearWheelSheetProps {
  visible: boolean;
  /** Years offered, oldest first. */
  years: number[];
  month: number;
  year: number;
  onClose: () => void;
  onApply: (year: number, month: number) => void;
}

/**
 * "Chọn thời gian": a bottom sheet with a month wheel and a year wheel.
 *
 * ⚠️ Rendered in its own RN <Modal> — a separate native window — on purpose.
 * The wheels used to sit inline in the calendar, i.e. inside whichever sheet
 * hosted the calendar, and that sheet's vertical ScrollView kept stealing a
 * share of the drags (it starts scrolling natively before the JS thread can
 * decide the wheel owns the touch — no responder flag or scroll lock set from
 * JS can win that race every time). Here there is no ScrollView anywhere
 * above the wheels, so a vertical drag has exactly one place to go.
 */
export function MonthYearWheelSheet({ visible, years, month, year, onClose, onApply }: MonthYearWheelSheetProps) {
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [draftMonth, setDraftMonth] = useState(month);
  const [draftYearIndex, setDraftYearIndex] = useState(Math.max(0, years.indexOf(year)));

  // Every open starts on the month the calendar is showing.
  useEffect(() => {
    if (!visible) return;
    setDraftMonth(month);
    setDraftYearIndex(Math.max(0, years.indexOf(year)));
  }, [visible, month, year, years]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Đóng" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Chọn thời gian</Text>
            <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8} accessibilityLabel="Đóng">
              <CloseIcon size={16} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.wheels}>
            {/* One band behind both columns marks the row that will be applied. */}
            <View pointerEvents="none" style={styles.selectionBand} />
            <WheelColumn items={MONTH_LABELS} selectedIndex={draftMonth} onChange={setDraftMonth} testID="wheel-month" />
            <WheelColumn
              items={years.map(String)}
              selectedIndex={draftYearIndex}
              onChange={setDraftYearIndex}
              testID="wheel-year"
            />
          </View>

          <PillButton
            label="Áp dụng"
            onPress={() => onApply(years[draftYearIndex], draftMonth)}
            testID="btn-month-year-apply"
          />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.hero,
    borderTopRightRadius: radii.hero,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: withAlpha(colors.overlayBase, 0.28),
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...typography.cardTitle, color: colors.textPrimary },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.overlayBase, 0.08),
    alignItems: "center",
    justifyContent: "center",
  },
  wheels: { flexDirection: "row", height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS },
  selectionBand: {
    position: "absolute",
    left: 0,
    right: 0,
    top: WHEEL_ITEM_HEIGHT * ((WHEEL_VISIBLE_ROWS - 1) / 2),
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: radii.listCard,
    backgroundColor: withAlpha(colors.overlayBase, 0.05),
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
}));
