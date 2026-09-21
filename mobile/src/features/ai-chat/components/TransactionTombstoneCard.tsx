import { Pressable, StyleSheet, Text, View } from "react-native";

import { HistoryIcon, TrashIcon } from "@/components/ui/Icon";
import { formatCurrencyTruncated } from "@/lib/currency";
import { formatDateShort, formatTime } from "@/lib/format-date";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { TombstoneKind } from "@/features/ai-chat/tombstone";
import { TransactionActionPayload } from "@/features/ai-chat/types";

interface TransactionTombstoneCardProps {
  kind: TombstoneKind;
  payload: TransactionActionPayload;
  categoryName: string;
  currency: string;
  /** ISO-8601 UTC; rendered in device-local time. */
  removedAt?: string;
  onPressHistory: () => void;
}

// The two wordings are deliberately not interchangeable. "Removed" means a
// real record was soft-deleted and its history is readable; "not saved" means
// the proposal never became anything, so there is nothing server side to look
// up. Saying the second as if it were the first would promise a trail that
// does not exist.
const KIND_LABEL: Record<TombstoneKind, string> = {
  deleted: "Đã xóa giao dịch",
  discarded: "Đã bỏ — chưa từng lưu",
};

/**
 * What a removed proposal leaves behind in the thread.
 *
 * ⚠️ It replaces the action card; it never replaces the message. The amount is
 * struck through and dimmed rather than hidden, because "what was it?" is the
 * first thing anyone asks of a removed entry.
 */
export function TransactionTombstoneCard({
  kind,
  payload,
  categoryName,
  currency,
  removedAt,
  onPressHistory,
}: TransactionTombstoneCardProps) {
  const label = payload.note || categoryName;

  return (
    <Pressable
      testID={`card-transaction-tombstone-${kind}`}
      accessibilityRole="button"
      onPress={onPressHistory}
      style={styles.card}
    >
      <View style={styles.headRow}>
        <TrashIcon size={13} color={colors.textMuted} />
        <Text style={styles.kindLabel} numberOfLines={1}>
          {KIND_LABEL[kind]}
        </Text>
      </View>

      <View style={styles.bodyRow}>
        <Text style={styles.name} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.amount} numberOfLines={1}>
          {payload.type === "income" ? "+" : "-"}
          {formatCurrencyTruncated(payload.amount, currency)}
        </Text>
      </View>

      <View style={styles.footRow}>
        <Text style={styles.meta} numberOfLines={1}>
          {removedAt ? `${formatDateShort(removedAt)} · ${formatTime(removedAt)}` : formatDateShort(payload.occurred_at)}
        </Text>
        <View style={styles.historyLink}>
          <HistoryIcon size={12} color={colors.lavender} />
          <Text style={styles.historyLabel}>Xem lịch sử</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.surfaceBorder,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  kindLabel: { ...typography.tiny, color: colors.textMuted },
  bodyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  name: { flex: 1, ...typography.caption, color: colors.textSecondary, textDecorationLine: "line-through" },
  amount: { ...typography.caption, color: colors.textMuted, textDecorationLine: "line-through" },
  footRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  meta: { ...typography.tiny, color: colors.textMuted },
  historyLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  historyLabel: { ...typography.tiny, color: colors.lavender },
});
