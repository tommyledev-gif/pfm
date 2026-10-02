import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EdgeFade } from "@/components/ui/EdgeFade";
import { AnalyticsFollowUp } from "@/features/analytics/types";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface SuggestionChipsProps {
  chips: AnalyticsFollowUp[];
  onPress: (chip: AnalyticsFollowUp) => void;
  /** Disabled while an answer is pending, so two answers never interleave. */
  disabled?: boolean;
  testIDPrefix: "chip-starter" | "chip-followup";
}

const FADE_WIDTH = 32;
const DISABLED_OPACITY = 0.5;

// A row of complete questions — starter chips above the input and follow-up
// chips under an answer (spec.md US-01/US-04). Scrolls sideways instead of
// wrapping so a long row never pushes the input bar off screen; the right
// edge fades out so a chip running past it reads as "scroll for more", not
// as a label cut off mid-word.
//
// Tonal fill, no border, no icon: these sit in a thread that is already all
// text, and a ring around every chip was most of what made it look busy.
export function SuggestionChips({ chips, onPress, disabled, testIDPrefix }: SuggestionChipsProps) {
  if (chips.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {chips.map((chip, i) => (
          <Pressable
            key={`${chip.label}-${i}`}
            testID={`${testIDPrefix}-${i}`}
            disabled={disabled}
            onPress={() => onPress(chip)}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed, disabled && styles.disabled]}
          >
            <Text style={styles.label} numberOfLines={1}>
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <EdgeFade width={FADE_WIDTH} color={colors.bgApp} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Grows to its parent's width in a row parent (the input bar's
  // quick-action slot) as well as a column one, so the fade always sits at
  // the visible right edge.
  wrap: { flexGrow: 1, flexShrink: 1 },
  row: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: FADE_WIDTH, marginBottom: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  chipPressed: { backgroundColor: colors.surface },
  label: { ...typography.caption, color: colors.textSecondary },
  disabled: { opacity: DISABLED_OPACITY },
});
