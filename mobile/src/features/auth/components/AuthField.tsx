import { ReactNode, forwardRef, useState } from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";

import { FieldError } from "@/components/ui/FieldError";
import { withAlpha } from "@/lib/color";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";

const FIELD_HEIGHT = 56;
const FIELD_RADIUS = 16;

interface AuthFieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  /** Shown under the field; the border turns red while it is set. */
  error?: string;
  /** Inside the box, after the text: an icon, or the show-password button. */
  trailing?: ReactNode;
}

// A labelled field in the login form's look (56 tall, accent border while
// typing). An invalid one keeps a red border and says how to fix it right
// under itself, so the problem is next to the place to fix it.
export const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField(
  { label, error, trailing, onFocus, onBlur, ...inputProps },
  ref,
) {
  const colors = useColors();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.boxFocused, error ? styles.boxInvalid : null]}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={label}
          // Read after the label, so a screen reader hears what to fix.
          accessibilityHint={error}
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={styles.input}
        />
        {trailing}
      </View>
      <FieldError message={error} />
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  field: { gap: spacing.sm },
  label: { ...typography.label, fontWeight: "500", color: colors.textSecondary },
  box: {
    height: FIELD_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    borderRadius: FIELD_RADIUS,
  },
  input: {
    flex: 1,
    height: "100%",
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontSize: 17,
  },
  boxFocused: { borderColor: colors.green },
  // After focus on purpose: an invalid field stays red while it is fixed.
  boxInvalid: { borderColor: colors.peach, backgroundColor: withAlpha(colors.peach, 0.06) },
}));
