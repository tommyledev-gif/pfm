import { ReactNode, useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Pressable, Text, View } from "react-native";

import { BackspaceIcon, CalendarIcon, CheckIcon } from "@/components/ui/Icon";
import { KeypadKey } from "@/lib/calculator/input";
import { withAlpha } from "@/lib/color";
import { typography, createStyles, useColors } from "@/lib/theme";
import { useJsIdle } from "@/lib/use-js-idle";
import { useReduceMotion } from "@/lib/use-reduce-motion";

// The operator column reads + − × ÷ from the bottom up, as on a phone's own
// calculator: "+" sits beside the thumb, next to the 0 row, where the
// commonest operator (adding up a split bill) belongs.
const DIGIT_ROWS: { digits: KeypadKey[]; operator: KeypadKey }[] = [
  { digits: ["7", "8", "9"], operator: "÷" },
  { digits: ["4", "5", "6"], operator: "×" },
  { digits: ["1", "2", "3"], operator: "−" },
];
const LAST_ROW_OPERATOR: KeypadKey = "+";

// What a screen reader says for each non-digit key — "×" read as "x" and "−"
// as "dash" (or not at all) is the default otherwise.
const SPOKEN_KEY: Partial<Record<KeypadKey, string>> = {
  "+": "cộng",
  "−": "trừ",
  "×": "nhân",
  "÷": "chia",
  ".": "dấu thập phân",
  "000": "ba số không",
};

// Keys are a fixed 48pt tall: past this the system font scale stops growing
// their labels, so 200% text never spills out of — or clips inside — a key.
const KEY_LABEL_MAX_FONT_SCALE = 1.4;
const DATE_LABEL_MAX_FONT_SCALE = 1.2;
// The operator column and the date key: the muted accent as a tint, so only
// ✓ carries it solid.
const ACCENT_TINT_ALPHA = 0.14;

// Borderless rounded squares in one fill (iOS's calculator), the keys told
// apart by color alone: grey digits, tinted operators and date, a solid ✓.
const KEY_HEIGHT = 52;
const KEY_RADIUS = 14;
const GAP = 8;
const DIGIT_BLOCK_COLUMNS = 4;
const READY_FADE_MS = 140;

interface CalculatorKeypadProps {
  onInsert: (key: KeypadKey) => void;
  /** "." for a currency with decimals; "000" for one without (VND), where a
   *  decimal point could only ever produce an amount that does not exist. */
  decimalKey?: "." | "000";
  onBackspace: () => void;
  /** Long-press on backspace — empties the whole amount. */
  onClear?: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  /** Omitted where there is no date to set — the ✓ key then takes the whole action column. */
  onDatePress?: () => void;
  /** The selected day, short enough for one key ("Hôm nay", "24/09"). */
  dateLabel?: string;
  /** Spoken label for the date key — the full date, since `dateLabel` may drop the year. */
  dateAccessibilityLabel?: string;
  testID?: string;
}

/**
 * One of the digit block's four equal columns. Width comes from this
 * border- and padding-free box, never from the key inside it: flex shares
 * space only after subtracting each item's own border, so a bordered key
 * given `flex: 1` directly would come out a different width from a borderless
 * one (reference-ui/CalculatorKeypad.tsx's KeyColumn, same reason).
 */
function KeyColumn({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.column}>{children}</View>;
}

/**
 * The amount keypad from the reference design (reference-ui/
 * CalculatorKeypad.tsx): a 4×4 digit/operator grid plus an action column
 * holding the date key over the ✓ key, all five columns the same width.
 * It stands in for the OS keyboard on the amount — the native keyboard only
 * ever appears for the note field.
 */
