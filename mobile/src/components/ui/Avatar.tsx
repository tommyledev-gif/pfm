import { Image, StyleSheet, Text, View } from "react-native";

import { initialFor } from "@/lib/category-color";
import { colors } from "@/lib/theme";

interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
  // icon is a free-text emoji/label (backend's Category.icon, e.g. "🍔").
  // iconUrl is an uploaded custom image (Category.icon_url) and always wins
  // over icon when both are present. Neither prop applies outside category
  // contexts (plain user avatars have no icon/icon_url) — the colored
  // circle + initial fallback covers those.
  icon?: string | null;
  iconUrl?: string | null;
}

// Colored-circle avatar — falls back through uploaded image → emoji icon →
// initial, in that order (README "Assets": "avatars are colored circles
// with initials" predates category icon uploads, so the initial fallback
// stays for wallets/users, which have neither icon nor iconUrl).
export function Avatar({ name, color = colors.lavender, size = 44, icon, iconUrl }: AvatarProps) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      {iconUrl ? (
        <Image source={{ uri: iconUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : icon ? (
        <Text style={{ fontSize: size * 0.5 }}>{icon}</Text>
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initialFor(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initial: { color: colors.onGreen, fontWeight: "800" },
});
