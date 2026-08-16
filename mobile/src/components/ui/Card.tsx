import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { colors, radii } from "@/lib/theme";

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  radius?: number;
}

export function Card({ children, style, radius = radii.card }: CardProps) {
  return <View style={[styles.card, { borderRadius: radius }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: 16,
  },
});
