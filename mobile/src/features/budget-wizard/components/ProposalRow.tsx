import { Pressable, StyleSheet, Text, View } from "react-native";

import { colorForCategory } from "@/lib/category-color";
import { formatCurrency } from "@/lib/currency";
import { colors, spacing, typography } from "@/lib/theme";
import { ProposalEntry, confidenceBadge } from "@/features/budget-wizard/types";

interface ProposalRowProps {
  entry: ProposalEntry;
  currency: string;
  onPress: () => void;
}

/**
 * One line of the proposal.
 *
 * Every row states where its number came from. A preset guess is labelled
 * "ước lượng"; a figure the user typed is labelled as theirs. v1 printed the
 * same sentence on every row — "AI đề xuất mức chi tiêu tiêu biểu…" — which
 * carried no information and, worse, made a grounded number look exactly like a
 * guess. An honest badge and nothing else beats a confident sentence that means
 * nothing.
 */
export function ProposalRow({ entry, currency, onPress }: ProposalRowProps) {
  const dotColor = colorForCategory(entry.category_id);

  return (
    <Pressable testID={`row-wizard-proposal-${entry.category_id}`} onPress={onPress} style={styles.row}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />

      <View style={styles.labels}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.category_name}
        </Text>
        <Text testID={`badge-wizard-confidence-${entry.category_id}`} style={styles.badge}>
          {/* Evidence when there is any, the badge alone when there is not.
              Never a substitute sentence. */}
          {entry.evidence ? entry.evidence : confidenceBadge(entry.source)}
        </Text>
      </View>

      <View style={styles.amounts}>
        <Text style={styles.amount}>{formatCurrency(entry.amount_max, currency)}</Text>
        {/* The band's lower edge, shown only when there is one. A stated amount
            has no band, and rendering "500.000 – 500.000" would imply an
            uncertainty that does not exist. */}
        {entry.amount_min < entry.amount_max ? (
          <Text style={styles.band}>từ {formatCurrency(entry.amount_min, currency)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 2 },
  labels: { flex: 1, gap: 1 },
  name: { ...typography.label, color: colors.textPrimary },
  badge: { ...typography.tiny, color: colors.textMuted },
  amounts: { alignItems: "flex-end", gap: 1 },
  amount: { ...typography.label, color: colors.textPrimary },
  band: { ...typography.tiny, color: colors.textMuted },
});
