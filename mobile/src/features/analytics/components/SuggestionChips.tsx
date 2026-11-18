import { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { EdgeFade } from "@/components/ui/EdgeFade";
import { AnalyticsFollowUp } from "@/features/analytics/types";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface SuggestionChipsProps {
  chips: AnalyticsFollowUp[];
  onPress: (chip: AnalyticsFollowUp) => void;
  /** Disabled while an answer is pending, so two answers never interleave. */
  disabled?: boolean;
  testIDPrefix: "chip-starter" | "chip-followup";
  /**
   * The parent's horizontal padding. When set, the row runs that far past
   * the parent on both sides — out to the screen edges — while the chips
   * still rest inset by it: at the start the first chip lines up with the
   * content above, and only once scrolled do chips travel through the left
   * gutter; on the right they always run on to the edge.
   */
  bleed?: number;
  /** A chip of another kind in front of the questions (the analysis input's list of planned spending). */
  leading?: ReactNode;
}

const FADE_WIDTH = 32;
const DISABLED_OPACITY = 0.5;

// A row of complete questions — starter chips above the input and follow-up
// chips under an answer (spec.md US-01/US-04). Scrolls sideways instead of
// wrapping so a long row never pushes the input bar off screen; the right
// edge fades out so a chip running past it reads as "scroll for more", not
// as a label cut off mid-word. With `bleed`, the screen edge itself does that
// job (as in the wallet carousel), so there is no fade — which would also have
// to match whatever ground is behind the row.
//
// Tonal fill, no border, no icon: these sit in a thread that is already all
// text, and a ring around every chip was most of what made it look busy.
export function SuggestionChips({ chips, onPress, disabled, testIDPrefix, bleed, leading }: SuggestionChipsProps) {
  const colors = useColors();
  const styles = useStyles();
  if (chips.length === 0 && !leading) return null;
  const bleeds = bleed !== undefined;
  return (
    <View style={[styles.wrap, bleeds && { marginHorizontal: -bleed }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // paddingLeft/Right rather than paddingHorizontal: the row's own
        // paddingRight would otherwise win over it.
        contentContainerStyle={[styles.row, bleeds && { paddingLeft: bleed, paddingRight: bleed }]}
      >
        {leading}
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
      {bleeds ? null : <EdgeFade width={FADE_WIDTH} color={colors.bgApp} />}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
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
}));
