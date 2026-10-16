import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, Vibration, View } from "react-native";

import { TransactionRow } from "@/components/shared/TransactionRow";
import { ChevronRightIcon, ListIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { HOLD_VIBRATION_MS } from "@/lib/gestures";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { animateLineLayout } from "@/features/transactions/components/ExpandableLine";
import { Transaction } from "@/features/transactions/types";

// How long a row has to be held before its tooltip opens.
export const ROW_HOLD_MS = 1000;
const HELD_FILL_ALPHA = 0.1;
const ARROW_SIZE = 10;

interface HoldableTransactionRowProps {
  transaction: Transaction;
  currency?: string;
  category?: { icon: string | null; icon_url: string | null };
  /** Its tooltip is showing. */
  open: boolean;
  onOpen: (transactionId: string) => void;
  onClose: () => void;
  onShowInTransactions: (transaction: Transaction) => void;
}

/**
 * A read-only transaction row that answers a hold. Darker from the moment the
 * finger lands, with a thin bar filling across it; at ROW_HOLD_MS a tooltip
 * opens right under the row, pointing at it, with the one action it offers.
 *
 * ⚠️ Timed by its own timer from press-in, not by delayLongPress, and drawn in
 * place rather than in a Modal: the long-press timer plus a Modal's new
 * window put the tooltip well past the second the hold promises. Being in the
 * list's flow (not floating) also keeps its button tappable — Android does
 * not deliver touches to a child drawn outside its parent's bounds.
 */
export function HoldableTransactionRow({
  transaction,
  currency,
  category,
  open,
  onOpen,
  onClose,
  onShowInTransactions,
}: HoldableTransactionRowProps) {
  const colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const [pressing, setPressing] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The release that ends a hold must not also count as a tap (which closes).
  const heldThisPress = useRef(false);

  const stopTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stopTimer, []);

  const pressIn = () => {
    heldThisPress.current = false;
    setPressing(true);
    stopTimer();
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: ROW_HOLD_MS, easing: Easing.linear, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      timer.current = null;
      heldThisPress.current = true;
      Vibration.vibrate(HOLD_VIBRATION_MS);
      animateLineLayout(reduceMotion);
      onOpen(transaction.id);
    }, ROW_HOLD_MS);
  };

  // A lift before the second, or the list taking the touch to scroll.
  const pressOut = () => {
    setPressing(false);
    stopTimer();
    progress.stopAnimation();
    progress.setValue(0);
  };

  const press = () => {
    if (heldThisPress.current) {
      heldThisPress.current = false;
      return;
    }
    if (open) {
      animateLineLayout(reduceMotion);
      onClose();
    }
  };

  return (
    <View>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={press}
        style={[styles.row, (pressing || open) && styles.rowHeld]}
        accessibilityHint="Giữ một giây để mở trong Giao dịch"
        testID={`row-category-transaction-${transaction.id}`}
      >
        <TransactionRow transaction={transaction} currency={currency} category={category} revealAmountOnHold={false} />
        {pressing && !open ? (
          <Animated.View pointerEvents="none" style={[styles.progress, { transform: [{ scaleX: progress }] }]} />
        ) : null}
      </Pressable>

      {open ? (
        <View style={styles.tooltip} testID={`tooltip-category-transaction-${transaction.id}`}>
          <View style={styles.arrow} />
          <Pressable
            onPress={() => onShowInTransactions(transaction)}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            accessibilityRole="button"
            testID="btn-category-transaction-show"
          >
            <ListIcon size={16} color={colors.green} />
            <Text style={styles.actionLabel}>Xem trong Giao dịch</Text>
            <ChevronRightIcon size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  // The fill bleeds past the text by its own padding, so the content does
  // not move when it appears.
  row: { marginHorizontal: -spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.listCard, overflow: "hidden" },
  rowHeld: { backgroundColor: withAlpha(colors.overlayBase, HELD_FILL_ALPHA) },
  // Fills left to right over the hold, so the second has a visible end.
  progress: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: colors.green,
    transformOrigin: "left",
  },
  tooltip: {
    marginTop: ARROW_SIZE / 2 + 2,
    marginBottom: spacing.xs,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surfaceRaised,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  // A square turned 45° and half tucked under the bubble: points up at the row.
  arrow: {
    position: "absolute",
    top: -ARROW_SIZE / 2,
    left: spacing.xl,
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    backgroundColor: colors.surfaceRaised,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: colors.surfaceBorder,
    transform: [{ rotate: "45deg" }],
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.listCard,
  },
  actionPressed: { backgroundColor: withAlpha(colors.overlayBase, 0.06) },
  actionLabel: { flex: 1, ...typography.body, color: colors.textPrimary },
}));
