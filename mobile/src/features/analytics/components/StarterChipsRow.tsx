import { SuggestionChips } from "@/features/analytics/components/SuggestionChips";
import { STARTER_CHIPS } from "@/features/analytics/starter-chips";
import { AnalyticsQuery } from "@/features/analytics/types";

interface StarterChipsRowProps {
  onAsk: (query: AnalyticsQuery, label: string) => void;
  disabled: boolean;
}

// Analysis mode's starter questions above the input (spec.md US-01).
export function StarterChipsRow({ onAsk, disabled }: StarterChipsRowProps) {
  return (
    <SuggestionChips
      chips={STARTER_CHIPS}
      disabled={disabled}
      testIDPrefix="chip-starter"
      onPress={(chip) => onAsk(chip.query, chip.label)}
    />
  );
}
