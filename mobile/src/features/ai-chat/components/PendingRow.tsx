import { useRef } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";

import { SwipeableRow } from "@/components/shared/SwipeableRow";
import { ChevronRightIcon, EditIcon, HistoryIcon, TrashIcon } from "@/components/ui/Icon";
import { formatCurrencyCompact } from "@/lib/currency";
import { mixHex, withAlpha } from "@/lib/color";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { proposalAmountSign } from "@/features/ai-chat/proposal-kind";
import { ChatMessage } from "@/features/ai-chat/types";
import { useTooltipStore } from "@/stores/tooltip-store";

const ICON_SIZE = 34;
// The amount column, the same on every row: the widest compact figure
// ("-~999m999k ₫") fits at the default font size. It grows with the system
// font size, up to MAX_FONT_SCALE, so a large one still leaves the label room.
const AMOUNT_WIDTH = 104;
const MAX_FONT_SCALE = 1.3;
// Same hold as an icon button's hint: the row's tap opens the proposal.
const REVEAL_DELAY_MS = 500;

const REVIEW_KEY = {
  transfer: "chat.pending.row.reviewTransfer",
  income: "chat.pending.row.reviewIncome",
  expense: "chat.pending.row.reviewExpense",
} as const;

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
 *
 * The amount is compacted past six digits ("~12m500k") and sits in a column
 * of fixed width, right-aligned. Sized by its content it moved with every
 * figure, and a long note left it nowhere to go: the label is what gives way
 * (one line, cut with "…"), never the amount. Holding the row shows the
 * exact figure over it, the same contract every other compacted amount has
 * (RevealableAmount).
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
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const amountRef = useRef<View>(null);
  const type = message.action?.payload.type ?? "expense";
  const isIncome = type === "income";
  const isTransfer = type === "transfer";
  const amountCents = message.action?.payload.amount ?? 0;

  const revealAmount = () =>
    amountRef.current?.measure((_x, _y, width, height, pageX, pageY) =>
      useTooltipStore
        .getState()
        .show({ x: pageX, y: pageY, width, height }, { kind: "amount", amountCents, currency, label }),
    );

  return (
    <SwipeableRow
      closeSignal={closeSignal}
      peek={peek}
      // Full-height colour behind the row, as Mail does in its inset groups.
      fill
      leftAction={{
        Icon: EditIcon,
        color: colors.green,
        label: t("common.action.edit"),
        testID: "btn-pending-edit",
        onPress: () => onOpen(true),
      }}
      rightAction={{
        Icon: TrashIcon,
        color: colors.peach,
        label: t("common.action.discard"),
        destructive: true,
        testID: "btn-pending-discard",
        onPress: onRequestRemove,
      }}
    >
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => onOpen()}
        onLongPress={revealAmount}
        delayLongPress={REVEAL_DELAY_MS}
        accessibilityRole="button"
        accessibilityHint={t("chat.pending.row.hint")}
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
              {t(REVIEW_KEY[type])}
            </Text>
          </View>
          <View
            ref={amountRef}
            style={[styles.amountBox, { width: AMOUNT_WIDTH * Math.min(fontScale, MAX_FONT_SCALE) }]}
            collapsable={false}
          >
            <Text
              testID={`text-pending-amount-${message.id}`}
              style={[styles.amount, { color: isTransfer ? colors.periwinkle : isIncome ? colors.green : colors.textPrimary }]}
              numberOfLines={1}
            >
              {proposalAmountSign(type)}
              {formatCurrencyCompact(amountCents, currency)}
            </Text>
          </View>
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
  // ⚠️ Grow, shrink and a zero basis spelled out, here and on textCol. With
  // `flex: 1` (shrink 0) both were sized by the note inside this swipe row's
  // horizontal ScrollView: a long note made the body 335 wide in 301 of room
  // (measured on the emulator) and pushed the amount and chevron off the
  // edge instead of cutting the note with "…".
  body: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
  },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  textCol: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2 },
  label: { ...typography.body, color: colors.textPrimary },
  hint: { ...typography.caption, color: colors.textSecondary },
  // Its width is set per render (AMOUNT_WIDTH); never shrunk by the label.
  amountBox: { flexShrink: 0 },
  amount: { ...typography.body, fontWeight: "700", textAlign: "right" },
}));
