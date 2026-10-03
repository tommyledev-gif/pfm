import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { colors, spacing, typography, createStyles } from "@/lib/theme";
import { BudgetProgressBar } from "@/features/budgets/components/BudgetProgressBar";

const AVATAR_SIZE = 24;
const BAR_HEIGHT = 6;

interface SnapshotProgressRowProps {
  name: string;
  // Avatar tint — the category's own deterministic color (category-color.ts).
  color: string;
  icon?: string | null;
  iconUrl?: string | null;
  // spent / limit for a budget row, share-of-month-spend for a category row.
  // Deliberately uncapped: BudgetProgressBar hatches whatever runs past 1.
  ratio: number;
  percent: number;
  // The bar's fill, which is NOT the avatar color: on budget rows it carries
  // the pace verdict (amber/peach), on category rows it echoes the category.
  barColor: string;
  percentColor?: string;
  // Share of the period elapsed, drawn as a tick. Omitted on rows where a
  // pace comparison means nothing (a share-of-spend has no pace).
  pace?: number;
  onPress?: () => void;
  testID?: string;
}

// One row of Home's snapshot right-hand column: icon, name, and a meter.
//
// The percentage used to be the whole story here — a bare "83%" beside an
// icon, because the column was too narrow for anything else. At 9/12 of the
// card there is room for the bar that number describes, and a bar answers
// "how close to the edge" at a glance in a way a two-digit figure does not.
// The percent stays, demoted to a caption above the bar's right end, so the
// exact value is still readable without competing with the shape.
export function SnapshotProgressRow({
  name,
  color,
  icon,
  iconUrl,
  ratio,
  percent,
  barColor,
  percentColor = colors.textSecondary,
  pace,
  onPress,
  testID,
}: SnapshotProgressRowProps) {
  const styles = useStyles();
  // Pressable only where there is somewhere to go — a row that highlights on
  // touch and then does nothing reads as a broken link.
  const Container = onPress ? Pressable : View;

  return (
    <Container testID={testID} onPress={onPress} style={styles.row}>
      <Avatar name={name} color={color} size={AVATAR_SIZE} icon={icon} iconUrl={iconUrl} />
      <View style={styles.meter}>
        <View style={styles.meterHeader}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.percent, { color: percentColor }]} numberOfLines={1}>
            {percent}%
          </Text>
        </View>
        <BudgetProgressBar ratio={ratio} pace={pace} color={barColor} height={BAR_HEIGHT} />
      </View>
    </Container>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  // minWidth 0 so a long category name shrinks and ellipsizes instead of
  // pushing the percentage out of the card.
  meter: { flex: 1, minWidth: 0, gap: spacing.xs },
  meterHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.xs },
  name: { ...typography.caption, color: colors.textPrimary, flexShrink: 1 },
  percent: { ...typography.tiny, flexShrink: 0 },
}));
