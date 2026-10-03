import { Pressable, Text, View } from "react-native";

import { SwipeableRow } from "@/components/shared/SwipeableRow";
import { CheckIcon, EditIcon, HistoryIcon, TrashIcon } from "@/components/ui/Icon";
import { formatCurrency } from "@/lib/currency";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { ChatMessage } from "@/features/ai-chat/types";

interface PendingRowProps {
  message: ChatMessage;
  label: string;
  /** The proposal's own Wallet currency — never a screen-wide one. */
  currency: string;
  closeSignal: number;
  onOpen: (openEdit?: boolean) => void;
  onRequestRemove: () => void;
}

/**
 * One proposal in Home's "awaiting confirmation" list.
 *
 * ⚠️ Swiping reveals a button; it never acts on release. Discarding goes
 * through the caller's confirmation and never deletes the message itself.
 */
export function PendingRow({ message, label, currency, closeSignal, onOpen, onRequestRemove }: PendingRowProps) {
  const colors = useColors();
  const styles = useStyles();
  const isIncome = message.action?.payload.type === "income";

  return (
    <SwipeableRow
      closeSignal={closeSignal}
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
      <Pressable style={styles.row} onPress={() => onOpen()}>
        <View style={styles.iconTile}>
          <HistoryIcon size={18} color={colors.mustard} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.hint} numberOfLines={1}>
            Chạm để duyệt mục {isIncome ? "thu" : "chi"}
          </Text>
        </View>
        <Text
          testID={`text-pending-amount-${message.id}`}
          style={[styles.amount, { color: isIncome ? colors.green : colors.peach }]}
          numberOfLines={1}
        >
          {isIncome ? "+" : "-"}
          {formatCurrency(message.action?.payload.amount ?? 0, currency)}
        </Text>
        <View style={styles.checkButton}>
          <CheckIcon size={16} color={colors.onGreen} />
        </View>
      </Pressable>
    </SwipeableRow>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    // A gold outline rather than the neutral border every other card uses —
    // this row's own cue that it is awaiting action.
    borderColor: withAlpha(colors.mustard, 0.4),
    borderRadius: radii.listCard,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radii.listCard - 2,
    backgroundColor: withAlpha(colors.mustard, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(colors.mustard, 0.3),
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
}));
