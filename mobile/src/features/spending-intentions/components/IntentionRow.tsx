import { memo } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { TrashIcon } from "@/components/ui/Icon";
import { IntentionSummary } from "@/features/spending-intentions/components/IntentionSummary";
import { SpendingIntention } from "@/features/spending-intentions/types";
import { radii, spacing, createStyles, useColors } from "@/lib/theme";

interface IntentionRowProps {
  item: SpendingIntention;
  /** Stable (the rows are memoized): called with the row's own intention. */
  onEdit: (item: SpendingIntention) => void;
  onDelete: (item: SpendingIntention) => void;
}

/** One kept intention in the list: tap to edit, the bin to delete. */
export const IntentionRow = memo(function IntentionRow({ item, onEdit, onDelete }: IntentionRowProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.row} testID={`row-intention-${item.id}`}>
      <Pressable style={styles.body} onPress={() => onEdit(item)} accessibilityRole="button" accessibilityLabel={item.title}>
        <IntentionSummary item={item} />
      </Pressable>
      <Pressable
        style={styles.delete}
        onPress={() => onDelete(item)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("intentions.delete.a11y", { title: item.title })}
        testID="btn-intention-row-delete"
      >
        <TrashIcon size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.listCard,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  body: { flex: 1 },
  delete: { padding: spacing.xs },
}));
