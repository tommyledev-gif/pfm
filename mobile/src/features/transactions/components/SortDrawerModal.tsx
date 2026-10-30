import { memo, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { DEFAULT_SORT_KEY, SORT_OPTIONS, SortKey } from "@/features/transactions/sort";

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
export const SortDrawerModal = memo(function SortDrawerModal({ visible, onClose, selected, onApply }: SortDrawerModalProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [order, setOrder] = useState<SortKey[]>([]);

  // An empty `selected` doesn't mean "unsorted" — it means the list is on the
  // backend's own occurred_at DESC order, which is exactly DEFAULT_SORT_KEY.
  // Opening on a blank checklist made the drawer claim no rule was in effect
  // while the list plainly was sorted.
  useEffect(() => {
    if (!visible) return;
    setOrder(selected.length > 0 ? selected : [DEFAULT_SORT_KEY]);
  }, [visible, selected]);

  const toggle = (key: SortKey) => {
    setOrder((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // Back to the implicit default rather than to nothing at all — "no keys" is
  // not a state this list can actually be in.
  const clear = () => setOrder([DEFAULT_SORT_KEY]);

  const apply = () => {
    onApply(order);
    onClose();
  };

  return (
    <Drawer visible={visible} onClose={onClose}>
      <DrawerHeader
        title={t("common.action.sort")}
        actions={[
          { label: t("transactions.sort.reset"), onPress: clear, variant: "secondary" },
          { label: t("common.action.apply"), onPress: apply },
        ]}
      />
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
              <Text style={[styles.rowLabel, disabled && styles.rowLabelDisabled]}>{t(opt.labelKey)}</Text>
              <View style={[styles.badge, priority >= 0 && styles.badgeActive]}>
                {priority >= 0 ? <Text style={styles.badgeText}>{priority + 1}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Drawer>
  );
});

const useStyles = createStyles((colors) => ({
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
}));
