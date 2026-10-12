import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { currencyDecimals, formatExpression, unformatAmount } from "@/lib/calculator/format";
import { formatCurrencyToParts, toMajorUnits } from "@/lib/currency";
import { parseMajorToCents } from "@/features/transactions/items/line-math";
import { useItemsEditorStyles } from "@/features/transactions/components/items-editor-styles";
import { useColors } from "@/lib/theme";

interface MoneyFieldProps {
  cents: number | null;
  currency: string;
  onChange: (cents: number | null) => void;
  placeholder?: string;
  accessibilityLabel: string;
  testID?: string;
}

const symbolCache = new Map<string, string>();
function currencySymbol(currency: string): string {
  let symbol = symbolCache.get(currency);
  if (symbol === undefined) {
    symbol = formatCurrencyToParts(0, currency).find((p) => p.type === "currency")?.value ?? currency;
    symbolCache.set(currency, symbol);
  }
  return symbol;
}

// A money input for the Items editor, holding cents for the caller. Grouped
// the way formatCurrency writes the same amount ("35.000" for VND, never
// "35,000"), right-aligned with tabular digits and a muted symbol, so a typed
// figure and the total under it read alike. Keeps its own text so a partial
// entry ("12." in USD) survives, and re-syncs only when the cents change from
// outside (the quantity × unit price pre-fill).
export function MoneyField({ cents, currency, onChange, placeholder = "0", accessibilityLabel, testID }: MoneyFieldProps) {
  const colors = useColors();
  const styles = useItemsEditorStyles();
  const [text, setText] = useState(cents === null ? "" : String(toMajorUnits(cents)));

  useEffect(() => {
    if (parseMajorToCents(text, currency) === cents) return;
    setText(cents === null ? "" : String(toMajorUnits(cents)));
    // Only an outside change of `cents` should rewrite the text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents, currency]);

  return (
    <View style={styles.field}>
      <TextInput
        testID={testID}
        value={formatExpression(text, currency, "")}
        onChangeText={(next) => {
          const clean = unformatAmount(next, currency);
          setText(clean);
          onChange(parseMajorToCents(clean, currency));
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={currencyDecimals(currency) === 0 ? "number-pad" : "decimal-pad"}
        accessibilityLabel={accessibilityLabel}
        style={[styles.fieldInput, styles.moneyInput]}
      />
      <Text style={styles.fieldSuffix}>{currencySymbol(currency)}</Text>
    </View>
  );
}
