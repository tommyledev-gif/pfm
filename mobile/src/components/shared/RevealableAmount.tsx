import { useState } from "react";
import { Pressable, StyleProp, Text, TextStyle } from "react-native";

import { AmountRevealPopup } from "@/components/ui/AmountRevealPopup";
import { formatCurrencyCompact } from "@/lib/currency";

// Longer than RN's ~500ms default. A figure is something the eye rests on, and
// at the default delay a slow tap on a stat card popped a modal the user never
// asked for. A full second is unmistakably a hold.
const REVEAL_DELAY_MS = 1000;

interface RevealableAmountProps {
  /** null renders `emptyLabel` and is not pressable — there is nothing to reveal. */
  amountCents: number | null;
  currency: string;
  style?: StyleProp<TextStyle>;
  emptyLabel?: string;
  testID?: string;
}

/**
 * A compacted amount ("~7tr100k") that gives up the exact figure on a hold.
 *
 * The pairing is the point: compacting alone loses information, so anywhere an
 * amount is shortened to fit, the real number has to stay one gesture away —
 * the same contract TransactionRow already has with formatCurrencyTruncated.
 * This bundles the two so a caller cannot take the shortening without the way
 * back.
 */
export function RevealableAmount({
  amountCents,
  currency,
  style,
  emptyLabel = "—",
  testID,
}: RevealableAmountProps) {
  const [revealed, setRevealed] = useState(false);

  if (amountCents === null) {
    return (
      <Text style={style} numberOfLines={1}>
        {emptyLabel}
      </Text>
    );
  }

  return (
    <>
      <Pressable onLongPress={() => setRevealed(true)} delayLongPress={REVEAL_DELAY_MS} testID={testID}>
        <Text style={style} numberOfLines={1}>
          {formatCurrencyCompact(amountCents, currency)}
        </Text>
      </Pressable>

      <AmountRevealPopup
        visible={revealed}
        onClose={() => setRevealed(false)}
        amountCents={amountCents}
        currency={currency}
      />
    </>
  );
}
