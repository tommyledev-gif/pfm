import { ScrollView, StyleSheet, View } from "react-native";

import { Chip } from "@/components/ui/Chip";
import { AnalyticsFollowUp } from "@/features/analytics/types";
import { spacing } from "@/lib/theme";

interface SuggestionChipsProps {
  chips: AnalyticsFollowUp[];
  onPress: (chip: AnalyticsFollowUp) => void;
  /** Disabled while an answer is pending, so two answers never interleave. */
  disabled?: boolean;
  testIDPrefix: "chip-starter" | "chip-followup";
}

// A row of complete questions — starter chips above the input and follow-up
// chips under an answer (spec.md US-01/US-04). Scrolls sideways instead of
// wrapping so a long row never pushes the input bar off screen.
export function SuggestionChips({ chips, onPress, disabled, testIDPrefix }: SuggestionChipsProps) {
  if (chips.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips.map((chip, i) => (
        <View key={`${chip.label}-${i}`} testID={`${testIDPrefix}-${i}`} style={disabled ? styles.disabled : null}>
          <Chip label={chip.label} onPress={disabled ? undefined : () => onPress(chip)} />
        </View>
      ))}
    </ScrollView>
  );
}

const DISABLED_OPACITY = 0.5;

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs, marginBottom: spacing.sm },
  disabled: { opacity: DISABLED_OPACITY },
});
