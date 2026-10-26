import { Pressable, StyleSheet, Text, View } from "react-native";

import { SwipeableRow } from "@/components/shared/SwipeableRow";
import { ChevronRightIcon, EditIcon, HistoryIcon, TrashIcon } from "@/components/ui/Icon";
import { formatCurrency } from "@/lib/currency";
import { mixHex, withAlpha } from "@/lib/color";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { proposalAmountSign } from "@/features/ai-chat/proposal-kind";
import { ChatMessage } from "@/features/ai-chat/types";

const ICON_SIZE = 34;

interface PendingRowProps {
  message: ChatMessage;
  label: string;
  /** The proposal's own Wallet currency — never a screen-wide one. */
  currency: string;
  closeSignal: number;
  /** Draws the hairline above this row (every row but the first). */
  separated: boolean;
  /** One peek on mount, to show the row swipes (the section's first row, once). */
  peek: boolean;
  onOpen: (openEdit?: boolean) => void;
  onRequestRemove: () => void;
}

/**
 * One proposal in Home's "awaiting confirmation" list: a plain row of the
 * section's group — amber clock, what it is, the amount, a chevron because
 * the row opens it. Swipe right to edit, left to discard; the first row of a
 * session peeks once to say so, instead of grips drawn on every edge.
 *
 * ⚠️ Swiping reveals a button; it never acts on release. Discarding goes
 * through the caller's confirmation and never deletes the message itself.
 */
export function PendingRow({
  message,
  label,
  currency,
  closeSignal,
  separated,
  peek,
  onOpen,
  onRequestRemove,
}: PendingRowProps) {
  const colors = useColors();
  const styles = useStyles();
  const type = message.action?.payload.type ?? "expense";
  const isIncome = type === "income";
  const isTransfer = type === "transfer";

  return (
    <SwipeableRow
      closeSignal={closeSignal}
      peek={peek}
      // Full-height colour behind the row, as Mail does in its inset groups.
      fill
      leftAction={{
        Icon: EditIcon,
        color: colors.green,
        label: "Sửa",
        testID: "btn-pending-edit",
        onPress: () => onOpen(true),
      }}
      rightAction={{
        Icon: TrashIcon,
        color: colors.peach,
        label: "Bỏ",
        destructive: true,
        testID: "btn-pending-discard",
        onPress: onRequestRemove,
      }}
    >
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => onOpen()}
        accessibilityRole="button"
        accessibilityHint="Vuốt sang phải để sửa, sang trái để bỏ"
      >
        <View style={styles.icon}>
          <HistoryIcon size={17} color={colors.mustard} />
        </View>
        <View style={[styles.body, separated && styles.separated]}>
          <View style={styles.textCol}>
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
            <Text style={styles.hint} numberOfLines={1}>
              Chạm để duyệt mục {isTransfer ? "chuyển khoản" : isIncome ? "thu" : "chi"}
            </Text>
          </View>
          <Text
            testID={`text-pending-amount-${message.id}`}
            style={[styles.amount, { color: isTransfer ? colors.periwinkle : isIncome ? colors.green : colors.textPrimary }]}
            numberOfLines={1}
          >
            {proposalAmountSign(type)}
            {formatCurrency(message.action?.payload.amount ?? 0, currency)}
          </Text>
          <ChevronRightIcon size={15} color={colors.textMuted} />
        </View>
      </Pressable>
    </SwipeableRow>
  );
}

const useStyles = createStyles((colors) => ({
  // Opaque: the swipe actions wait underneath it.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingLeft: spacing.lg,
    backgroundColor: colors.surface,
  },
  // ⚠️ Opaque, mixed rather than layered. A see-through press tint let the
  // swipe strip behind show through the whole row the moment a drag began
  // (the strip turns on with the first pixel of travel, the press clears a
  // beat later): the row seemed to fly open and snap back to the finger.
  rowPressed: { backgroundColor: mixHex(colors.surface, colors.overlayBase, 0.05) },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.mustard, 0.14),
  },
  // The hairline starts after the icon, as an iOS list's does.
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
  },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  textCol: { flex: 1, minWidth: 0, gap: 2 },
  label: { ...typography.body, color: colors.textPrimary },
  hint: { ...typography.caption, color: colors.textSecondary },
  amount: { ...typography.body, fontWeight: "700" },
}));
