import { memo, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AmountRevealPopup } from "@/components/ui/AmountRevealPopup";
import { ReceiptIcon } from "@/components/ui/Icon";
import { TintedIconTile } from "@/components/ui/TintedIconTile";
import { colorForCategory } from "@/lib/category-color";
import { TRANSFER_CATEGORY_ICON } from "@/lib/constants";
import { formatCurrencyTruncated } from "@/lib/currency";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { transactionCategoryLabel } from "@/features/categories/category-label";
import { Category } from "@/features/categories/types";
import { Transaction } from "@/features/transactions/types";
import { SharedWalletTag } from "@/features/wallets/components/SharedWalletTag";

const ICON_SIZE = 42;

/** What a row reads from the caller's category lookup. */
export type TransactionRowCategory = Pick<Category, "icon" | "icon_url" | "name" | "system_key">;

interface TransactionRowProps {
  transaction: Transaction;
  currency?: string;
  category?: TransactionRowCategory;
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
  /**
   * Its wallet is a shared one: a "Ví chung" tag on the meta line. Only for
   * lists that mix wallets; inside one shared wallet every row would carry it.
   */
  shared?: boolean;
}

// Home's "Recent Transactions" and the full Transactions list both render
// this row, laid out the way Apple Wallet lists card transactions: the icon
// tile, what it was (with the category under it only when the title is a
// note, so it never says the same word twice), and on the right the amount
// with the wallet quietly under it. Each fact has its own place, so nothing
// is strung together with dots, which read as generated filler.
// `currency` comes from the caller's wallet lookup — Transaction itself
// carries no currency field (only a denormalized wallet_name), the backend
// resolves currency via the wallet relation, so mobile must too.
// `category` is an optional lookup result from the caller's own categories
// fetch — Transaction itself only carries a denormalized category_name, same
// reasoning as the `currency` prop above. That name is the server's, always
// Vietnamese for a system category, so the label goes through
// transactionCategoryLabel to follow the app language; category_name is only
// the fallback for one missing from the lookup (a shared wallet owner's own).
export const TransactionRow = memo(function TransactionRow({
  transaction,
  currency,
  category,
  onPress,
  revealAmountOnHold = true,
  highlightOpacity,
  shared = false,
}: TransactionRowProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const isIncome = transaction.type === "income";
  const isTransfer = transaction.type === "transfer";
  const categoryName = transactionCategoryLabel(transaction, category);
  const label = transaction.note?.trim() || categoryName;
  // A transfer only moves money between the user's own wallets — neither a
  // gain nor a loss — so it gets a neutral colour and no +/- sign.
  const amountColor = isTransfer ? colors.periwinkle : isIncome ? colors.green : colors.peach;
  const amountSign = isTransfer ? "" : isIncome ? "+" : "-";
  const [revealVisible, setRevealVisible] = useState(false);
  // Mounted from the first hold on, so a list of rows never builds a closed
  // popup each (it spells the amount out in words on every render).
  const [revealMounted, setRevealMounted] = useState(false);
  const reveal = () => {
    setRevealMounted(true);
    setRevealVisible(true);
  };
  const itemCount = transaction.item_count ?? 0;
  // Second line on the left: the category under a note, or a transfer's
  // route; the wallet itself goes under the amount.
  const hasNote = Boolean(transaction.note?.trim());
  const leftMeta = isTransfer
    ? `${transaction.wallet_name} → ${transaction.to_wallet_name ?? "?"}`
    : hasNote
      ? categoryName
      : null;

  const amount = (
    <Text style={[styles.amount, { color: amountColor }]} numberOfLines={1}>
      {amountSign}
      {formatCurrencyTruncated(transaction.amount, currency)}
    </Text>
  );

  const wallet = (
    <Text style={styles.wallet} numberOfLines={1}>
      {transaction.wallet_name}
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
        {leftMeta || itemCount > 0 || shared ? (
          <View style={styles.metaRow}>
            {/* First, so a long note's category or a transfer's route
                truncates before it does. */}
            {shared ? <SharedWalletTag testID={`badge-shared-wallet-${transaction.id}`} /> : null}
            {leftMeta ? (
              <Text style={styles.sub} numberOfLines={1}>
                {leftMeta}
              </Text>
            ) : null}
            {/* specs/transaction-line-items AC-14: only when it has Items. */}
            {itemCount > 0 ? (
              <View style={styles.items}>
                <ReceiptIcon size={11} color={colors.textMuted} />
                <Text style={styles.itemsLabel} testID={`badge-item-count-${transaction.id}`}>
                  {t("common.count.items", { count: itemCount })}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {/* The amount is part of the row's tap: it used to be a Pressable of its
          own with only a long-press, which still took every tap that landed on
          it, so the right side of a row did nothing. Hold reveals the exact
          amount + Vietnamese words (AmountRevealPopup). */}
      {revealAmountOnHold ? (
        <Pressable style={styles.right} onPress={onPress} onLongPress={reveal}>
          {amount}
          {isTransfer ? null : wallet}
        </Pressable>
      ) : (
        <View style={styles.right}>
          {amount}
          {isTransfer ? null : wallet}
        </View>
      )}

      {revealAmountOnHold && revealMounted ? (
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
});

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  middle: { flex: 1, minWidth: 0, gap: 3 },
  title: { ...typography.body, color: colors.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sub: { ...typography.caption, fontWeight: "500", color: colors.textSecondary, flexShrink: 1 },
  items: { flexDirection: "row", alignItems: "center", gap: 3 },
  itemsLabel: { ...typography.caption, fontWeight: "500", color: colors.textMuted },
  right: { alignItems: "flex-end", gap: 3, maxWidth: "45%" },
  amount: { ...typography.body, fontWeight: "700" },
  wallet: { ...typography.caption, fontWeight: "500", color: colors.textMuted },
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
