import { Image, StyleSheet, Text, View } from "react-native";

import { initialFor } from "@/lib/category-color";
import { radii } from "@/lib/theme";

interface TintedIconTileProps {
  color: string;
  size?: number;
  icon?: string | null;
  iconUrl?: string | null;
  // Only rendered when neither icon nor iconUrl is set — same fallback
  // chain as Avatar.tsx (uploaded image → emoji icon → initial), except the
  // initial here is tinted the same color as the tile instead of Avatar's
  // solid-fill + white text.
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
        <Image source={{ uri: iconUrl }} style={{ width: size, height: size }} />
      ) : icon ? (
        <Text style={{ fontSize: size * 0.45 }}>{icon}</Text>
      ) : (
        <Text style={[styles.initial, { color, fontSize: size * 0.4 }]}>{initialFor(label)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initial: { fontWeight: "800" },
});
