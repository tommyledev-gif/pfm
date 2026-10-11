import { Pressable, Text, View } from "react-native";

import { ChevronRightIcon } from "@/components/ui/Icon";
import { FieldError } from "@/components/ui/FieldError";
import { withAlpha } from "@/lib/color";
import { formatCurrency } from "@/lib/currency";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { ItemsEditor } from "@/features/transactions/items/use-items-editor";

interface ItemsEntryRowProps {
  lines: ItemsEditor;
  currency: string;
  // Count from the list row while the detail (with the lines) is not loaded.
  pendingCount: number;
  // Saved lines still loading: the row cannot open the editor yet.
  loading: boolean;
  onPress: () => void;
  error?: string;
}

const CHEVRON_SIZE = 18;

// The form's door to the Items editor (AC-01: hidden for transfers by the caller).
export function ItemsEntryRow({ lines, currency, pendingCount, loading, onPress, error }: ItemsEntryRowProps) {
  const colors = useColors();
  const styles = useStyles();
  const count = lines.items.length || pendingCount;
  const summary = loading
    ? "Đang tải các món..."
    : lines.items.length > 0
      ? `${lines.items.length} món · ${formatCurrency(lines.total, currency)}`
      : count > 0
        ? `${count} món`
        : "Thêm món";

  return (
    <View>
      <Text style={styles.label}>Các món</Text>
      <Pressable testID="btn-transaction-items" accessibilityRole="button" disabled={loading} onPress={onPress} style={styles.row}>
        <Text style={[styles.value, count === 0 && styles.placeholder]}>{summary}</Text>
        <ChevronRightIcon size={CHEVRON_SIZE} color={colors.textMuted} />
      </Pressable>
      <FieldError message={error} />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
  },
  value: { ...typography.body, color: colors.textPrimary },
  placeholder: { color: colors.textMuted },
}));
