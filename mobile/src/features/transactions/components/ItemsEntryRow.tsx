import { ReceiptIcon } from "@/components/ui/Icon";
import { formatCurrency } from "@/lib/currency";
import { useColors } from "@/lib/theme";
import { ItemsEditor } from "@/features/transactions/items/use-items-editor";
import { EntryTile } from "@/features/transactions/components/EntryTile";

interface ItemsEntryRowProps {
  lines: ItemsEditor;
  currency: string;
  // Count from the list row while the detail (with the lines) is not loaded.
  pendingCount: number;
  // Saved lines still loading: the row cannot open the editor yet.
  loading: boolean;
  onPress: () => void;
  error?: string;
  // Half-width tile next to the location tile (AI chat's edit sheet): the
  // count on the first line, the total under it.
  compact?: boolean;
}

const ICON_SIZE = 16;

// The form's door to the Items editor (AC-01: hidden for transfers by the caller).
export function ItemsEntryRow({ lines, currency, pendingCount, loading, onPress, error, compact }: ItemsEntryRowProps) {
  const colors = useColors();
  const count = lines.items.length || pendingCount;
  const total = lines.items.length > 0 ? formatCurrency(lines.total, currency) : undefined;
  const summary = loading
    ? "Đang tải các món..."
    : lines.items.length > 0
      ? compact
        ? `${lines.items.length} món`
        : `${lines.items.length} món · ${total}`
      : count > 0
        ? `${count} món`
        : "Thêm món";

  return (
    <EntryTile
      label="Các món"
      summary={summary}
      detail={compact && !loading ? total : undefined}
      muted={count === 0}
      icon={compact ? <ReceiptIcon size={ICON_SIZE} color={count > 0 ? colors.accentMuted : colors.textMuted} /> : undefined}
      onPress={onPress}
      disabled={loading}
      compact={compact}
      error={error}
      testID="btn-transaction-items"
      accessibilityLabel={total ? `Các món: ${lines.items.length} món, tổng ${total}` : `Các món: ${summary}`}
    />
  );
}
