import { ReactNode, useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { AmountCaretText } from "@/components/shared/AmountCaretText";
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
  /** Where the caret is drawn in `amount` (a text index). With onPressChar,
   *  the amount shows a caret and each character can be tapped to move it. */
  caret?: number;
  caretColor?: string;
  onPressChar?: (index: number) => void;
  /** Field errors under the amount row; undefined entries are skipped. */
  errors?: (string | undefined)[];
  /** The note input, the submit error and the CalculatorKeypad, in that order. */
  children: ReactNode;
}

const SHAKE_DISTANCE = 6;
const SHAKE_STEP_MS = 40;

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
  amountAccessibilityLabel,
  amountSuffix,
  amountColor = colors.textPrimary,
  amountTestID,
  preview,
  shakeKey,
  onPressAmount,
  caret,
  caretColor = colors.green,
  onPressChar,
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
      {/* The amount and its preview are one block: the preview tucks under
          the figure on a compact line instead of a full row between gaps,
          which left a wide empty band above the note. */}
      <View>
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
              {caret !== undefined && onPressChar ? (
                <AmountCaretText text={amount} caret={caret} caretColor={caretColor} onPressChar={onPressChar} />
              ) : (
                amount
              )}
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

const useStyles = createStyles((colors) => ({
  container: { gap: spacing.sm },
  summaryRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.sm },
  // The chip yields first: the amount is the one thing on this row that must
  // never be cut short.
  leading: { flexShrink: 1, minWidth: 0 },
  amountWrap: { flexShrink: 1, flexDirection: "row", alignItems: "baseline", gap: spacing.xs, minWidth: 96 },
  amount: { ...typography.hero, flexShrink: 1, textAlign: "right", fontVariant: ["tabular-nums"] },
  suffix: { ...typography.caption, color: colors.textSecondary },
  preview: {
    ...typography.caption,
    lineHeight: 15,
    marginTop: -2,
    color: colors.textSecondary,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  previewError: { color: colors.peach },
  error: { ...typography.caption, color: colors.peach },
}));
