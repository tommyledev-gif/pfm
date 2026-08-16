import { StyleSheet, Text, View } from "react-native";

import { initialFor } from "@/lib/category-color";
import { colors } from "@/lib/theme";

interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
}

// Colored-circle-with-initial placeholder for avatars/wallet icons — the
// design has no external images (README "Assets": "avatars are colored
// circles with initials").
export function Avatar({ name, color = colors.lavender, size = 44 }: AvatarProps) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initialFor(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  initial: { color: colors.onGreen, fontWeight: "800" },
});
