import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "@/lib/theme";

interface KeypadSheetFooterProps {
  /** Left of the amount: a summary chip or a compact picker. */
  leading: ReactNode;
  /** The amount as displayed — an expression while one is being typed. */
  amount: string;
  /** Small trailing unit after the amount (the currency code). */
  amountSuffix?: string;
  amountColor?: string;
  amountTestID?: string;
  /** Tapping the amount — e.g. to dismiss the note's keyboard and bring the keypad back. */
  onPressAmount?: () => void;
  /** Field errors under the amount row; undefined entries are skipped. */
  errors?: (string | undefined)[];
  /** The note input, the submit error and the CalculatorKeypad, in that order. */
  children: ReactNode;
}

/**
 * The bottom block every keypad-driven sheet shares (reference-ui/
 * KeypadSheetFooter.tsx): a summary chip and the amount on one row, then
 * whatever input and keypad sit under it. Meant for Drawer's pinned `footer`
 * slot, which already draws the divider above it, so the keypad stays put
 * while the pickers above it scroll.
 */
export function KeypadSheetFooter({
  leading,
  amount,
  amountSuffix,
  amountColor = colors.textPrimary,
  amountTestID,
  onPressAmount,
  errors = [],
  children,
}: KeypadSheetFooterProps) {
  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.leading}>{leading}</View>
        <Pressable style={styles.amountWrap} onPress={onPressAmount} disabled={!onPressAmount}>
          <Text
            testID={amountTestID}
            style={[styles.amount, { color: amountColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {amount}
          </Text>
          {amountSuffix ? <Text style={styles.suffix}>{amountSuffix}</Text> : null}
        </Pressable>
      </View>
      {errors.map((message, index) =>
        message ? (
          <Text key={index} style={styles.error}>
            {message}
          </Text>
        ) : null,
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  summaryRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.sm },
  // The chip yields first: the amount is the one thing on this row that must
  // never be cut short.
  leading: { flexShrink: 1, minWidth: 0 },
  amountWrap: { flexShrink: 1, flexDirection: "row", alignItems: "baseline", gap: spacing.xs, minWidth: 96 },
  amount: { ...typography.hero, flexShrink: 1, textAlign: "right" },
  suffix: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.caption, color: colors.peach },
});
