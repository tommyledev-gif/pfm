import { useEffect, useRef } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { BackspaceIcon } from "@/components/ui/Icon";
import { PIN_LENGTH } from "@/lib/constants";
import { createStyles, spacing, typography, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { digitKey, entered, PIN_COPY } from "@/features/security/pin/pin-copy";

const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "del"],
] as const;

const DOT_SIZE = 14;
const SHAKE_OFFSET = 10;
const SHAKE_STEP_MS = 50;
// Keys scale with the screen so the lock screen fits a small phone.
const KEY_SIZE_RATIO = 0.085;
const KEY_SIZE_MIN = 56;
const KEY_SIZE_MAX = 76;

interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  /** Called once with the full PIN, right after its last digit. */
  onComplete: (value: string) => void;
  disabled?: boolean;
  /** Changing it shakes the dots (a wrong PIN, a mismatch). */
  shakeKey?: number;
  /** Under the dots: what went wrong; kept in place when empty, so nothing jumps. */
  message?: string | null;
  /** The message is good news or plain guidance, not an error. */
  messageTone?: "error" | "muted";
}

/**
 * Six dots over a phone-style keypad (1-9, 0, delete). No text field and no
 * system keyboard: the digits never pass through an input the OS could
 * suggest, autofill or log.
 */
export function PinPad({ value, onChange, onComplete, disabled = false, shakeKey = 0, message, messageTone = "error" }: PinPadProps) {
  // Also re-renders the labels entered() and digitKey() read.
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const { height } = useWindowDimensions();
  const keySize = Math.round(Math.min(KEY_SIZE_MAX, Math.max(KEY_SIZE_MIN, height * KEY_SIZE_RATIO)));
  const shakeX = useSharedValue(0);

  useEffect(() => {
    if (shakeKey === 0 || reduceMotion) return;
    shakeX.value = withSequence(
      withTiming(-SHAKE_OFFSET, { duration: SHAKE_STEP_MS }),
      withTiming(SHAKE_OFFSET, { duration: SHAKE_STEP_MS }),
      withTiming(-SHAKE_OFFSET / 2, { duration: SHAKE_STEP_MS }),
      withTiming(SHAKE_OFFSET / 2, { duration: SHAKE_STEP_MS }),
      withTiming(0, { duration: SHAKE_STEP_MS }),
    );
  }, [shakeKey, reduceMotion, shakeX]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  // What has been typed, ahead of the next render: two taps in one frame must
  // not both see five digits and submit twice.
  const typed = useRef(value);
  useEffect(() => {
    typed.current = value;
  }, [value]);

  const press = (key: string) => {
    if (disabled) return;
    const current = typed.current;
    if (key !== "del" && current.length >= PIN_LENGTH) return;
    const next = key === "del" ? current.slice(0, -1) : current + key;
    typed.current = next;
    onChange(next);
    if (next.length === PIN_LENGTH) onComplete(next);
  };

  return (
    <View style={styles.pad}>
      <Animated.View
        style={[styles.dots, shakeStyle]}
        accessible
        accessibilityLabel={entered(value.length)}
        testID="pin-dots"
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, i < value.length && styles.dotFilled]} />
        ))}
      </Animated.View>
      <Text
        style={[styles.message, messageTone === "error" ? styles.messageError : styles.messageMuted]}
        accessibilityLiveRegion="polite"
        numberOfLines={2}
      >
        {message ?? " "}
      </Text>
      <View style={styles.keys}>
        {ROWS.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((key, k) =>
              key === "" ? (
                <View key={k} style={{ width: keySize, height: keySize }} />
              ) : (
                <Pressable
                  key={k}
                  onPress={() => press(key)}
                  disabled={disabled || (key === "del" && value.length === 0)}
                  style={({ pressed }) => [
                    styles.key,
                    { width: keySize, height: keySize, borderRadius: keySize / 2 },
                    key !== "del" && styles.digitKey,
                    pressed && styles.keyPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={key === "del" ? t(PIN_COPY.deleteDigit) : digitKey(key)}
                  testID={key === "del" ? "btn-pin-delete" : `btn-pin-digit-${key}`}
                >
                  {key === "del" ? (
                    <BackspaceIcon size={26} color={colors.textSecondary} />
                  ) : (
                    <Text style={styles.digit}>{key}</Text>
                  )}
                </Pressable>
              ),
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  pad: { alignItems: "center", alignSelf: "stretch" },
  dots: { flexDirection: "row", gap: spacing.lg, paddingVertical: spacing.sm },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  dotFilled: { backgroundColor: colors.green, borderColor: colors.green },
  message: { ...typography.label, minHeight: 36, marginTop: spacing.sm, textAlign: "center" },
  messageError: { color: colors.error },
  messageMuted: { color: colors.textSecondary },
  keys: { marginTop: spacing.md, gap: spacing.md },
  row: { flexDirection: "row", gap: spacing.xl },
  key: { alignItems: "center", justifyContent: "center" },
  digitKey: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  keyPressed: { opacity: 0.6 },
  digit: { fontSize: 28, fontWeight: "500", color: colors.textPrimary },
}));
