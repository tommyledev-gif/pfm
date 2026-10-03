import { Pressable, StyleSheet, Text, View } from "react-native";

import { ChevronRightIcon } from "@/components/ui/Icon";
import { AnalyticsFollowUp } from "@/features/analytics/types";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface SuggestionRowsProps {
  chips: AnalyticsFollowUp[];
  onPress: (chip: AnalyticsFollowUp) => void;
  disabled?: boolean;
  testIDPrefix: "chip-followup";
}

// A fallback offers a few questions, not a menu.
const MAX_ROWS = 3;
const DISABLED_OPACITY = 0.5;

/**
 * The questions under a reply that could not answer ("Mình chưa hiểu câu
 * này. Bạn thử:"). Full-width rows rather than chips: they ARE the reply —
 * the next step the User is being offered — so each one is a whole tappable
 * line that asks its complete question, never a quoted example to retype.
 * The same chip data the backend sends, so nothing here invents a question.
 */
export function SuggestionRows({ chips, onPress, disabled, testIDPrefix }: SuggestionRowsProps) {
  const colors = useColors();
  const styles = useStyles();
  if (chips.length === 0) return null;
  return (
    <View style={styles.list}>
      {chips.slice(0, MAX_ROWS).map((chip, i) => (
        <Pressable
          key={`${chip.label}-${i}`}
          testID={`${testIDPrefix}-${i}`}
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => onPress(chip)}
          style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed, disabled && styles.disabled]}
        >
          <Text style={styles.label}>{chip.label}</Text>
          <ChevronRightIcon size={16} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  list: { marginTop: spacing.md, borderRadius: radii.listCard, backgroundColor: colors.surface, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  pressed: { backgroundColor: colors.surfaceRaised },
  label: { ...typography.body, color: colors.textPrimary, flex: 1 },
  disabled: { opacity: DISABLED_OPACITY },
}));
