import { useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { AmountRevealPopup } from "@/components/ui/AmountRevealPopup";
import { TintedIconTile } from "@/components/ui/TintedIconTile";
import { colorForCategory } from "@/lib/category-color";
import { TRANSFER_CATEGORY_ICON } from "@/lib/constants";
import { formatCurrencyTruncated } from "@/lib/currency";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Transaction } from "@/features/transactions/types";

const ICON_SIZE = 44;
// Joins the parts of the second line. The space before the dot is
// non-breaking, so a wrapped line never starts with a dot.
const SEPARATOR = " • ";
const SUB_LINES = 2;

interface TransactionRowProps {
  transaction: Transaction;
  currency?: string;
  category?: { icon: string | null; icon_url: string | null };
  /** Tapping anywhere on the row, the amount included. */
  onPress?: () => void;
  /**
   * Holding the amount shows it in full (AmountRevealPopup). Off when the
   * caller gives the whole row its own hold, which the amount would otherwise
   * take for itself.
   */
  revealAmountOnHold?: boolean;
  /** 1 → 0 from useHighlightFade: the "this is the one" border. */
  highlightOpacity?: Animated.Value;
}

// Home's "Recent Transactions" and the full Transactions list both render
// this exact row shape (README: "Row = icon + name/time + amount + sub-label
// (category · wallet)"), rendering the icon as a tinted rounded square
// (TintedIconTile) rather than Avatar's solid-filled circle.
// `currency` comes from the caller's wallet lookup — Transaction itself
// carries no currency field (only a denormalized wallet_name), the backend
// resolves currency via the wallet relation, so mobile must too.
// `category` is an optional lookup result (icon/icon_url) from the caller's
// own categories fetch — Transaction itself only carries a denormalized
// category_name, same reasoning as the `currency` prop above.
export function TransactionRow({
  transaction,
  currency,
  category,
  onPress,
  revealAmountOnHold = true,
  highlightOpacity,
}: TransactionRowProps) {
  const colors = useColors();
  const styles = useStyles();
  const isIncome = transaction.type === "income";
  const isTransfer = transaction.type === "transfer";
  const label = transaction.note?.trim() || transaction.category_name;
  // A transfer only moves money between the user's own wallets — neither a
  // gain nor a loss — so it gets a neutral colour and no +/- sign.
  const amountColor = isTransfer ? colors.periwinkle : isIncome ? colors.green : colors.peach;
  const amountSign = isTransfer ? "" : isIncome ? "+" : "-";
  const [revealVisible, setRevealVisible] = useState(false);
  const itemCount = transaction.item_count ?? 0;
  const walletLabel = isTransfer ? `${transaction.wallet_name} → ${transaction.to_wallet_name ?? "?"}` : transaction.wallet_name;

  const amount = (
    <Text style={[styles.amount, { color: amountColor }]} numberOfLines={1}>
      {amountSign}
      {formatCurrencyTruncated(transaction.amount, currency)}
    </Text>
  );

  const content = (
    <>
      {highlightOpacity ? (
        <Animated.View pointerEvents="none" style={[styles.highlightBorder, { opacity: highlightOpacity }]} />
      ) : null}
      <TintedIconTile
        color={isTransfer ? colors.periwinkle : colorForCategory(transaction.category_id)}
        size={ICON_SIZE}
        // The system transfer category is never in the user's category list,
        // so its icon cannot come from the `category` lookup.
        icon={isTransfer ? TRANSFER_CATEGORY_ICON : category?.icon}
        iconUrl={category?.icon_url}
        label={label}
      />
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {label}
        </Text>
        {/* One text, not a row of separately shrinking pieces: those each cut
            themselves short ("Ăn u… • Vietco…") long before the line was
            full. It wraps onto a second line now, and only cuts after that. */}
        <Text style={styles.sub} numberOfLines={SUB_LINES}>
          {transaction.category_name}
          <Text style={styles.subDivider}>{SEPARATOR}</Text>
          <Text style={styles.walletDot}>{"● "}</Text>
          {walletLabel}
          {/* specs/transaction-line-items AC-14: only when it has Items. */}
          {itemCount > 0 ? (
            <>
              <Text style={styles.subDivider}>{SEPARATOR}</Text>
              <Text testID={`badge-item-count-${transaction.id}`}>{itemCount} món</Text>
            </>
          ) : null}
        </Text>
      </View>
      {/* The amount is part of the row's tap: it used to be a Pressable of its
          own with only a long-press, which still took every tap that landed on
          it, so the right side of a row did nothing. Hold reveals the exact
          amount + Vietnamese words (AmountRevealPopup). */}
      {revealAmountOnHold ? (
        <Pressable style={styles.right} onPress={onPress} onLongPress={() => setRevealVisible(true)}>
          {amount}
        </Pressable>
      ) : (
        <View style={styles.right}>{amount}</View>
      )}

      {revealAmountOnHold ? (
        <AmountRevealPopup
          visible={revealVisible}
          onClose={() => setRevealVisible(false)}
          amountCents={transaction.amount}
          currency={currency ?? "VND"}
        />
      ) : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {content}
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  middle: { flex: 1, gap: 2 },
  title: { ...typography.body, color: colors.textPrimary },
  sub: { ...typography.tiny, color: colors.textSecondary },
  subDivider: { color: colors.textMuted },
  walletDot: { fontSize: 8, color: colors.periwinkle },
  right: { alignItems: "flex-end", gap: 2 },
  amount: { ...typography.body, fontWeight: "700" },
  // Bleeds past the row's content so the border does not touch the icon.
  highlightBorder: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: -spacing.sm,
    right: -spacing.sm,
    borderRadius: radii.listCard,
    borderWidth: 2,
    borderColor: colors.green,
  },
}));
