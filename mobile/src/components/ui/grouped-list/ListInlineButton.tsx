import { ActivityIndicator, Pressable, Text } from "react-native";

import { createStyles, typography, useColors } from "@/lib/theme";

interface ListInlineButtonProps {
  label: string;
  onPress: () => void;
  /** "destructive" for sign out / delete, "accent" for retry and the like. */
  tone?: "destructive" | "accent" | "default";
  /** A spinner in the label's place; not tappable meanwhile. */
  loading?: boolean;
  disabled?: boolean;
  /** Say which row it acts on: "Đăng xuất Pixel 8", not just "Đăng xuất". */
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * A text-only action in a row's trailing slot ("Đăng xuất" on a device,
 * "Xóa" on a search result): no box, the colour says it is tappable, so a
 * list of rows does not turn into a column of buttons.
 */
export function ListInlineButton({
  label,
  onPress,
  tone = "accent",
  loading = false,
  disabled = false,
  accessibilityLabel,
  testID,
}: ListInlineButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const color = tone === "destructive" ? colors.peach : tone === "accent" ? colors.green : colors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, busy: loading }}
      testID={testID}
      style={({ pressed }) => [pressed && styles.pressed, disabled && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Text style={[styles.label, { color }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const useStyles = createStyles(() => ({
  label: { ...typography.label, fontWeight: "700" },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
}));
