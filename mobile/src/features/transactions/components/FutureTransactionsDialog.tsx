import { Fragment, useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { dayLabelVi, formatDateViShort } from "@/lib/format-date";
import { colors, spacing, typography } from "@/lib/theme";
import { Category } from "@/features/categories/types";
import { Transaction } from "@/features/transactions/types";

interface FutureTransactionsDialogProps {
  visible: boolean;
  onClose: () => void;
  /** Soonest-first, as splitFutureTransactions returns them. */
  transactions: Transaction[];
  walletCurrencyMap: Map<string, string>;
  categoryById: Map<string, Category>;
  /** Tapping a row edits it — usually to fix the date that put it in here. */
  onSelect: (transaction: Transaction) => void;
}

// The rows behind FutureTransactionsCard. Fed from the list the screen has
// already fetched rather than from a query of its own: these rows were in the
// same response as everything else, so re-asking the server for them would be
// a second request for data already in hand.
export function FutureTransactionsDialog({
  visible,
  onClose,
  transactions,
  walletCurrencyMap,
  categoryById,
  onSelect,
}: FutureTransactionsDialogProps) {
  // Grouped by day like the main list, so a month of scheduled rows does not
  // arrive as one undifferentiated column of dates.
  const days = useMemo(() => {
    const groups: { key: string; label: string; items: Transaction[] }[] = [];
    for (const item of transactions) {
      const key = item.occurred_at.slice(0, 10);
      let group = groups.find((g) => g.key === key);
      if (!group) {
        group = { key, label: `${dayLabelVi(item.occurred_at)} · ${formatDateViShort(item.occurred_at)}`, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    }
    return groups;
  }, [transactions]);

  return (
    <Drawer visible={visible} onClose={onClose}>
      <DrawerHeader title="Giao dịch sắp tới" actions={[{ label: "Đóng", onPress: onClose, variant: "secondary" }]} />

      <Text style={styles.note}>
        Những khoản này có ngày ở tương lai nên chưa nằm trong danh sách chính. Chạm để sửa lại ngày.
      </Text>

      {days.length === 0 ? (
        <Text style={styles.empty}>Không có giao dịch nào sắp tới.</Text>
      ) : (
        days.map((day) => (
          <Fragment key={day.key}>
            <Text style={styles.dayLabel}>{day.label}</Text>
            {day.items.map((item) => (
              <Pressable key={item.id} onPress={() => onSelect(item)}>
                <TransactionRow
                  transaction={item}
                  currency={walletCurrencyMap.get(item.wallet_id)}
                  category={categoryById.get(item.category_id)}
                />
              </Pressable>
            ))}
          </Fragment>
        ))
      )}
    </Drawer>
  );
}

const styles = StyleSheet.create({
  note: { ...typography.tiny, color: colors.textSecondary },
  dayLabel: { ...typography.caption, color: colors.textMuted, paddingTop: spacing.sm },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", paddingVertical: spacing.xl },
});
