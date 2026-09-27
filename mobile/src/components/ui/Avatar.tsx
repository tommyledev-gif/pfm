import { Image, StyleSheet, Text, View } from "react-native";
import { Image as CachedImage } from "expo-image";

import { EmojiGlyph } from "@/components/ui/EmojiGlyph";
import { initialFor } from "@/lib/category-color";
import { colors } from "@/lib/theme";

const DEFAULT_ICON = require("../../../assets/simple-budgest-logo.png");

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
  /**
   * What shows when there is neither an image nor an emoji. Records
   * (categories, wallets, budgets) get the app logo — a lone initial read as
   * a broken icon there. People (users, the signed-in account) keep their
   * initial, which is what a person's avatar is supposed to be.
   */
  fallback?: "logo" | "initial";
}

// Colored-circle avatar — falls back through uploaded image → emoji icon →
// initial, in that order (README "Assets": "avatars are colored circles
// with initials" predates category icon uploads, so the initial fallback
// stays for wallets/users, which have neither icon nor iconUrl).
export function Avatar({ name, color = colors.lavender, size = 44, icon, iconUrl, fallback = "logo" }: AvatarProps) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      {iconUrl ? (
        <CachedImage
          source={{ uri: iconUrl }}
          cachePolicy="memory-disk"
          recyclingKey={iconUrl}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : icon ? (
        <EmojiGlyph emoji={icon} size={size * 0.62} />
      ) : fallback === "logo" ? (
        <Image source={DEFAULT_ICON} style={{ width: size * 0.7, height: size * 0.7 }} resizeMode="contain" />
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
