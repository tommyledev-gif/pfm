import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Drawer } from "@/components/shared/Drawer";
import { PillButton } from "@/components/ui/PillButton";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { SORT_OPTIONS, SortKey } from "@/features/transactions/sort";

interface SortDrawerModalProps {
  visible: boolean;
  onClose: () => void;
  selected: SortKey[];
  onApply: (keys: SortKey[]) => void;
}

// Transactions screen's sort drawer — same Drawer chrome as CategoryFilterModal,
// but priority-ordered multi-select instead of a plain checklist: tapping
// options in sequence stamps each with a priority number, so amount + date
// can combine (e.g. highest amount first, most recent as the tiebreaker).
export function SortDrawerModal({ visible, onClose, selected, onApply }: SortDrawerModalProps) {
  const [order, setOrder] = useState<SortKey[]>([]);

  useEffect(() => {
    if (!visible) return;
    setOrder(selected);
  }, [visible, selected]);

  const toggle = (key: SortKey) => {
    setOrder((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const clear = () => setOrder([]);

  const apply = () => {
    onApply(order);
    onClose();
  };

  return (
    <Drawer visible={visible} onClose={onClose}>
      <Text style={styles.title}>Sắp xếp</Text>
      <View style={styles.section}>
        {SORT_OPTIONS.map((opt) => {
          // Same field, opposite direction (recent/oldest, highest/lowest) —
          // disabled while its opposite is active instead of silently
          // swapping it out, so the conflict is visible to the user.
          const opposite = SORT_OPTIONS.find((o) => o.group === opt.group && o.key !== opt.key)!;
          const disabled = order.includes(opposite.key) && !order.includes(opt.key);
          const priority = order.indexOf(opt.key);

          return (
            <Pressable
              key={opt.key}
              style={[styles.row, disabled && styles.rowDisabled]}
              disabled={disabled}
              onPress={() => toggle(opt.key)}
            >
              <Text style={[styles.rowLabel, disabled && styles.rowLabelDisabled]}>{opt.label}</Text>
              <View style={[styles.badge, priority >= 0 && styles.badgeActive]}>
                {priority >= 0 ? <Text style={styles.badgeText}>{priority + 1}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <PillButton label="Xóa sắp xếp" variant="outline" onPress={clear} style={styles.flexButton} />
        <PillButton label="Áp dụng" onPress={apply} style={styles.flexButton} />
      </View>
    </Drawer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.textPrimary },
  section: { gap: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  rowDisabled: { opacity: 0.4 },
  rowLabel: { ...typography.body, color: colors.textPrimary },
  rowLabelDisabled: { color: colors.textSecondary },
  badge: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeActive: { backgroundColor: colors.green, borderColor: colors.green },
  badgeText: { ...typography.tiny, color: colors.onGreen, fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1 },
});
