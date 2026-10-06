import { memo, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ChevronRightIcon, HistoryIcon } from "@/components/ui/Icon";
import { formatCurrency } from "@/lib/currency";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useOutboxItems } from "@/stores/outbox-store";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { pendingItemTitle, pendingStatusText } from "@/features/transactions/components/PendingSyncRow";
import { OutboxItem } from "@/features/transactions/outbox/outbox-types";

// Home shows a glance, not the queue: the newest few, then a link to the rest
// on Transactions, where retry / edit / discard live.
const HOME_PENDING_SYNC_LIMIT = 3;
const SECTION_TITLE = "Chờ đồng bộ";
const ICON_SIZE = 16;
const ICON_BOX = 32;

/**
 * Home's "waiting to sync" glance (specs/mobile-offline-support): Transactions
 * saved on this device while offline and not yet accepted by the server.
 * Absent when the queue is empty. Every row leads to Transactions.
 *
 * Memoized (no props): it re-renders from its own outbox subscription only,
 * never because Home re-rendered for something else.
 */
export const HomePendingSyncSection = memo(function HomePendingSyncSection() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const userId = useCurrentUserId();
  const items = useOutboxItems(userId);

  const newest = useMemo(
    () => [...items].sort((a, b) => b.enqueued_at.localeCompare(a.enqueued_at)).slice(0, HOME_PENDING_SYNC_LIMIT),
    [items],
  );
  const hiddenCount = items.length - newest.length;
  const openTransactions = () => router.navigate("/transactions");

  if (items.length === 0) return null;

  return (
    <View style={styles.section} testID="section-home-pending-sync">
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={styles.sectionTitle}>{SECTION_TITLE}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countLabel}>{items.length}</Text>
          </View>
        </View>
        <Pressable onPress={openTransactions} hitSlop={8} testID="btn-home-pending-sync-view-all">
          <Text style={styles.action}>Xem tất cả</Text>
        </Pressable>
      </View>

      <View style={styles.group}>
        {newest.map((item, index) => (
          <HomePendingSyncRow
            key={item.idempotency_key}
            item={item}
            isLast={index === newest.length - 1 && hiddenCount === 0}
            onPress={openTransactions}
          />
        ))}
        {hiddenCount > 0 ? (
          <Pressable
            accessibilityRole="link"
            onPress={openTransactions}
            style={({ pressed }) => [styles.overflowRow, pressed && styles.pressed]}
          >
            <Text style={styles.overflowLabel}>+{hiddenCount} giao dịch khác chờ đồng bộ</Text>
            <ChevronRightIcon size={ICON_SIZE} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

function HomePendingSyncRow({ item, isLast, onPress }: { item: OutboxItem; isLast: boolean; onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const { payload, display } = item;
  const failed = item.status === "failed";
  const sign = payload.type === "transfer" ? "" : payload.type === "income" ? "+" : "-";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !isLast && styles.divider, pressed && styles.pressed]}
      testID={`row-home-pending-sync-${item.idempotency_key}`}
    >
      <View style={styles.iconBox}>
        <HistoryIcon size={ICON_SIZE} color={failed ? colors.danger : colors.textSecondary} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {pendingItemTitle(item)}
        </Text>
        <Text style={[styles.sub, failed && { color: colors.danger }]} numberOfLines={1}>
          {[pendingStatusText(item), display.wallet_name].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {/* Muted, not income/expense-coloured: nothing has been booked yet. */}
      <Text style={styles.amount} numberOfLines={1}>
        {sign}
        {formatCurrency(payload.amount, display.currency)}
      </Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  section: { gap: spacing.sm },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: { ...typography.caption, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
  countBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  countLabel: { fontSize: 10, fontWeight: "800", color: colors.textSecondary },
  action: { ...typography.caption, color: colors.green },
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  pressed: { opacity: 0.6 },
  iconBox: {
    width: ICON_BOX,
    height: ICON_BOX,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  middle: { flex: 1, gap: 2 },
  title: { ...typography.body, color: colors.textPrimary },
  sub: { ...typography.tiny, color: colors.textMuted },
  amount: { ...typography.label, color: colors.textSecondary },
  overflowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  overflowLabel: { ...typography.caption, color: colors.textSecondary },
}));
