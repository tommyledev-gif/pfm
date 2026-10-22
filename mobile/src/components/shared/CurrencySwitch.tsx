import { memo } from "react";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";

import { radii, typography, createStyles } from "@/lib/theme";

interface CurrencySwitchProps {
  currencies: string[];
  value: string;
  onChange: (currency: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A small pill switch between the currencies a figure can be shown in
 * ("VND | USD"). Renders nothing for a single currency — there is nothing to
 * switch, and a lone pill would read as a label. Compact on purpose: it sits
 * beside a date chip or inside a card's corner, never as a row of its own.
 */
export const CurrencySwitch = memo(function CurrencySwitch({ currencies, value, onChange, style, testID }: CurrencySwitchProps) {
  const styles = useStyles();
  if (currencies.length < 2) return null;
  return (
    <View style={[styles.track, style]} accessibilityRole="tablist" testID={testID}>
      {currencies.map((currency) => {
        const active = currency === value;
        return (
          <Pressable
            key={currency}
            onPress={() => onChange(currency)}
            hitSlop={4}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Xem theo ${currency}`}
            testID={testID ? `${testID}-${currency}` : undefined}
            style={[styles.option, active && styles.optionActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{currency}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  track: {
    flexDirection: "row",
    alignSelf: "flex-start",
    padding: 2,
    gap: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  option: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radii.pill },
  optionActive: { backgroundColor: colors.green },
  label: { ...typography.tiny, fontWeight: "700", color: colors.textSecondary },
  labelActive: { color: colors.onGreen },
}));
