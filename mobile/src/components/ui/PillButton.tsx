import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";

import { colors, radii, typography } from "@/lib/theme";

interface PillButtonProps {
  label?: string;
  icon?: ReactNode;
  onPress?: () => void;
  variant?: "solid" | "outline";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

// The design's recurring "black pill on neon green" action button (hero
// card's Add Transaction, chat's Confirm & Save, etc.) — one component so
// every screen renders the exact same pill shape/colors.
export function PillButton({ label, icon, onPress, variant = "solid", disabled, loading, style }: PillButtonProps) {
  const isOutline = variant === "outline";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isOutline ? styles.outline : styles.solid,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.green : colors.onGreen} />
      ) : (
        <>
          {icon}
          {label ? (
            <Text style={[styles.label, isOutline ? styles.outlineLabel : styles.solidLabel]}>{label}</Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  solid: { backgroundColor: colors.onGreen },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.surfaceBorder },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  label: { ...typography.body },
  solidLabel: { color: colors.green },
  outlineLabel: { color: colors.textPrimary },
});
