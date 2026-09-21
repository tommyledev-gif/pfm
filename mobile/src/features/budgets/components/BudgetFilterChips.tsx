import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/lib/theme";
import { BudgetPaceState } from "@/features/budgets/budget-pace";

export type BudgetFilterKey = "all" | "at-risk" | "over";

// Which pace states each chip keeps. "At risk" deliberately covers only
// at-risk and not over — a budget already blown is past being at risk, and its
// own chip is right next to this one.
export const BUDGET_FILTERS: {
  key: BudgetFilterKey;
  label: string;
  states: readonly BudgetPaceState[] | null;
  /** ⚠️ The colour the matching rows already use. Taken from the same token
   *  the pace helper assigns, never chosen independently — a chip that
   *  disagrees with the rows beneath it contradicts the screen. */
  color: string;
}[] = [
  { key: "all", label: "Tất cả", states: null, color: colors.textSecondary },
  { key: "at-risk", label: "Sắp vượt", states: ["at-risk"], color: colors.mustard },
  { key: "over", label: "Đã vượt", states: ["over"], color: colors.peach },
];

interface BudgetFilterChipsProps {
  value: BudgetFilterKey;
  onChange: (key: BudgetFilterKey) => void;
  counts: Record<BudgetFilterKey, number>;
}

/**
 * The Budgets tab's status filters.
 *
 * Each chip carries the colour of the state it selects, so "which budgets need
 * attention" reads off the row without parsing three labels. Selection is
 * expressed by fill and weight rather than by swapping the colour, because the
 * colour is the meaning.
 *
 * Colour is never the only signal — every chip keeps its label and its count.
 */
export function BudgetFilterChips({ value, onChange, counts }: BudgetFilterChipsProps) {
  return (
    <View style={styles.row}>
      {BUDGET_FILTERS.map((filter) => {
        const active = value === filter.key;
        const count = counts[filter.key];
        // A chip whose group is empty stays in place, dimmed — removing it
        // would make the row's widths jump as budgets change state.
        const muted = count === 0 && !active;

        return (
          <Pressable
            key={filter.key}
            testID={`chip-budget-filter-${filter.key}`}
            onPress={() => onChange(filter.key)}
            style={[
              styles.chip,
              active && { borderColor: filter.color, backgroundColor: `${filter.color}14` },
              muted && styles.chipMuted,
            ]}
          >
            <Text style={[styles.label, { color: active ? filter.color : colors.textSecondary }]}>{filter.label}</Text>
            {/* Lifted onto the chip's corner rather than run inline: "Sắp vượt
                3" reads as one phrase and the number is easy to take for part
                of the name. It also keeps every chip the same width whether
                its figure is 1 or 12. */}
            <View
              style={[styles.badge, active && { backgroundColor: filter.color, borderColor: filter.color }]}
            >
              <Text style={[styles.badgeLabel, active && styles.badgeLabelActive]}>{count}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.lg },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipMuted: { opacity: 0.55 },
  label: { ...typography.caption },
  badge: {
    position: "absolute",
    top: -7,
    right: -6,
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeLabel: { ...typography.tiny, color: colors.textSecondary },
  badgeLabelActive: { color: colors.onGreen },
});
