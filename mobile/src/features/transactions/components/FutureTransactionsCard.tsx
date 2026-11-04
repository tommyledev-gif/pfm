import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { formatDateGroupHeader } from "@/lib/format-date";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { transactionCategoryLabel } from "@/features/categories/category-label";
import { Category } from "@/features/categories/types";
import { Transaction } from "@/features/transactions/types";

interface FutureTransactionsCardProps {
  /** Already sorted soonest-first — see splitFutureTransactions. */
  transactions: Transaction[];
  /** So the next one's category reads in the app language. */
  categoryById: Map<string, Category>;
  onPress: () => void;
}

/**
 * The dashed placeholder standing in for transactions dated ahead of today.
 *
 * Dashed and dimmed on purpose, and deliberately NOT a section of the list: a
 * solid row among the real ones would read as money already spent. The card
 * says how many there are and when the next one lands, which is everything the
 * user needs from the top of the screen — the rows themselves are one tap away
 * and cost nothing until asked for.
 */
export function FutureTransactionsCard({ transactions, categoryById, onPress }: FutureTransactionsCardProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  if (transactions.length === 0) return null;
  const next = transactions[0];

  return (
    <Pressable style={styles.card} onPress={onPress} testID="btn-future-transactions">
      <View style={styles.textBlock}>
        <Text style={styles.title}>{t("transactions.future.count", { count: transactions.length })}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {t("transactions.future.next", {
            date: formatDateGroupHeader(next.occurred_at),
            category: transactionCategoryLabel(next, categoryById.get(next.category_id)),
          })}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderStyle: "dashed",
    backgroundColor: colors.surface,
    borderColor: colors.greenDark,
    // Faded as a whole rather than per-element: everything in here describes
    // money that has not moved yet, and the opacity is what says so before a
    // single word is read.
    opacity: 0.8,
  },
  textBlock: { flex: 1, gap: 2 },
  title: { ...typography.label, color: colors.textPrimary },
  subtitle: { ...typography.tiny, color: colors.textSecondary },
  chevron: { ...typography.title, color: colors.textMuted },
}));
