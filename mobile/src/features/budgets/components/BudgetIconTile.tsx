import { Image, StyleSheet, View } from "react-native";
import { Image as CachedImage } from "expo-image";

import { EmojiGlyph } from "@/components/ui/EmojiGlyph";
import { colors, radii } from "@/lib/theme";

const DEFAULT_ICON = require("../../../../assets/simple-budgest-logo.png");

interface BudgetIconTileProps {
  name: string;
  icon?: string | null;
  iconUrl?: string | null;
}

const TILE_SIZE = 36;
const GLYPH_SIZE = 22;
const LOGO_SIZE = 22;

// A budget's icon on a uniform neutral tile rather than a per-category coloured
// circle: in a budget list, colour is spent entirely on pace state (the bar and
// its caption), and two colour systems in one row would fight each other.
// Shared by the Budgets screen and the analysis chat's budget answer, so the
// same budget looks the same in both.
//
// Same fallback chain as TintedIconTile — uploaded image → emoji (as its
// OpenMoji artwork) → app logo. Never the name's first letter: a lone "Ă" in
// a circle read as a broken icon, not as the Category.
export function BudgetIconTile({ name, icon, iconUrl }: BudgetIconTileProps) {
  return (
    <View style={styles.tile}>
      {iconUrl ? (
        <CachedImage
          source={{ uri: iconUrl }}
          cachePolicy="memory-disk"
          recyclingKey={iconUrl}
          style={styles.image}
          accessibilityLabel={name}
        />
      ) : icon ? (
        <EmojiGlyph emoji={icon} size={GLYPH_SIZE} />
      ) : (
        <Image source={DEFAULT_ICON} style={styles.logo} resizeMode="contain" accessibilityLabel={name} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: TILE_SIZE, height: TILE_SIZE, borderRadius: radii.pill },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
});
