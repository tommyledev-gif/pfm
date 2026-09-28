import { Image, StyleSheet, View } from "react-native";
import { Image as CachedImage } from "expo-image";

import { EmojiGlyph } from "@/components/ui/EmojiGlyph";
import { radii } from "@/lib/theme";

const DEFAULT_ICON = require("../../../assets/simple-budgest-logo.png");

interface TintedIconTileProps {
  color: string;
  size?: number;
  icon?: string | null;
  iconUrl?: string | null;
  // Accessibility label for the fallback: with neither icon nor iconUrl set
  // the tile shows the app logo (uploaded image → emoji icon → logo).
  label: string;
}

// A softly-tinted rounded square (color-at-~10%-opacity fill, ~25% border,
// colored glyph) — the opposite look from Avatar.tsx's solid-filled circle.
// Shared by TransactionRow and WalletStackCard (both want this specific subtler
// treatment); Avatar itself stays untouched since its opaque-circle look is
// still correct everywhere else it's used (category/user list items,
// identity chips, etc.) — restyling it globally would change screens nobody
// asked to touch. React Native's color parser accepts 8-digit hex
// (#RRGGBBAA) directly, so appending an alpha suffix to a plain 6-digit hex
// needs no rgba conversion helper.
export function TintedIconTile({ color, size = 44, icon, iconUrl, label }: TintedIconTileProps) {
  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: Math.min(radii.listCard - 2, size / 2.6),
          backgroundColor: `${color}1A`,
          borderColor: `${color}40`,
        },
      ]}
    >
      {iconUrl ? (
        <CachedImage
          source={{ uri: iconUrl }}
          cachePolicy="memory-disk"
          recyclingKey={iconUrl}
          style={{ width: size, height: size }}
        />
      ) : icon ? (
        <EmojiGlyph emoji={icon} size={size * 0.6} />
      ) : (
        // Only ever a category/wallet tile, so no icon means the app logo,
        // not the label's first letter (which read as a broken icon).
        <Image
          source={DEFAULT_ICON}
          style={{ width: size * 0.66, height: size * 0.66 }}
          resizeMode="contain"
          accessibilityLabel={label}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
