import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { CalendarIcon, CheckIcon } from "@/components/ui/Icon";
import { colorForCategory } from "@/lib/category-color";
import { formatCurrency } from "@/lib/currency";
import { formatDateShort } from "@/lib/format-date";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Category } from "@/features/categories/types";
import { ChatMessage } from "@/features/ai-chat/types";

interface PendingReviewCardProps {
  message: ChatMessage;
  category?: Category;
  walletName: string;
  currency: string;
  confirming: boolean;
  /** True while a bulk "Duyệt tất cả" run is going — every row locks. */
  locked: boolean;
  onConfirm: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

// One proposal on the pending-review screen.
//
// Kept to what a decision needs: what it is, where the money moves, how much
// — on one row — and, under it, when it happened on the left with the two
// small actions on the right. The date used to trail the wallet in the meta
// line, where it was truncated first on a long note and sat in a different
// place on every card; on the action row it lines up down the whole list and
// fills space that was empty. Tapping anywhere else on the card edits it. The earlier version stacked a tag, a status line, a boxed
// note row, a trash tile and a full-width "Duyệt chi tiêu (-50.000 đ)"
// button per card, so three proposals already filled the screen with chrome.
export function PendingReviewCard({
  message,
  category,
  walletName,
  currency,
  confirming,
  locked,
  onConfirm,
  onEdit,
  onRemove,
}: PendingReviewCardProps) {
  const colors = useColors();
  const styles = useStyles();
  const payload = message.action?.payload;
  if (!payload) return null;

  const isIncome = payload.type === "income";
  const categoryName = category?.name ?? "Danh mục";
  const title = payload.note || categoryName;
  const busy = locked || confirming;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onEdit}
      disabled={busy}
      accessibilityHint="Chạm để sửa trước khi duyệt"
    >
      <View style={styles.topRow}>
        <Avatar
          name={categoryName}
          color={colorForCategory(payload.category_id)}
          size={40}
          icon={category?.icon}
          iconUrl={category?.icon_url}
        />
        <View style={styles.identity}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {/* The category only repeats here when the note took the title slot. */}
            {payload.note ? `${categoryName} · ` : ""}
            {walletName}
          </Text>
        </View>
        <Text style={[styles.amount, { color: isIncome ? colors.green : colors.textPrimary }]} numberOfLines={1}>
          {isIncome ? "+" : "-"}
          {formatCurrency(payload.amount, currency)}
        </Text>
      </View>

      <View style={styles.actions}>
        <View style={styles.date}>
          <CalendarIcon size={13} color={colors.textMuted} />
          <Text style={styles.dateLabel} numberOfLines={1}>
            {formatDateShort(payload.occurred_at)}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.action, styles.dismiss, pressed && styles.actionPressed]}
          onPress={onRemove}
          disabled={busy}
          hitSlop={4}
          testID="btn-pending-review-discard"
        >
          <Text style={styles.dismissLabel}>Bỏ qua</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.action, styles.approve, pressed && styles.actionPressed, locked && styles.locked]}
          onPress={onConfirm}
          disabled={busy}
          hitSlop={4}
          testID="btn-pending-review-confirm"
        >
          {confirming ? (
            <ActivityIndicator size="small" color={colors.onGreen} />
          ) : (
            <>
              <CheckIcon size={14} color={colors.onGreen} />
              <Text style={styles.approveLabel}>Duyệt</Text>
            </>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  cardPressed: { opacity: 0.85 },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  identity: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...typography.body, color: colors.textPrimary },
  meta: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
  // Expenses stay in plain text colour: a list where every amount is red reads
  // as an alarm, and the sign already says which way the money goes.
  amount: { ...typography.body, fontWeight: "700" },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  // flex: 1 pushes the two actions to the right edge; minWidth 0 lets the
  // date shrink before they do on a narrow phone.
  date: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  dateLabel: { ...typography.caption, fontWeight: "500", color: colors.textSecondary, flexShrink: 1 },
  action: {
    minWidth: 84,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionPressed: { opacity: 0.75 },
  dismiss: { backgroundColor: withAlpha(colors.overlayBase, 0.06) },
  dismissLabel: { ...typography.caption, color: colors.textSecondary },
  approve: { backgroundColor: colors.green },
  approveLabel: { ...typography.caption, fontWeight: "700", color: colors.onGreen },
  locked: { opacity: 0.4 },
}));
