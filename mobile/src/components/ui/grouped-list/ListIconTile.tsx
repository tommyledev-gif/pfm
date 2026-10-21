import { View } from "react-native";

import { withAlpha } from "@/lib/color";
import { createStyles, useColors } from "@/lib/theme";
import {
  LIST_ICON_GLYPH_SIZE,
  LIST_ICON_TILE_RADIUS,
  LIST_ICON_TILE_SIZE,
  LIST_ICON_TINT_ALPHA,
  ListGlyph,
} from "@/components/ui/grouped-list/list-metrics";

interface ListIconTileProps {
  icon: ListGlyph;
  /**
   * A palette token's value (colors.info, colors.mint…). Its wash fills the
   * tile and the glyph takes the colour itself. Left out: a neutral grey tile.
   */
  tone?: string;
}

/**
 * The small rounded square at the start of a settings row. Tinted rather
 * than solid: the palettes' accents are pastels on the dark theme and deep
 * tones on the light one, and a white glyph on a pastel tile is unreadable,
 * while the accent on its own wash reads in both themes.
 */
export function ListIconTile({ icon: Icon, tone }: ListIconTileProps) {
  const colors = useColors();
  const styles = useStyles();
  const background = tone ? withAlpha(tone, LIST_ICON_TINT_ALPHA) : withAlpha(colors.overlayBase, 0.08);

  return (
    <View style={[styles.tile, { backgroundColor: background }]}>
      <Icon size={LIST_ICON_GLYPH_SIZE} color={tone ?? colors.textSecondary} weight="fill" />
    </View>
  );
}

const useStyles = createStyles(() => ({
  tile: {
    width: LIST_ICON_TILE_SIZE,
    height: LIST_ICON_TILE_SIZE,
    borderRadius: LIST_ICON_TILE_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
}));
