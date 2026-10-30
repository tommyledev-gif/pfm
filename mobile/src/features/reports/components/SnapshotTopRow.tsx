import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { CurrencySwitch } from "@/components/shared/CurrencySwitch";
import { formatCurrency } from "@/lib/currency";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { HomePeriod } from "@/stores/ui-prefs-store";

interface SnapshotTopRowProps {
  currency: string;
  currencies: string[];
  onChangeCurrency: (currency: string) => void;
  spentDelta: number;
  /** The period the figures are for: picks the trend sentence (one per period, so EN word order is free). */
  period: HomePeriod;
}

/**
 * The home snapshot's top line: which currency the card is in (a switch, only
 * when the user has more than one) and the trend against the previous period.
 * Split out of HomeSnapshotCard to keep that file under 300 lines.
 */
export function SnapshotTopRow({ currency, currencies, onChangeCurrency, spentDelta, period }: SnapshotTopRowProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const more = spentDelta > 0;
  return (
    <View style={styles.row}>
      <CurrencySwitch currencies={currencies} value={currency} onChange={onChangeCurrency} testID="tabs-home-currency" />
      {/* In flow and right-aligned, not pinned to the corner — the trend
          text's length varies with the amount, and a fixed overlay collided
          with the column below it for all but the shortest. */}
      <View style={[styles.trendBadge, more ? styles.trendNegative : styles.trendPositive]}>
        <Text style={[styles.trendLabel, { color: more ? colors.peach : colors.green }]} numberOfLines={1}>
          {spentDelta === 0
            ? t(`home.snapshot.trend.same_${period}`)
            : t(`home.snapshot.trend.${more ? "more" : "less"}_${period}`, {
                amount: formatCurrency(Math.abs(spentDelta), currency),
              })}
        </Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.sm },
  // A translucent tinted pill, not a solid fill — a loud block read as jarring
  // against the rest of this dark, low-saturation card.
  trendBadge: {
    flexShrink: 1,
    marginLeft: "auto",
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.navBorder,
  },
  trendNegative: { backgroundColor: withAlpha(colors.peach, 0.12), borderColor: withAlpha(colors.peach, 0.35) },
  trendPositive: { backgroundColor: withAlpha(colors.green, 0.1), borderColor: withAlpha(colors.green, 0.3) },
  trendLabel: { ...typography.tiny },
}));
