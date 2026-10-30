import { Pressable, Text, View } from "react-native";
import { Trans, useTranslation } from "react-i18next";

import { categoryLabel } from "@/features/categories/category-label";
import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles } from "@/lib/theme";
import { ConfidenceBadge, ProposalEntry, confidenceBadge } from "@/features/budget-wizard/types";

interface ProposalRowProps {
  entry: ProposalEntry;
  currency: string;
  /** Assigned across the whole visible list so no two rows collide — see
   *  WizardStepResult. A row must never pick its own colour: a hash of one id
   *  in isolation cannot know what the rows beside it were painted. */
  color: string;
  onPress: () => void;
  /** Every row is removable, including the ones the allocator suggested — a
   *  plan the user cannot correct is a plan they work around instead. */
  onRemove: () => void;
  /** Opens the confidence explanation for this row. */
  onPressConfidence: (badge: ConfidenceBadge) => void;
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
export function ProposalRow({
  entry,
  currency,
  color,
  onPress,
  onRemove,
  onPressConfidence,
}: ProposalRowProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const badge = confidenceBadge(entry.source);
  const name = categoryLabel({ name: entry.category_name, system_key: entry.system_key ?? null });

  return (
    <Pressable testID={`row-wizard-proposal-${entry.category_id}`} onPress={onPress} style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />

      <View style={styles.labels}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {/* Words, not dots. The level is real information but "●●○" beside a
            number has no self-evident meaning, so it lives behind this tap
            instead of sitting on the row unexplained — see ConfidencePopup. */}
        <Pressable
          testID={`badge-wizard-confidence-${entry.category_id}`}
          onPress={() => onPressConfidence(badge)}
          hitSlop={6}
        >
          <Text style={styles.badge} numberOfLines={1}>
            {/* Evidence when there is any, the label alone when there is not.
                Never a substitute sentence. */}
            {/* Escaped in, unescaped out: server text never reads as a tag. */}
            <Trans
              t={t}
              i18nKey="budgetWizard.result.row.why"
              values={{ source: entry.evidence ? entry.evidence : badge.label }}
              components={[<Text key="why" style={styles.badgeHint} />]}
              tOptions={{ interpolation: { escapeValue: true } }}
              shouldUnescape
            />
          </Text>
        </Pressable>
      </View>

      <View style={styles.amounts}>
        <Text style={styles.amount}>{formatCurrency(entry.amount_max, currency)}</Text>
        {/* The band's lower edge, shown only when there is one. A stated amount
            has no band, and rendering "500.000 – 500.000" would imply an
            uncertainty that does not exist. */}
        {entry.amount_min < entry.amount_max ? (
          <Text style={styles.band}>
            {t("budgetWizard.result.row.from", { amount: formatCurrency(entry.amount_min, currency) })}
          </Text>
        ) : null}
      </View>

      {/* Its own touch target, so the common action (tap the row to edit the
          amount) and the rare one (remove it) never share a tap. */}
      <Pressable
        onPress={onRemove}
        hitSlop={10}
        accessibilityLabel={t("budgetWizard.result.row.remove.a11y", { category: name })}
        testID={`btn-wizard-remove-row-${entry.category_id}`}
      >
        <Text style={styles.remove}>✕</Text>
      </Pressable>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
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
  badgeHint: { color: colors.green },
  amounts: { alignItems: "flex-end", gap: 1 },
  amount: { ...typography.label, color: colors.textPrimary },
  band: { ...typography.tiny, color: colors.textMuted },
  remove: { ...typography.body, color: colors.textMuted, paddingLeft: spacing.xs },
}));
