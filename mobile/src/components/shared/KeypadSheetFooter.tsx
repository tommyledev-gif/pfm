import { ReactNode, useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { useReduceMotion } from "@/lib/use-reduce-motion";
import { colors, spacing, typography, createStyles } from "@/lib/theme";

interface KeypadSheetFooterProps {
  /** Left of the amount: a summary chip or a compact picker. */
  leading: ReactNode;
  /** The amount as displayed — an expression while one is being typed. */
  amount: string;
  /** What a screen reader says for the amount ("5 cộng 3"). */
  amountAccessibilityLabel?: string;
  /** Small trailing unit after the amount (the currency code). */
  amountSuffix?: string;
  amountColor?: string;
  amountTestID?: string;
  /** "= 8" under an expression, or why it has no value. Passing the prop at
   *  all reserves the line, so the layout never jumps when it fills in. */
  preview?: { text: string; tone: "result" | "error" } | null;
  /** Changes whenever a key was refused — the amount shakes once per change,
   *  so a keypress that "did nothing" is never silent. */
  shakeKey?: number;
  /** Tapping the amount — e.g. to dismiss the note's keyboard and bring the keypad back. */
  onPressAmount?: () => void;
  /** Field errors under the amount row; undefined entries are skipped. */
  errors?: (string | undefined)[];
  /** The note input, the submit error and the CalculatorKeypad, in that order. */
  children: ReactNode;
}

const SHAKE_DISTANCE = 6;
const SHAKE_STEP_MS = 40;

/**
 * The bottom block every keypad-driven sheet shares (reference-ui/
 * KeypadSheetFooter.tsx): a summary chip over the centred amount, then
 * whatever input and keypad sit under it. Meant for Drawer's pinned `footer`
 * slot, which already draws the divider above it, so the keypad stays put
 * while the pickers above it scroll.
 */
export function KeypadSheetFooter({
  leading,
  amount,
  amountAccessibilityLabel,
  amountSuffix,
  amountColor = colors.textPrimary,
  amountTestID,
  preview,
  shakeKey,
  onPressAmount,
  errors = [],
  children,
}: KeypadSheetFooterProps) {
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const shake = useRef(new Animated.Value(0)).current;
  const firstShakeKey = useRef(shakeKey);

  useEffect(() => {
    if (shakeKey === firstShakeKey.current || reduceMotion) return;
    const step = (toValue: number) => Animated.timing(shake, { toValue, duration: SHAKE_STEP_MS, useNativeDriver: true });
    Animated.sequence([step(SHAKE_DISTANCE), step(-SHAKE_DISTANCE), step(SHAKE_DISTANCE / 2), step(0)]).start();
  }, [shakeKey, reduceMotion, shake]);

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.leading}>{leading}</View>
        <Pressable
          style={styles.amountWrap}
          onPress={onPressAmount}
          disabled={!onPressAmount}
          accessibilityLabel={amountAccessibilityLabel}
        >
          <Animated.Text
            testID={amountTestID}
            style={[styles.amount, { color: amountColor, transform: [{ translateX: shake }] }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.4}
            // A long expression keeps its END in view — the part being typed.
            ellipsizeMode="head"
          >
            {amount}
          </Animated.Text>
          {amountSuffix ? <Text style={styles.suffix}>{amountSuffix}</Text> : null}
        </Pressable>
      </View>
      {preview !== undefined ? (
        <Text
          style={[styles.preview, preview?.tone === "error" && styles.previewError]}
          numberOfLines={1}
          testID={amountTestID ? `${amountTestID}-preview` : undefined}
          accessibilityLiveRegion="polite"
        >
          {preview?.text ?? " "}
        </Text>
      ) : null}
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

// The amount is the screen's centrepiece: large, centred, light in weight,
// with the chip that says what it is for (category, transfer target) above it.
const AMOUNT_FONT_SIZE = 46;

const useStyles = createStyles((colors) => ({
  container: { gap: spacing.sm },
  summaryRow: { alignItems: "center", gap: spacing.xs },
  leading: { maxWidth: "100%", alignItems: "center" },
  amountWrap: { maxWidth: "100%", flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 6 },
  amount: {
    fontSize: AMOUNT_FONT_SIZE,
    fontWeight: "600",
    letterSpacing: -1,
    flexShrink: 1,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  suffix: { ...typography.body, fontWeight: "500", color: colors.textSecondary },
  preview: { ...typography.label, color: colors.textSecondary, textAlign: "center", fontVariant: ["tabular-nums"] },
  previewError: { color: colors.peach },
  error: { ...typography.caption, color: colors.peach, textAlign: "center" },
}));
