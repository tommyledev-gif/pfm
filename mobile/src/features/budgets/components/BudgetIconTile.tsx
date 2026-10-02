import { Image, StyleSheet, Text, View } from "react-native";

import { initialFor } from "@/lib/category-color";
import { colors, radii } from "@/lib/theme";

interface BudgetIconTileProps {
  name: string;
  icon?: string | null;
  iconUrl?: string | null;
}

const TILE_SIZE = 36;
const GLYPH_SIZE = 16;

// A budget's icon on a uniform neutral tile rather than a per-category coloured
// circle: in a budget list, colour is spent entirely on pace state (the bar and
// its caption), and two colour systems in one row would fight each other.
// Shared by the Budgets screen and the analysis chat's budget answer, so the
// same budget looks the same in both.
export function BudgetIconTile({ name, icon, iconUrl }: BudgetIconTileProps) {
  return (
    <View style={styles.tile}>
      {iconUrl ? (
        <Image source={{ uri: iconUrl }} style={styles.image} />
      ) : (
        <Text style={styles.glyph}>{icon || initialFor(name)}</Text>
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
  glyph: { fontSize: GLYPH_SIZE, color: colors.textPrimary, fontWeight: "700" },
});
