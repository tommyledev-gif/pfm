import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const colors = useColors();
  const count = lines.items.length || pendingCount;
  const total = lines.items.length > 0 ? formatCurrency(lines.total, currency) : undefined;
  const summary = loading ? t("common.loading") : (total ?? (count > 0 ? t("common.count.items", { count }) : t("common.action.add")));

  return (
    <EntryTile
      label={t("common.field.items")}
      summary={summary}
      detail={total ? t("common.count.items", { count: lines.items.length }) : undefined}
      muted={!loading && count === 0}
      glyph={ReceiptGlyph}
      tone={colors.mint}
      onPress={onPress}
      disabled={loading}
      error={error}
      testID="btn-transaction-items"
      accessibilityLabel={
        total
          ? t("transactions.items.entryA11yTotal", { count: lines.items.length, total })
          : t("transactions.items.entryA11y", { summary })
      }
    />
  );
}
