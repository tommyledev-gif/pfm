import { forwardRef, useState } from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";

import { createStyles, spacing, typography, useColors } from "@/lib/theme";
import { RowSeparator } from "@/components/ui/grouped-list/ListCell";
import { LIST_ROW_PADDING_X } from "@/components/ui/grouped-list/list-metrics";

interface ListTextFieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  /** Turns the label red; the sentence itself goes in the group's footer. */
  invalid?: boolean;
  /** Read after the label by a screen reader: what to fix. */
  error?: string;
}

const INPUT_HEIGHT = 28;

/**
 * A text field as a row of a group: its label small on top, the input under
 * it, hairlines between fields instead of a box around each. The label
 * turns green while typing and red while invalid, so with one error line in
 * the footer it is still clear which field it is about.
 */
export const ListTextField = forwardRef<TextInput, ListTextFieldProps>(function ListTextField(
  { label, invalid = false, error, onFocus, onBlur, ...inputProps },
  ref,
) {
  const colors = useColors();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.cell}>
      <RowSeparator inset={LIST_ROW_PADDING_X} />
      <Text style={[styles.label, focused && styles.labelFocused, invalid && styles.labelInvalid]}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
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
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  cell: { gap: 2, paddingHorizontal: LIST_ROW_PADDING_X, paddingTop: spacing.md, paddingBottom: spacing.sm },
  label: { ...typography.caption, color: colors.textSecondary },
  labelFocused: { color: colors.green },
  labelInvalid: { color: colors.peach },
  input: { height: INPUT_HEIGHT + spacing.sm, paddingVertical: 0, fontSize: 17, color: colors.textPrimary },
}));
