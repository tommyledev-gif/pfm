import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, TextInputProps, View } from "react-native";

import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface InlineActionFieldProps
  extends Pick<TextInputProps, "autoCapitalize" | "autoCorrect" | "autoComplete" | "maxLength" | "placeholder"> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** The button inside the field, on the right ("Lưu", "Đặt"). */
  actionLabel: string;
  onAction: () => void;
  /** Off while there is nothing to submit — the button greys out. */
  actionEnabled: boolean;
  loading?: boolean;
  hint?: string;
  error?: string | null;
  testID?: string;
  actionTestID?: string;
}

const FIELD_HEIGHT = 52;
const ACTION_HEIGHT = 38;

/**
 * A text field with its own submit button inside it, on one row: the label
 * above, the input and the button in one rounded box, a hint or error under
 * it. The box lights up while typing; the button is green only while there
 * is something to submit, so a tap on it is never a dead end. Return on the
 * keyboard submits too.
 */
export function InlineActionField({
  label,
  value,
  onChangeText,
  actionLabel,
  onAction,
  actionEnabled,
  loading = false,
  hint,
  error,
  testID,
  actionTestID,
  maxLength,
  ...inputProps
}: InlineActionFieldProps) {
  const colors = useColors();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const canAct = actionEnabled && !loading;
  // Shown only near the limit: a counter from the first letter is noise.
  const showCount = maxLength !== undefined && focused && value.length >= maxLength * 0.8;

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.boxFocused, error ? styles.boxError : null]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={() => canAct && onAction()}
          returnKeyType="done"
          placeholderTextColor={colors.textMuted}
          maxLength={maxLength}
          style={styles.input}
          testID={testID}
          {...inputProps}
        />
        {showCount ? (
          <Text style={styles.count}>
            {value.length}/{maxLength}
          </Text>
        ) : null}
        <Pressable
          onPress={onAction}
          disabled={!canAct}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAct, busy: loading }}
          style={({ pressed }) => [styles.action, canAct ? styles.actionOn : styles.actionOff, pressed && canAct && styles.actionPressed]}
          testID={actionTestID}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.onGreen} />
          ) : (
            <Text style={[styles.actionLabel, canAct ? styles.actionLabelOn : styles.actionLabelOff]}>{actionLabel}</Text>
          )}
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  block: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
  box: {
    height: FIELD_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: (FIELD_HEIGHT - ACTION_HEIGHT) / 2,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    backgroundColor: withAlpha(colors.overlayBase, 0.05),
  },
  boxFocused: { borderColor: colors.green, backgroundColor: colors.surface },
  boxError: { borderColor: colors.peach },
  input: { flex: 1, height: "100%", paddingVertical: 0, color: colors.textPrimary, ...typography.body },
  count: { ...typography.tiny, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  action: {
    height: ACTION_HEIGHT,
    minWidth: 64,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  actionOn: { backgroundColor: colors.green },
  actionOff: { backgroundColor: colors.surfaceRaised },
  actionPressed: { opacity: 0.85 },
  actionLabel: { ...typography.label, fontWeight: "700" },
  actionLabelOn: { color: colors.onGreen },
  actionLabelOff: { color: colors.textMuted },
  hint: { ...typography.tiny, color: colors.textMuted },
  error: { ...typography.caption, color: colors.peach },
}));
