import { ReactNode } from "react";
import { StyleProp, View, ViewStyle } from "react-native";

import { radii, createStyles } from "@/lib/theme";

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}

export function Card({ children, style, radius = radii.card }: CardProps) {
  const styles = useStyles();
  return <View style={[styles.card, { borderRadius: radius }, style]}>{children}</View>;
}

const useStyles = createStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: 16,
  },
}));
