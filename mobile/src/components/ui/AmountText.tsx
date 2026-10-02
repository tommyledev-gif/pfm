import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";

import { formatCurrencyToParts } from "@/lib/currency";

interface AmountTextProps {
  amountCents: number;
  currency: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

// The symbol is a unit label, not part of the figure: drawn smaller, in the
// figure's own colour, so the digits carry the weight.
const SYMBOL_SCALE = 0.72;

/**
 * A money figure for reading at a glance: tabular digits (amounts stacked in
 * a list line up column by column) and a smaller currency symbol. The symbol's
 * side and spacing come from the same formatter as formatCurrency, so this
 * never disagrees with an amount written as plain text elsewhere.
 */
export function AmountText({ amountCents, currency, style, testID }: AmountTextProps) {
  const fontSize = StyleSheet.flatten(style)?.fontSize;
  const symbolStyle = fontSize ? { fontSize: Math.round(fontSize * SYMBOL_SCALE) } : null;
  return (
    <Text testID={testID} style={[styles.figure, style]}>
      {formatCurrencyToParts(amountCents, currency).map((part, i) => (
        <Text key={i} style={part.type === "currency" ? symbolStyle : null}>
          {part.value}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  figure: { fontVariant: ["tabular-nums"] },
});
