import { Pressable, Text, View } from "react-native";

import { ChevronRightIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { TransactionLocationInput } from "@/features/transactions/types";
import { LocationMap } from "@/features/transactions/components/LocationMap";
import type { LocationTileView } from "@/features/transactions/components/TransactionExtrasRow";

interface TransactionLocationRowProps {
  pin: TransactionLocationInput;
  /** Its summary (place name, or coordinates) and detail ("Đã dời, chưa lưu"). */
  tile: LocationTileView;
  onPress: () => void;
}

const THUMB_WIDTH = 72;
const THUMB_HEIGHT = 52;

/**
 * A pinned location as its own full-width row: a small still map of the pin,
 * the area's name and the note (or that the pin was moved), and a chevron to
 * the full map. Shown once there is a pin; without one, the location is the
 * half-width "Thêm vị trí" tile next to "Các món".
 */
export function TransactionLocationRow({ pin, tile, onPress }: TransactionLocationRowProps) {
  const colors = useColors();
  const styles = useStyles();
  const detail = tile.detail ?? pin.note;

  return (
    <View>
      <Text style={styles.label}>Vị trí</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={tile.accessibilityLabel}
        testID="btn-transaction-location"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {/* Taps go to the row, not into the still map. */}
        <View pointerEvents="none" style={styles.thumb}>
          <LocationMap coords={{ latitude: pin.latitude, longitude: pin.longitude }} style={styles.map} />
        </View>
        <View style={styles.texts}>
          <Text style={styles.place} numberOfLines={1}>
            {tile.summary}
          </Text>
          {detail ? (
            <Text style={styles.detail} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
        <ChevronRightIcon size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  // Same label and frame as EntryTile, so it reads as the same kind of field.
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
  },
  pressed: { opacity: 0.85 },
  thumb: { width: THUMB_WIDTH, height: THUMB_HEIGHT, borderRadius: 10, overflow: "hidden" },
  map: { width: THUMB_WIDTH, height: THUMB_HEIGHT, borderRadius: 10 },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  place: { ...typography.label, color: colors.textPrimary },
  detail: { ...typography.tiny, color: colors.textMuted },
}));
