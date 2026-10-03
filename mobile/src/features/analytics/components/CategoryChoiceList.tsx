import { Pressable, Text, View } from "react-native";

import { ConsultCategoryRef } from "@/features/analytics/types";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

interface CategoryChoiceListProps {
  choices: ConsultCategoryRef[];
  onPick: (category: ConsultCategoryRef) => void;
  disabled?: boolean;
}

// "Which Category do you mean?" (spec.md S-AIQ-26). Picking one answers the
// question as a chip would — no second interpretation, no limit consumed.
export function CategoryChoiceList({ choices, onPick, disabled }: CategoryChoiceListProps) {
  const styles = useStyles();
  return (
    <View style={styles.list}>
      {choices.map((c) => (
        <Pressable
          key={c.id}
          testID={`row-analytics-category-${c.id}`}
          style={styles.row}
          disabled={disabled}
          onPress={() => onPick(c)}
        >
          <Text style={styles.name}>{c.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  list: { marginTop: spacing.md, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  // Same tonal chip as the suggestion rows — no ring around each choice.
  row: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  name: { ...typography.caption, color: colors.textPrimary },
}));
