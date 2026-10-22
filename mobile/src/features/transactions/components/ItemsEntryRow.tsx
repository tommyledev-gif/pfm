import { ReceiptGlyph } from "@/components/ui/grouped-list/list-icons";
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
}

/**
 * The form's door to the Items editor (AC-01: hidden for transfers by the
 * caller), as a row of the extras group: receipt tile, "Các món", and on the
 * right either the total or a green "Thêm" that says the row is where to add
 * them — with the line count under the label once there are lines.
 */
export function ItemsEntryRow({ lines, currency, pendingCount, loading, onPress, error }: ItemsEntryRowProps) {
  const colors = useColors();
  const count = lines.items.length || pendingCount;
  const total = lines.items.length > 0 ? formatCurrency(lines.total, currency) : undefined;
  const summary = loading ? "Đang tải" : (total ?? (count > 0 ? `${count} món` : "Thêm"));

  return (
    <EntryTile
      label="Các món"
      summary={summary}
      detail={total ? `${lines.items.length} món` : undefined}
      muted={!loading && count === 0}
      glyph={ReceiptGlyph}
      tone={colors.mint}
      onPress={onPress}
      disabled={loading}
      error={error}
      testID="btn-transaction-items"
      accessibilityLabel={total ? `Các món: ${lines.items.length} món, tổng ${total}` : `Các món: ${summary}`}
    />
  );
}
