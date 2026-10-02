import { SuggestionChips } from "@/features/analytics/components/SuggestionChips";
import { STARTER_CHIPS } from "@/features/analytics/starter-chips";
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
      chips={STARTER_CHIPS}
      disabled={disabled}
      testIDPrefix="chip-starter"
      bleed={spacing.xl}
      onPress={(chip) => onAsk(chip.query, chip.label)}
    />
  );
}
