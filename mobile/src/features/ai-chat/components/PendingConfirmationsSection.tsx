import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SwipeableRow } from "@/components/shared/SwipeableRow";
import { CheckIcon, EditIcon, HistoryIcon, TrashIcon } from "@/components/ui/Icon";
import { formatCurrency } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { Category } from "@/features/categories/types";
import { ChatMessage } from "@/features/ai-chat/types";

interface PendingConfirmationsSectionProps {
  messages: ChatMessage[];
  categoryById: Map<string, Category>;
  currency: string;
  /** Opens the full pending-review screen. */
  onViewAll: () => void;
  onOpenMessage: (messageId: string, openEdit?: boolean) => void;
  /** Opens the discard confirmation. ⚠️ Never removes the message itself. */
  onRequestRemove: (message: ChatMessage) => void;
}

/**
 * Home's "awaiting confirmation" list.
 *
 * Extracted from the home screen so that file stays under the 300-line limit,
 * and so the swipe behaviour lives beside the row it acts on.
 *
 * ⚠️ Swiping reveals a button; it no longer acts on release. The previous
 * version discarded the proposal the instant the finger lifted at the drag
 * cap — and discarded it by deleting the message from the thread outright,
 * which destroyed the only record that the proposal had ever existed.
 */
export function PendingConfirmationsSection({
  messages,
  categoryById,
  currency,
  onViewAll,
  onOpenMessage,
  onRequestRemove,
}: PendingConfirmationsSectionProps) {
  // Bumped whenever the rendered set changes, so a parked row never stays
  // open over a row that has moved underneath it.
  const [closeSignal, setCloseSignal] = useState(0);
  const idKey = messages.map((m) => m.id).join(",");

  useEffect(() => {
    setCloseSignal((n) => n + 1);
  }, [idKey]);

  if (messages.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={styles.sectionTitle}>Chờ xác nhận</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeLabel}>{messages.length}</Text>
          </View>
        </View>
        {/* Replaces the old "Bỏ qua", which only hid this section for the
            session — it read as "discard all", and hiding pending work is
            the opposite of what the section is for. */}
        <Pressable onPress={onViewAll} hitSlop={8} testID="btn-pending-view-all">
          <Text style={styles.action}>Xem tất cả</Text>
        </Pressable>
      </View>

      {messages.map((message) => (
        <SwipeableRow
          key={message.id}
          closeSignal={closeSignal}
          leftAction={{
            Icon: EditIcon,
            color: colors.green,
            label: "Sửa",
            testID: "btn-pending-edit",
            onPress: () => onOpenMessage(message.id, true),
          }}
          rightAction={{
            Icon: TrashIcon,
            color: colors.peach,
            label: "Bỏ",
            destructive: true,
            testID: "btn-pending-discard",
            onPress: () => onRequestRemove(message),
          }}
        >
          <Pressable style={styles.row} onPress={() => onOpenMessage(message.id)}>
            <View style={styles.iconTile}>
              <HistoryIcon size={18} color={colors.mustard} />
            </View>
            <View style={styles.textCol}>
              <Text style={styles.label} numberOfLines={1}>
                {message.action?.payload.note ||
                  categoryById.get(message.action?.payload.category_id ?? "")?.name ||
                  "Giao dịch"}
              </Text>
              <Text style={styles.hint} numberOfLines={1}>
                Chạm để duyệt mục {message.action?.payload.type === "income" ? "thu" : "chi"}
              </Text>
            </View>
            <Text
              style={[
                styles.amount,
                { color: message.action?.payload.type === "income" ? colors.green : colors.peach },
              ]}
              numberOfLines={1}
            >
              {formatCurrency(message.action?.payload.amount ?? 0, currency)}
            </Text>
            <View style={styles.checkButton}>
              <CheckIcon size={16} color={colors.onGreen} />
            </View>
          </Pressable>
        </SwipeableRow>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  action: { ...typography.caption, color: colors.green },
  countBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.mustard,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeLabel: { fontSize: 10, fontWeight: "800", color: colors.onGreen },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    // A gold outline rather than the neutral border every other card uses —
    // this row's own cue that it is awaiting action.
    borderColor: "rgba(242,201,76,0.4)",
    borderRadius: radii.listCard,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radii.listCard - 2,
    backgroundColor: "rgba(242,201,76,0.12)",
    borderWidth: 1,
    borderColor: "rgba(242,201,76,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1, minWidth: 0, gap: 2 },
  label: { ...typography.body, color: colors.textPrimary },
  hint: { ...typography.tiny, color: colors.textSecondary },
  amount: { ...typography.body, fontWeight: "700" },
  checkButton: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
});
