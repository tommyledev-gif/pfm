import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { AmountRevealPopup } from "@/components/ui/AmountRevealPopup";
import { TintedIconTile } from "@/components/ui/TintedIconTile";
import { colorForCategory } from "@/lib/category-color";
import { TRANSFER_CATEGORY_ICON } from "@/lib/constants";
import { formatCurrencyTruncated } from "@/lib/currency";
import { formatDateDMY } from "@/lib/format-date";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Transaction } from "@/features/transactions/types";

const ICON_SIZE = 44;

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
}: {
  transaction: Transaction;
  currency?: string;
  category?: { icon: string | null; icon_url: string | null };
}) {
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

  return (
    <View style={styles.row}>
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
        <View style={styles.subRow}>
          <Text style={styles.sub} numberOfLines={1}>
            {transaction.category_name}
          </Text>
          <Text style={styles.subDivider}>•</Text>
          <View style={styles.walletDot} />
          <Text style={styles.sub} numberOfLines={1}>
            {isTransfer ? `${transaction.wallet_name} → ${transaction.to_wallet_name ?? "?"}` : transaction.wallet_name}
          </Text>
          {/* specs/transaction-line-items AC-14: only when it has Items. */}
          {itemCount > 0 ? (
            <>
              <Text style={styles.subDivider}>•</Text>
              <Text testID={`badge-item-count-${transaction.id}`} style={styles.sub} numberOfLines={1}>
                {itemCount} món
              </Text>
            </>
          ) : null}
        </View>
      </View>
      {/* Long-press reveals the untruncated amount + Vietnamese words (AmountRevealPopup) — a nested
          Pressable inside whatever outer row-tap the caller wraps this in, same idiom as the
          chat-bubble long-press-to-edit flow; a plain tap still passes through to the outer row. */}
      <Pressable style={styles.right} onLongPress={() => setRevealVisible(true)}>
        <Text style={[styles.amount, { color: amountColor }]} numberOfLines={1}>
          {amountSign}
          {formatCurrencyTruncated(transaction.amount, currency)}
        </Text>
      </Pressable>

      <AmountRevealPopup
        visible={revealVisible}
        onClose={() => setRevealVisible(false)}
        amountCents={transaction.amount}
        currency={currency ?? "VND"}
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  middle: { flex: 1, gap: 2 },
  title: { ...typography.body, color: colors.textPrimary },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sub: { ...typography.tiny, color: colors.textSecondary, flexShrink: 1 },
  subDivider: { ...typography.tiny, color: colors.textMuted },
  walletDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.periwinkle },
  right: { alignItems: "flex-end", gap: 2 },
  amount: { ...typography.body, fontWeight: "700" },
  time: { ...typography.tiny, color: colors.textMuted },
}));
