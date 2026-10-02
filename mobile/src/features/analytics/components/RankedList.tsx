import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AmountText } from "@/components/ui/AmountText";
import { ChevronDownIcon } from "@/components/ui/Icon";
import { TintedIconTile } from "@/components/ui/TintedIconTile";
import { AnalyticsTxRow } from "@/features/analytics/types";
import { useCategoryLookup } from "@/features/categories/api/use-category-lookup";
import { Category } from "@/features/categories/types";
import { colorForCategory } from "@/lib/category-color";
import { colors, spacing, typography } from "@/lib/theme";

interface RankedListProps {
  rows: AnalyticsTxRow[];
  /** Continues `rows` in rank order; revealed by "Xem thêm". */
  moreRows?: AnalyticsTxRow[];
  currency: string;
  totalMatched?: number;
}

const TILE_SIZE = 36;

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Q5/Q6/Q14. Notes are never part of an answer (plan.md BR-22) — Category,
// Wallet and date identify each row instead.
//
// "và N khoản khác" used to be a dead end: the rows it counted were never
// sent. They now ride along as more_rows (up to the backend's expand cap), so
// the line opens the rest in place. Expanded is local state on purpose — the
// answer is a snapshot, the open/closed state is not, so every remount (leaving
// the chat and coming back) starts collapsed again.
//
// Each row carries its Category's own tinted tile (TransactionRow's), so the
// same Category has the same colour and icon here as in the Transactions list.
// No rank number: the order is the ranking, and the column only added noise.
export function RankedList({ rows, moreRows = [], currency, totalMatched }: RankedListProps) {
  const categories = useCategoryLookup();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? [...rows, ...moreRows] : rows;
  // Matched beyond what the answer itself lists, and beyond even the
  // expanded list (past the cap, or an answer stored before more_rows).
  const hidden = totalMatched !== undefined ? Math.max(totalMatched - rows.length, 0) : 0;
  const notShown = expanded ? hidden - moreRows.length : moreRows.length > 0 ? 0 : hidden;

  return (
    <View>
      {visible.map((row, i) => (
        <View key={row.id} style={[styles.row, i > 0 && styles.divider]}>
          <CategoryTile row={row} category={row.category_id ? categories.get(row.category_id) : undefined} />
          <View style={styles.middle}>
            <Text style={styles.title} numberOfLines={1}>
              {row.category_name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {shortDate(row.occurred_at)} · {row.wallet_name}
            </Text>
          </View>
          <AmountText amountCents={row.amount} currency={currency} style={styles.amount} />
        </View>
      ))}

      {moreRows.length > 0 ? (
        <Pressable
          testID="btn-analytics-ranked-toggle"
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((v) => !v)}
          hitSlop={spacing.sm}
          style={[styles.toggle, styles.divider]}
        >
          <Text style={styles.toggleLabel}>{expanded ? "Thu gọn" : `Xem thêm ${moreRows.length} khoản`}</Text>
          <View style={expanded ? styles.chevronUp : null}>
            <ChevronDownIcon size={16} color={colors.textSecondary} />
          </View>
        </Pressable>
      ) : null}

      {notShown > 0 ? (
        <Text style={styles.more}>
          {expanded ? `Còn ${notShown} khoản nhỏ hơn — xem đủ ở tab Giao dịch.` : `và ${notShown} khoản khác`}
        </Text>
      ) : null}
    </View>
  );
}

// An answer stored before category_id existed has no Category to look up —
// the tile then falls back to a neutral one, never to a guessed colour.
// ⚠️ The fallback must be a six-digit hex token: TintedIconTile appends an
// alpha suffix to it, which turns an rgba() token into an invalid colour.
function CategoryTile({ row, category }: { row: AnalyticsTxRow; category?: Category }) {
  return (
    <TintedIconTile
      color={row.category_id ? colorForCategory(row.category_id) : colors.textPrimary}
      size={TILE_SIZE}
      icon={category?.icon}
      iconUrl={category?.icon_url}
      label={row.category_name}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  middle: { flex: 1 },
  title: { ...typography.body, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  amount: { ...typography.body, color: colors.textPrimary },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.md },
  toggleLabel: { ...typography.label, color: colors.textSecondary },
  chevronUp: { transform: [{ rotate: "180deg" }] },
  more: { ...typography.caption, color: colors.textSecondary, paddingBottom: spacing.md },
});
