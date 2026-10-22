import { View } from "react-native";

import { MapPinGlyph } from "@/components/ui/grouped-list/list-icons";
import { createStyles, useColors } from "@/lib/theme";
import { TransactionLocationInput } from "@/features/transactions/types";
import { LocationMap } from "@/features/transactions/components/LocationMap";
import { EntryTile } from "@/features/transactions/components/EntryTile";
import type { LocationTileView } from "@/features/transactions/components/TransactionExtrasRow";

interface TransactionLocationRowProps {
  pin: TransactionLocationInput;
  /** Its summary (place name, or coordinates) and detail ("Đã dời, chưa lưu"). */
  tile: LocationTileView;
  onPress: () => void;
}

const THUMB_SIZE = 44;

/**
 * A pinned location as a row of the extras group: a small still map of the
 * pin where the icon tile would be, the area's name and the note (or that
 * the pin was moved), and a chevron to the full map.
 */
export function TransactionLocationRow({ pin, tile, onPress }: TransactionLocationRowProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <EntryTile
      label={tile.summary}
      summary=""
      detail={tile.detail ?? pin.note ?? undefined}
      glyph={MapPinGlyph}
      tone={colors.peach}
      leading={
        // Taps go to the row, not into the still map.
        <View pointerEvents="none" style={styles.thumb}>
          <LocationMap coords={{ latitude: pin.latitude, longitude: pin.longitude }} style={styles.thumb} />
        </View>
      }
      leadingWidth={THUMB_SIZE}
      onPress={onPress}
      testID="btn-transaction-location"
      accessibilityLabel={tile.accessibilityLabel}
    />
  );
}

const useStyles = createStyles(() => ({
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 10, overflow: "hidden" },
}));