export function CalculatorKeypad({
  onInsert,
  decimalKey = ".",
  onBackspace,
  onClear,
  onConfirm,
  confirmDisabled = false,
  confirmLoading = false,
  onDatePress,
  dateLabel,
  dateAccessibilityLabel,
  testID,
}: CalculatorKeypadProps) {
  const colors = useColors();
  const styles = useStyles();
  const keyId = (name: string) => (testID ? `${testID}-key-${name}` : undefined);

  // ⚠️ Shown and enabled only once the JS thread is free. The keypad mounts
  // with its whole sheet, and a press made while that sheet is still
  // rendering and settling queues behind it — the first keys felt dropped or
  // late. Its space is held from the start (only opacity changes), so nothing
  // shifts when it appears.
  const ready = useJsIdle();
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ready) return;
    if (reduceMotion) opacity.setValue(1);
    else Animated.timing(opacity, { toValue: 1, duration: READY_FADE_MS, useNativeDriver: true }).start();
  }, [ready, reduceMotion, opacity]);

  const digitKey = (key: KeypadKey) => (
    <KeyColumn key={key}>
      <Pressable
        testID={keyId(key)}
        accessibilityRole="button"
        accessibilityLabel={SPOKEN_KEY[key] ?? key}
        onPress={() => onInsert(key)}
        style={({ pressed }) => [styles.key, styles.digitKey, pressed && styles.keyPressed]}
      >
        <Text
          style={[styles.digitLabel, key === "000" && styles.thousandsLabel]}
          maxFontSizeMultiplier={KEY_LABEL_MAX_FONT_SCALE}
          numberOfLines={1}
        >
          {key}
        </Text>
      </Pressable>
    </KeyColumn>
  );

  const operatorKey = (glyph: KeypadKey) => (
    <KeyColumn key={glyph}>
      <Pressable
        testID={keyId(glyph)}
        accessibilityRole="button"
        accessibilityLabel={SPOKEN_KEY[glyph] ?? glyph}
        onPress={() => onInsert(glyph)}
        style={({ pressed }) => [styles.key, styles.operatorKey, pressed && styles.keyPressed]}
      >
        <Text style={styles.operatorLabel} maxFontSizeMultiplier={KEY_LABEL_MAX_FONT_SCALE}>
          {glyph}
        </Text>
      </Pressable>
    </KeyColumn>
  );

  const confirmBlocked = confirmDisabled || confirmLoading;

  return (
    <Animated.View
      testID={testID}
      style={[styles.row, { opacity }]}
      pointerEvents={ready ? "auto" : "none"}
      accessibilityElementsHidden={!ready}
      importantForAccessibility={ready ? "auto" : "no-hide-descendants"}
    >
      <View style={styles.digitBlock}>
        {DIGIT_ROWS.map((row) => (
          <View key={row.operator} style={styles.row}>
            {row.digits.map(digitKey)}
            {operatorKey(row.operator)}
          </View>
        ))}
        <View style={styles.row}>
          {digitKey(decimalKey)}
          {digitKey("0")}
          <KeyColumn>
            <Pressable
              testID={keyId("backspace")}
              accessibilityRole="button"
              accessibilityLabel="Xóa"
              accessibilityHint={onClear ? "Nhấn giữ để xóa hết" : undefined}
              onPress={onBackspace}
              onLongPress={onClear}
              style={({ pressed }) => [styles.key, styles.digitKey, pressed && styles.keyPressed]}
            >
              <BackspaceIcon size={22} color={colors.textSecondary} />
            </Pressable>
          </KeyColumn>
          {operatorKey(LAST_ROW_OPERATOR)}
        </View>
      </View>

      <View style={styles.actionColumn}>
        {onDatePress ? (
          <Pressable
            testID={keyId("date")}
            accessibilityRole="button"
            accessibilityLabel={dateAccessibilityLabel ?? dateLabel}
            onPress={onDatePress}
            style={({ pressed }) => [styles.actionKey, styles.dateKey, pressed && styles.keyPressed]}
          >
            <CalendarIcon size={18} color={colors.accentMuted} strokeWidth={2} />
            {dateLabel ? (
              <Text style={styles.dateLabel} numberOfLines={2} maxFontSizeMultiplier={DATE_LABEL_MAX_FONT_SCALE}>
                {dateLabel}
              </Text>
            ) : null}
          </Pressable>
        ) : null}
        <Pressable
          testID={keyId("confirm")}
          accessibilityRole="button"
          accessibilityLabel="Xác nhận"
          accessibilityState={{ disabled: confirmBlocked, busy: confirmLoading }}
          disabled={confirmBlocked}
          onPress={onConfirm}
          style={({ pressed }) => [
            styles.actionKey,
            confirmDisabled ? styles.confirmKeyDisabled : styles.confirmKey,
            pressed && !confirmBlocked && styles.keyPressed,
          ]}
        >
          {confirmLoading ? (
            <ActivityIndicator color={colors.onAccentMuted} />
          ) : (
            <CheckIcon size={24} color={confirmDisabled ? colors.textMuted : colors.onAccentMuted} strokeWidth={2.4} />
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", gap: GAP },
  // flexBasis carries the block's own inner gaps, so its four columns and the
  // action column beside it all resolve to the same width.
  digitBlock: { flexGrow: DIGIT_BLOCK_COLUMNS, flexShrink: 1, flexBasis: GAP * (DIGIT_BLOCK_COLUMNS - 1), gap: GAP },
  actionColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, gap: GAP },
  column: { flex: 1 },
  key: {
    height: KEY_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: KEY_RADIUS,
  },
  keyPressed: { opacity: 0.55 },
  digitKey: { backgroundColor: colors.keyFill },
  digitLabel: { fontSize: 24, fontWeight: "500", color: colors.textPrimary, fontVariant: ["tabular-nums"] },
  thousandsLabel: { fontSize: 19 },
  operatorKey: { backgroundColor: withAlpha(colors.accentMuted, ACCENT_TINT_ALPHA) },
  operatorLabel: { fontSize: 24, fontWeight: "500", color: colors.accentMuted },
  actionKey: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 2,
    borderRadius: KEY_RADIUS,
  },
  dateKey: { backgroundColor: withAlpha(colors.accentMuted, ACCENT_TINT_ALPHA) },
  dateLabel: { ...typography.caption, color: colors.accentMuted, textAlign: "center" },
  confirmKey: { backgroundColor: colors.accentMuted },
  confirmKeyDisabled: { backgroundColor: colors.keyFill },
}));
