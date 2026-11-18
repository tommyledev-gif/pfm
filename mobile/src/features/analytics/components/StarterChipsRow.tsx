import { IntentionsChip } from "@/features/spending-intentions/components/IntentionsChip";
import { SuggestionChips } from "@/features/analytics/components/SuggestionChips";
import { STARTER_CHIPS, anomalyTodayChip } from "@/features/analytics/starter-chips";
import { todayDateOnly } from "@/lib/date-range";
import { AnalyticsQuery } from "@/features/analytics/types";
import { spacing } from "@/lib/theme";

interface StarterChipsRowProps {
  onAsk: (query: AnalyticsQuery, label: string) => void;
  disabled: boolean;
}

// Analysis mode's starter questions above the input (spec.md US-01). Bleeds
// through the input bar's own side margin, so the row scrolls edge to edge.
export function StarterChipsRow({ onAsk, disabled }: StarterChipsRowProps) {
  return (
    <SuggestionChips
      // The anomaly question second: after the month's total, before the
      // breakdown it often leads to.
      chips={[STARTER_CHIPS[0], anomalyTodayChip(todayDateOnly()), ...STARTER_CHIPS.slice(1)]}
      disabled={disabled}
      // The list of planned spending leads the row: it is a place to go, not a question.
      leading={<IntentionsChip disabled={disabled} />}
      testIDPrefix="chip-starter"
      bleed={spacing.xl}
      onPress={(chip) => onAsk(chip.query, chip.label)}
    />
  );
}
